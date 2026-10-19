"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbMessage } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { emailSchema, firstError } from "@/lib/validation";
import type { ActionResult } from "@/app/actions/evaluation";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Verifies the caller is an active head. Every settings action starts here. */
async function headContext(): Promise<
  { ok: true; supabase: Supabase; userId: string } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "กรุณาเข้าสู่ระบบ" };
  const { data } = await supabase
    .from("profiles")
    .select("role,is_active,is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!data || !(data.role === "head" || data.is_admin) || !data.is_active) {
    return { ok: false, error: "ไม่มีสิทธิ์ดำเนินการ" };
  }
  return { ok: true, supabase, userId: user.id };
}

function done(): ActionResult {
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/evaluate");
  revalidatePath("/assess");
  return { ok: true };
}

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
const userFields = {
  fullName: z.string().trim().min(1, "กรุณากรอกชื่อ").max(120),
  role: z.enum(["head", "staff"]),
  staffGroupId: z.number().int().positive().nullable(),
  countsInScore: z.boolean(),
  isAdmin: z.boolean(),
};

function groupRule<T extends { role: string; staffGroupId: number | null }>(v: T, ctx: z.RefinementCtx) {
  if (v.role === "staff" && v.staffGroupId === null) {
    ctx.addIssue({ code: "custom", message: "กรุณาเลือกกลุ่มของพนักงาน", path: ["staffGroupId"] });
  }
}

// admin rights are granted afterwards from the user's edit panel, never at invite time
const { isAdmin: _omit, ...inviteFields } = userFields;
const inviteSchema = z
  .object({ email: emailSchema, ...inviteFields })
  .superRefine(groupRule);

export async function inviteUserAction(input: unknown): Promise<ActionResult> {
  const ctx = await headContext();
  if (!ctx.ok) return ctx;
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const v = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(v.email, {
    redirectTo: `${siteUrl()}/auth/confirm?next=/reset-password`,
    data: {
      full_name: v.fullName,
      role: v.role,
      staff_group_id: v.role === "staff" ? String(v.staffGroupId) : "",
      counts_in_score: v.countsInScore,
    },
  });
  if (error) {
    return {
      ok: false,
      error: /already|registered/i.test(error.message)
        ? "อีเมลนี้มีอยู่ในระบบแล้ว"
        : "ส่งอีเมลเชิญไม่สำเร็จ กรุณาตรวจสอบการตั้งค่า SMTP",
    };
  }
  return done();
}

// "admin" = system watcher: stored as a head who is flagged admin and never counted in any score
const updateUserSchema = z
  .object({
    id: z.uuid(),
    isActive: z.boolean(),
    ...userFields,
    role: z.enum(["head", "staff", "admin"]),
    isAdmin: z.boolean().optional(),
    googleEmail: z.union([z.literal(""), emailSchema]).nullable().optional(),
  })
  .superRefine(groupRule);

export async function updateUserAction(input: unknown): Promise<ActionResult> {
  const ctx = await headContext();
  if (!ctx.ok) return ctx;
  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const v = parsed.data;
  const isAdminRole = v.role === "admin";
  const dbRole = isAdminRole ? "head" : v.role;

  // you may not lock yourself out: stay a head or an admin, and stay active
  if (v.id === ctx.userId && (v.role === "staff" || !v.isActive)) {
    return { ok: false, error: "ไม่สามารถปิดใช้งานหรือลดสิทธิ์ตัวเองได้" };
  }

  const { error } = await ctx.supabase
    .from("profiles")
    .update({
      full_name: v.fullName,
      role: dbRole,
      staff_group_id: dbRole === "staff" ? v.staffGroupId : null,
      counts_in_score: isAdminRole ? false : v.countsInScore,
      is_admin: isAdminRole,
      is_active: v.isActive,
      ...(v.googleEmail === undefined ? {} : { google_email: v.googleEmail || null }),
    })
    .eq("id", v.id);
  if (error) return { ok: false, error: dbMessage(error.message, "บันทึกไม่สำเร็จ (อีเมล Google นี้อาจถูกใช้กับคนอื่นแล้ว)") };

  // Also block / unblock sign-in at the auth layer (people without a login have nothing to ban)
  try {
    await createAdminClient().auth.admin.updateUserById(v.id, {
      ban_duration: v.isActive ? "none" : "876000h",
    });
  } catch {
    // profile flag still blocks access in middleware and RLS
  }
  return done();
}

/** Invite someone who is already on the roster (no login yet) by email. */
export async function invitePendingAction(input: unknown): Promise<ActionResult> {
  const ctx = await headContext();
  if (!ctx.ok) return ctx;
  const parsed = z.object({ id: z.uuid(), email: emailSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { id, email } = parsed.data;

  const { data: person } = await ctx.supabase
    .from("profiles")
    .select("id,has_account,full_name,role,staff_group_id,counts_in_score")
    .eq("id", id)
    .maybeSingle();
  if (!person) return { ok: false, error: "ไม่พบผู้ใช้" };
  if (person.has_account) return { ok: false, error: "คนนี้มีบัญชีอยู่แล้ว" };

  // The email on the pending profile is how the new auth user gets re-linked to it
  const { error: setErr } = await ctx.supabase.from("profiles").update({ email }).eq("id", id);
  if (setErr) {
    return {
      ok: false,
      error: /duplicate|unique/i.test(setErr.message) ? "อีเมลนี้ถูกใช้กับคนอื่นแล้ว" : dbMessage(setErr.message),
    };
  }

  const { error } = await createAdminClient().auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl()}/auth/confirm?next=/reset-password`,
    data: {
      full_name: person.full_name,
      role: person.role,
      staff_group_id: person.staff_group_id === null ? "" : String(person.staff_group_id),
      counts_in_score: person.counts_in_score,
    },
  });
  if (error) {
    await ctx.supabase.from("profiles").update({ email: null }).eq("id", id);
    return {
      ok: false,
      error: /already|registered/i.test(error.message)
        ? "อีเมลนี้มีอยู่ในระบบแล้ว"
        : "ส่งอีเมลเชิญไม่สำเร็จ กรุณาตรวจสอบการตั้งค่า SMTP",
    };
  }
  return done();
}

/** Permanently deletes a person with all evaluations they gave or received. */
export async function deleteUserAction(input: unknown): Promise<ActionResult> {
  const ctx = await headContext();
  if (!ctx.ok) return ctx;
  const parsed = z.object({ id: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { id } = parsed.data;
  if (id === ctx.userId) return { ok: false, error: "ไม่สามารถลบตัวเองได้" };

  const { data: person } = await ctx.supabase
    .from("profiles")
    .select("has_account")
    .eq("id", id)
    .maybeSingle();
  if (!person) return { ok: false, error: "ไม่พบผู้ใช้" };

  const { error } = await ctx.supabase.rpc("delete_person", { p_id: id });
  if (error) return { ok: false, error: dbMessage(error.message, "ลบไม่สำเร็จ") };

  // remove the login too, so the email can be invited again later
  if (person.has_account) {
    const { error: authErr } = await createAdminClient().auth.admin.deleteUser(id);
    if (authErr) {
      return { ok: false, error: "ลบข้อมูลแล้ว แต่ลบบัญชีล็อกอินไม่สำเร็จ ลบเองได้ที่ Supabase → Authentication → Users" };
    }
  }
  return done();
}

export async function sendResetLinkAction(input: unknown): Promise<ActionResult> {
  const ctx = await headContext();
  if (!ctx.ok) return ctx;
  const parsed = z.object({ id: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const { data } = await ctx.supabase.from("profiles").select("email").eq("id", parsed.data.id).maybeSingle();
  if (!data?.email) return { ok: false, error: "ยังไม่ได้เชิญคนนี้เข้าระบบ" };
  const { error } = await createAdminClient().auth.resetPasswordForEmail(data.email, {
    redirectTo: `${siteUrl()}/auth/callback?next=/reset-password`,
  });
  if (error) return { ok: false, error: "ส่งลิงก์ไม่สำเร็จ กรุณาตรวจสอบการตั้งค่า SMTP" };
  return { ok: true };
}

export async function renameStaffGroupAction(input: unknown): Promise<ActionResult> {
  const ctx = await headContext();
  if (!ctx.ok) return ctx;
  const parsed = z
    .object({ id: z.number().int().positive(), name: z.string().trim().min(1, "กรุณากรอกชื่อกลุ่ม").max(80) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { error } = await ctx.supabase
    .from("staff_groups")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.id);
  if (error) return { ok: false, error: dbMessage(error.message) };
  return done();
}

// ---------------------------------------------------------------------------
// Core competency structure
// ---------------------------------------------------------------------------
const coreGroupSchema = z.object({
  id: z.number().int().positive().optional(),
  cycleId: z.number().int().positive(),
  code: z.string().trim().min(1, "กรุณากรอกรหัสหมวด").max(8),
  name: z.string().trim().min(1, "กรุณากรอกชื่อหมวด").max(120),
});

export async function saveCoreGroupAction(input: unknown): Promise<ActionResult> {
  const ctx = await headContext();
  if (!ctx.ok) return ctx;
  const parsed = coreGroupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const v = parsed.data;

  if (v.id) {
    const { error } = await ctx.supabase
      .from("core_groups")
      .update({ code: v.code, name: v.name })
      .eq("id", v.id);
    if (error) return { ok: false, error: dbMessage(error.message) };
  } else {
    const { data: last } = await ctx.supabase
      .from("core_groups")
      .select("sort_order")
      .eq("cycle_id", v.cycleId)
      .order("sort_order", { ascending: false })
      .limit(1);
    const { error } = await ctx.supabase.from("core_groups").insert({
      cycle_id: v.cycleId,
      code: v.code,
      name: v.name,
      sort_order: (last?.[0]?.sort_order ?? 0) + 1,
    });
    if (error) return { ok: false, error: dbMessage(error.message) };
  }
  return done();
}

const coreQuestionSchema = z.object({
  id: z.number().int().positive().optional(),
  groupId: z.number().int().positive(),
  text: z.string().trim().min(1, "กรุณากรอกข้อความคำถาม").max(500),
});

export async function saveCoreQuestionAction(input: unknown): Promise<ActionResult> {
  const ctx = await headContext();
  if (!ctx.ok) return ctx;
  const parsed = coreQuestionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const v = parsed.data;

  if (v.id) {
    const { error } = await ctx.supabase.from("core_questions").update({ text: v.text }).eq("id", v.id);
    if (error) return { ok: false, error: dbMessage(error.message) };
  } else {
    const { data: last } = await ctx.supabase
      .from("core_questions")
      .select("sort_order")
      .eq("group_id", v.groupId)
      .order("sort_order", { ascending: false })
      .limit(1);
    const { error } = await ctx.supabase.from("core_questions").insert({
      group_id: v.groupId,
      text: v.text,
      sort_order: (last?.[0]?.sort_order ?? 0) + 1,
    });
    if (error) return { ok: false, error: dbMessage(error.message) };
  }
  return done();
}

const deleteSchema = z.object({
  kind: z.enum(["core_groups", "core_questions", "job_items"]),
  id: z.number().int().positive(),
});

export async function deleteSettingRowAction(input: unknown): Promise<ActionResult> {
  const ctx = await headContext();
  if (!ctx.ok) return ctx;
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { error } = await ctx.supabase.from(parsed.data.kind).delete().eq("id", parsed.data.id);
  if (error) return { ok: false, error: dbMessage(error.message, "ลบไม่สำเร็จ") };
  return done();
}

const moveSchema = z.object({
  kind: z.enum(["core_groups", "core_questions", "job_items"]),
  id: z.number().int().positive(),
  direction: z.enum(["up", "down"]),
});

/** Moves a row one step among its siblings, renumbering sort_order densely. */
export async function moveSettingRowAction(input: unknown): Promise<ActionResult> {
  const ctx = await headContext();
  if (!ctx.ok) return ctx;
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { kind, id, direction } = parsed.data;

  const { data: row } = await ctx.supabase.from(kind).select("*").eq("id", id).maybeSingle();
  if (!row) return { ok: false, error: "ไม่พบรายการ" };

  let q = ctx.supabase.from(kind).select("id");
  if (kind === "core_groups") q = q.eq("cycle_id", row.cycle_id);
  else if (kind === "core_questions") q = q.eq("group_id", row.group_id);
  else q = q.eq("cycle_id", row.cycle_id).eq("staff_group_id", row.staff_group_id);
  const { data: siblings } = await q.order("sort_order").order("id");

  const ids = (siblings ?? []).map((s: { id: number }) => s.id);
  const from = ids.indexOf(id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= ids.length) return { ok: true };
  [ids[from], ids[to]] = [ids[to], ids[from]];

  for (let i = 0; i < ids.length; i++) {
    const { error } = await ctx.supabase.from(kind).update({ sort_order: i + 1 }).eq("id", ids[i]);
    if (error) return { ok: false, error: dbMessage(error.message) };
  }
  return done();
}

// ---------------------------------------------------------------------------
// Job Base
// ---------------------------------------------------------------------------
const jobItemSchema = z.object({
  id: z.number().int().positive().optional(),
  cycleId: z.number().int().positive(),
  staffGroupId: z.number().int().positive(),
  text: z.string().trim().min(1, "กรุณากรอกข้อความ").max(500),
  weight: z.number().positive("น้ำหนักต้องมากกว่า 0").max(1000),
});

export async function saveJobItemAction(input: unknown): Promise<ActionResult> {
  const ctx = await headContext();
  if (!ctx.ok) return ctx;
  const parsed = jobItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const v = parsed.data;

  if (v.id) {
    const { error } = await ctx.supabase
      .from("job_items")
      .update({ text: v.text, weight: v.weight })
      .eq("id", v.id);
    if (error) return { ok: false, error: dbMessage(error.message) };
  } else {
    const { data: last } = await ctx.supabase
      .from("job_items")
      .select("sort_order")
      .eq("cycle_id", v.cycleId)
      .eq("staff_group_id", v.staffGroupId)
      .order("sort_order", { ascending: false })
      .limit(1);
    const { error } = await ctx.supabase.from("job_items").insert({
      cycle_id: v.cycleId,
      staff_group_id: v.staffGroupId,
      text: v.text,
      weight: v.weight,
      sort_order: (last?.[0]?.sort_order ?? 0) + 1,
    });
    if (error) return { ok: false, error: dbMessage(error.message) };
  }
  return done();
}

// ---------------------------------------------------------------------------
// Weights
// ---------------------------------------------------------------------------
const weightsSchema = z
  .object({
    cycleId: z.number().int().positive(),
    headWeight: z.number().min(0).max(100),
    coreWeight: z.number().min(0).max(100),
    jobWeight: z.number().min(0).max(100),
    kpiWeight: z.number().min(0).max(100),
  })
  .refine((v) => Math.abs(v.coreWeight + v.jobWeight + v.kpiWeight - 100) < 1e-9, {
    message: "สัดส่วน Core / Job Base / KPI ต้องรวมกันได้ 100",
  });

export async function saveWeightsAction(input: unknown): Promise<ActionResult> {
  const ctx = await headContext();
  if (!ctx.ok) return ctx;
  const parsed = weightsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const v = parsed.data;
  const { error } = await ctx.supabase
    .from("eval_cycles")
    .update({
      head_weight: v.headWeight,
      core_weight: v.coreWeight,
      job_weight: v.jobWeight,
      kpi_weight: v.kpiWeight,
    })
    .eq("id", v.cycleId);
  if (error) return { ok: false, error: dbMessage(error.message) };
  return done();
}

// ---------------------------------------------------------------------------
// Cycles
// ---------------------------------------------------------------------------
export async function createCycleAction(input: unknown): Promise<ActionResult> {
  const ctx = await headContext();
  if (!ctx.ok) return ctx;
  const parsed = z
    .object({ name: z.string().trim().min(1, "กรุณากรอกชื่อรอบ").max(120) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { error } = await ctx.supabase.rpc("create_cycle_from_latest", { p_name: parsed.data.name });
  if (error) return { ok: false, error: dbMessage(error.message) };
  return done();
}

export async function updateCycleAction(input: unknown): Promise<ActionResult> {
  const ctx = await headContext();
  if (!ctx.ok) return ctx;
  const parsed = z
    .object({
      id: z.number().int().positive(),
      isOpen: z.boolean().optional(),
      isCurrent: z.boolean().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const patch: Record<string, boolean> = {};
  if (parsed.data.isOpen !== undefined) patch.is_open = parsed.data.isOpen;
  if (parsed.data.isCurrent !== undefined) patch.is_current = parsed.data.isCurrent;
  const { error } = await ctx.supabase.from("eval_cycles").update(patch).eq("id", parsed.data.id);
  if (error) return { ok: false, error: dbMessage(error.message) };
  return done();
}
