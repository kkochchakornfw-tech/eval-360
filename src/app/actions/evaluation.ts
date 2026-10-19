"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { firstError } from "@/lib/validation";
import { dbMessage } from "@/lib/errors";

export type ActionResult = { ok: true } | { ok: false; error: string };

const scoreMap = z.record(z.string().regex(/^\d+$/), z.number().int().min(1).max(5));

const coreInput = z.object({
  cycleId: z.number().int().positive(),
  evaluateeId: z.uuid(),
  evaluatorId: z.uuid().optional(),
  answers: scoreMap,
});

const headInput = z.object({
  cycleId: z.number().int().positive(),
  evaluateeId: z.uuid(),
  evaluatorId: z.uuid().optional(),
  core: scoreMap,
  job: scoreMap,
  kpi: z.number().min(0, "KPI ต้องอยู่ระหว่าง 0-100").max(100, "KPI ต้องอยู่ระหว่าง 0-100"),
});

export async function submitEvaluationAction(input: unknown): Promise<ActionResult> {
  const parsed = coreInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_evaluation", {
    p_cycle_id: v.cycleId,
    p_evaluatee_id: v.evaluateeId,
    p_answers: v.answers,
    p_evaluator_id: v.evaluatorId ?? null,
  });
  if (error) return { ok: false, error: dbMessage(error.message) };
  revalidatePath("/evaluate");
  revalidatePath("/data");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function submitHeadAssessmentAction(input: unknown): Promise<ActionResult> {
  const parsed = headInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_head_assessment", {
    p_cycle_id: v.cycleId,
    p_evaluatee_id: v.evaluateeId,
    p_core: v.core,
    p_job: v.job,
    p_kpi: v.kpi,
    p_assessor_id: v.evaluatorId ?? null,
  });
  if (error) return { ok: false, error: dbMessage(error.message) };
  revalidatePath("/assess");
  revalidatePath("/data");
  revalidatePath("/dashboard");
  return { ok: true };
}

const deleteInput = z.object({
  cycleId: z.number().int().positive(),
  evaluatorId: z.uuid(),
  evaluateeId: z.uuid(),
});

export async function deleteEvaluationAction(input: unknown): Promise<ActionResult> {
  const parsed = deleteInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_evaluation_record", {
    p_cycle_id: parsed.data.cycleId,
    p_evaluator_id: parsed.data.evaluatorId,
    p_evaluatee_id: parsed.data.evaluateeId,
  });
  if (error) return { ok: false, error: dbMessage(error.message, "ลบไม่สำเร็จ") };
  revalidatePath("/data");
  revalidatePath("/dashboard");
  return { ok: true };
}
