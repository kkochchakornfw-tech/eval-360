"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getProfile } from "@/lib/session";
import { canAdmin, minSecretLength } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { firstError } from "@/lib/validation";
import type { Profile, StaffGroup } from "@/types/database";

/**
 * Everyone signs in with a numeric PIN: 6 digits for staff, 8 digits for heads and admins
 * (their accounts can see every score). The sign-in address is an internal, never-mailed email.
 * The suffix is the only one migration 0007 lets through when a PIN account is created.
 */
const codeEmail = (profileId: string) => `${profileId}@pin.eval360.local`;

function makePin(digits: number): string {
  return Array.from({ length: digits }, () => String(randomInt(0, 10))).join("");
}

const secretFor = (p: Pick<Profile, "role" | "is_admin">) => makePin(minSecretLength(p));

export interface IssuedSecret {
  id: string;
  name: string;
  group: string;
  secret: string;
}

export type SecretResult = { ok: true; secrets: IssuedSecret[] } | { ok: false; error: string };

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function adminContext(): Promise<
  { ok: true; supabase: Supabase } | { ok: false; error: string }
> {
  const profile = await getProfile();
  if (!profile || !profile.is_active || !canAdmin(profile)) {
    return { ok: false, error: "ไม่มีสิทธิ์ดำเนินการ" };
  }
  return { ok: true, supabase: await createClient() };
}

async function groupNames(supabase: Supabase): Promise<Map<number, string>> {
  const { data } = await supabase.from("staff_groups").select("id,name");
  return new Map(((data ?? []) as Pick<StaffGroup, "id" | "name">[]).map((g) => [g.id, g.name]));
}

/** Creates a name + PIN account for one person who has no login yet. */
async function provision(
  supabase: Supabase,
  person: Profile,
): Promise<{ ok: true; secret: string } | { ok: false; error: string }> {
  const email = codeEmail(person.id);
  const secret = secretFor(person);

  // The profile is re-linked to the new auth user by this email (see migrations 0002 and 0007)
  const { error: setErr } = await supabase
    .from("profiles")
    .update({ email, code_login: true, must_change_password: true })
    .eq("id", person.id);
  if (setErr) return { ok: false, error: `${person.full_name}: บันทึกไม่สำเร็จ` };

  const { error } = await createAdminClient().auth.admin.createUser({
    email,
    password: secret,
    email_confirm: true,
    user_metadata: { full_name: person.full_name },
  });
  if (error) {
    await supabase
      .from("profiles")
      .update({ email: null, code_login: false, must_change_password: false })
      .eq("id", person.id);
    return { ok: false, error: `${person.full_name}: สร้างบัญชีไม่สำเร็จ` };
  }
  return { ok: true, secret };
}

function describe(person: Profile, groups: Map<number, string>, secret: string): IssuedSecret {
  const group =
    person.role === "head"
      ? person.is_admin
        ? "แอดมิน"
        : "หัวหน้า"
      : (groups.get(person.staff_group_id ?? -1) ?? "") + (person.is_admin ? " (แอดมิน)" : "");
  return { id: person.id, name: person.full_name, group, secret };
}

/** One person, or every active person who has no account yet (when no id is given). */
export async function createAccountsAction(input: unknown): Promise<SecretResult> {
  const ctx = await adminContext();
  if (!ctx.ok) return ctx;
  const parsed = z.object({ id: z.uuid().optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  let q = ctx.supabase.from("profiles").select("*").eq("has_account", false).eq("is_active", true);
  if (parsed.data.id) q = q.eq("id", parsed.data.id);
  const { data } = await q.order("role").order("full_name");
  const people = (data ?? []) as Profile[];
  if (people.length === 0) return { ok: false, error: "ไม่มีรายชื่อที่ต้องสร้างบัญชี" };

  const groups = await groupNames(ctx.supabase);
  const secrets: IssuedSecret[] = [];
  const failures: string[] = [];
  for (const person of people) {
    const res = await provision(ctx.supabase, person);
    if (res.ok) secrets.push(describe(person, groups, res.secret));
    else failures.push(res.error);
  }
  revalidatePath("/settings");
  if (secrets.length === 0) return { ok: false, error: failures[0] ?? "สร้างบัญชีไม่สำเร็จ" };
  return { ok: true, secrets };
}

const addPersonSchema = z
  .object({
    fullName: z.string().trim().min(1, "กรุณากรอกชื่อ").max(120),
    role: z.enum(["head", "staff", "admin"]),
    staffGroupId: z.number().int().positive().nullable(),
    countsInScore: z.boolean(),
  })
  .refine((v) => v.role !== "staff" || v.staffGroupId !== null, {
    message: "กรุณาเลือกกลุ่มของพนักงาน",
    path: ["staffGroupId"],
  });

/** Adds a person (no email needed) and creates their account in one step. */
export async function addPersonAction(input: unknown): Promise<SecretResult> {
  const ctx = await adminContext();
  if (!ctx.ok) return ctx;
  const parsed = addPersonSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const v = parsed.data;

  const { data, error } = await ctx.supabase
    .from("profiles")
    .insert({
      full_name: v.fullName,
      role: v.role === "staff" ? "staff" : "head",
      staff_group_id: v.role === "staff" ? v.staffGroupId : null,
      // an admin is a system watcher: never counted in any score
      counts_in_score: v.role === "admin" ? false : v.countsInScore,
      is_admin: v.role === "admin",
      has_account: false,
    })
    .select("*")
    .single();
  if (error || !data) return { ok: false, error: "เพิ่มรายชื่อไม่สำเร็จ" };

  const person = data as Profile;
  const res = await provision(ctx.supabase, person);
  if (!res.ok) {
    await ctx.supabase.from("profiles").delete().eq("id", person.id);
    return { ok: false, error: res.error };
  }
  revalidatePath("/settings");
  return { ok: true, secrets: [describe(person, await groupNames(ctx.supabase), res.secret)] };
}

/**
 * Replaces someone's PIN with a fresh generated one and forces a change at next sign-in.
 * An account that used to sign in by email is switched to name + PIN here.
 */
export async function resetSecretAction(input: unknown): Promise<SecretResult> {
  const ctx = await adminContext();
  if (!ctx.ok) return ctx;
  const parsed = z.object({ id: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const { data } = await ctx.supabase.from("profiles").select("*").eq("id", parsed.data.id).maybeSingle();
  const person = data as Profile | null;
  if (!person) return { ok: false, error: "ไม่พบผู้ใช้" };
  if (!person.has_account) return { ok: false, error: "คนนี้ยังไม่มีบัญชี" };

  const secret = secretFor(person);
  const { error } = await createAdminClient().auth.admin.updateUserById(person.id, { password: secret });
  if (error) return { ok: false, error: "รีเซ็ตรหัสไม่สำเร็จ" };
  await ctx.supabase
    .from("profiles")
    .update({ must_change_password: true, code_login: true })
    .eq("id", person.id);

  // a fresh PIN also clears any wrong-PIN lock on this person
  failures.delete(person.id);
  revalidatePath("/settings");
  return { ok: true, secrets: [describe(person, await groupNames(ctx.supabase), secret)] };
}

export interface LoginPerson {
  id: string;
  name: string;
  group: string;
}

/** Public: names that can sign in with name + PIN. Contains no email and no secret. */
export async function listLoginPeopleAction(): Promise<LoginPerson[]> {
  const admin = createAdminClient();
  const [{ data: people, error: peopleErr }, { data: groups }] = await Promise.all([
    admin
      .from("profiles")
      .select("id,full_name,role,staff_group_id,is_admin")
      .eq("code_login", true)
      .eq("has_account", true)
      .eq("is_active", true)
      .order("full_name"),
    admin.from("staff_groups").select("id,name"),
  ]);
  if (peopleErr) console.error("listLoginPeopleAction:", peopleErr.message);
  const names = new Map((groups ?? []).map((g) => [g.id as number, g.name as string]));
  return (people ?? []).map((p) => ({
    id: p.id as string,
    name: p.full_name as string,
    group:
      p.role === "head"
        ? p.is_admin
          ? "แอดมิน"
          : "หัวหน้า"
        : (names.get(p.staff_group_id as number) ?? "พนักงาน"),
  }));
}

// Wrong-PIN throttle per person: 5 misses lock that name for 5 minutes (in memory, per server).
const MAX_MISSES = 5;
const LOCK_MS = 5 * 60 * 1000;
const failures = new Map<string, { misses: number; until: number }>();

export type SignInResult = { ok: true } | { ok: false; error: string };

/** Signs in by profile id + PIN on the server, so no email ever reaches the browser. */
export async function signInByNameAction(input: unknown): Promise<SignInResult> {
  const parsed = z
    .object({ id: z.uuid(), secret: z.string().min(1).max(72) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "กรุณาเลือกชื่อและกรอกรหัส" };
  const { id, secret } = parsed.data;

  const state = failures.get(id);
  if (state && state.until > Date.now()) {
    const mins = Math.ceil((state.until - Date.now()) / 60000);
    return { ok: false, error: `ใส่รหัสผิดหลายครั้ง กรุณารอ ${mins} นาที หรือให้หัวหน้าสร้างรหัสใหม่ให้` };
  }

  const { data: person } = await createAdminClient()
    .from("profiles")
    .select("email,code_login,has_account,is_active")
    .eq("id", id)
    .maybeSingle();

  let ok = false;
  if (person?.email && person.code_login && person.has_account && person.is_active) {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: person.email, password: secret });
    ok = !error;
  }

  if (!ok) {
    // a lock that has run out starts counting from zero again
    const previous = state && !(state.until > 0 && state.until <= Date.now()) ? state.misses : 0;
    const misses = previous + 1;
    failures.set(id, { misses, until: misses >= MAX_MISSES ? Date.now() + LOCK_MS : 0 });
    return { ok: false, error: "ชื่อหรือรหัสไม่ถูกต้อง" };
  }
  failures.delete(id);
  return { ok: true };
}

export type PasswordResult = { ok: true; email: string | null } | { ok: false; error: string };

/** Sets the signed-in user's own PIN (digits only; 6+ for staff, 8+ for heads and admins). */
export async function changeSecretAction(input: unknown): Promise<PasswordResult> {
  const profile = await getProfile();
  if (!profile || !profile.is_active) return { ok: false, error: "กรุณาเข้าสู่ระบบ" };

  const min = minSecretLength(profile);
  const parsed = z
    .object({
      secret: z
        .string()
        .regex(/^[0-9]+$/, "PIN ต้องเป็นตัวเลขเท่านั้น")
        .min(min, `PIN ต้องมีอย่างน้อย ${min} หลัก`)
        .max(20, "PIN ยาวเกินไป"),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(profile.id, { password: parsed.data.secret });
  if (error) return { ok: false, error: "ตั้งรหัสไม่สำเร็จ กรุณาลองใหม่" };
  await admin.from("profiles").update({ must_change_password: false }).eq("id", profile.id);
  return { ok: true, email: profile.email };
}
