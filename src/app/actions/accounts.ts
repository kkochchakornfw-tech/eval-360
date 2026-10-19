"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getProfile } from "@/lib/session";
import { canAdmin } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { emailSchema, firstError } from "@/lib/validation";

export type AddPersonResult = { ok: true } | { ok: false; error: string };

const addPersonSchema = z
  .object({
    fullName: z.string().trim().min(1, "กรุณากรอกชื่อ").max(120),
    googleEmail: z.union([z.literal(""), emailSchema]).optional(),
    role: z.enum(["head", "staff", "admin"]),
    staffGroupId: z.number().int().positive().nullable(),
    countsInScore: z.boolean(),
  })
  .refine((v) => v.role !== "staff" || v.staffGroupId !== null, {
    message: "กรุณาเลือกกลุ่มของพนักงาน",
    path: ["staffGroupId"],
  });

/**
 * Adds a person to the roster. They sign in with Google using `googleEmail`; the first sign-in
 * links their profile (migration 0005), so no account or password is created here.
 */
export async function addPersonAction(input: unknown): Promise<AddPersonResult> {
  const profile = await getProfile();
  if (!profile || !profile.is_active || !canAdmin(profile)) {
    return { ok: false, error: "ไม่มีสิทธิ์ดำเนินการ" };
  }
  const parsed = addPersonSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").insert({
    full_name: v.fullName,
    google_email: v.googleEmail || null,
    role: v.role === "staff" ? "staff" : "head",
    staff_group_id: v.role === "staff" ? v.staffGroupId : null,
    // an admin is a system watcher: never counted in any score
    counts_in_score: v.role === "admin" ? false : v.countsInScore,
    is_admin: v.role === "admin",
    has_account: false,
  });
  if (error) {
    const duplicate = error.code === "23505";
    return { ok: false, error: duplicate ? "อีเมล Google นี้ถูกใช้กับคนอื่นแล้ว" : "เพิ่มรายชื่อไม่สำเร็จ" };
  }
  revalidatePath("/settings");
  return { ok: true };
}
