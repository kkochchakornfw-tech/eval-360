import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCoreStructure, getJobItems } from "@/lib/data";
import type {
  CoreAnswer,
  CoreGroupWithQuestions,
  EvalCycle,
  Evaluation,
  HeadAssessment,
  JobAnswer,
  JobItem,
} from "@/types/database";

export interface FormData {
  groups: CoreGroupWithQuestions[];
  jobItems: JobItem[];
  initialCore: Record<number, number>;
  initialJob: Record<number, number>;
  initialKpi: number | null;
  existing: boolean;
}

/** Loads the question structure plus any answers already saved by `evaluatorId` for `evaluateeId`. */
export async function loadFormData(
  supabase: SupabaseClient,
  opts: {
    cycle: EvalCycle;
    evaluatorId: string;
    evaluateeId: string;
    evaluateeGroupId: number | null;
    kind: "core" | "head";
  },
): Promise<FormData> {
  const { cycle, evaluatorId, evaluateeId, kind } = opts;
  const groups = await getCoreStructure(supabase, cycle.id);
  const jobItems =
    kind === "head" && opts.evaluateeGroupId != null
      ? await getJobItems(supabase, cycle.id, opts.evaluateeGroupId)
      : [];

  const { data: evalRow } = await supabase
    .from("evaluations")
    .select("*")
    .eq("cycle_id", cycle.id)
    .eq("evaluator_id", evaluatorId)
    .eq("evaluatee_id", evaluateeId)
    .maybeSingle();
  const evaluation = evalRow as Evaluation | null;

  const initialCore: Record<number, number> = {};
  if (evaluation) {
    const { data } = await supabase
      .from("core_answers")
      .select("*")
      .eq("evaluation_id", evaluation.id);
    for (const a of (data ?? []) as CoreAnswer[]) initialCore[a.question_id] = a.score;
  }

  const initialJob: Record<number, number> = {};
  let initialKpi: number | null = null;
  let hasAssessment = false;
  if (kind === "head") {
    const { data: aRow } = await supabase
      .from("head_assessments")
      .select("*")
      .eq("cycle_id", cycle.id)
      .eq("assessor_id", evaluatorId)
      .eq("evaluatee_id", evaluateeId)
      .maybeSingle();
    const assessment = aRow as HeadAssessment | null;
    if (assessment) {
      hasAssessment = true;
      initialKpi = Number(assessment.kpi_percent);
      const { data } = await supabase
        .from("job_answers")
        .select("*")
        .eq("head_assessment_id", assessment.id);
      for (const a of (data ?? []) as JobAnswer[]) initialJob[a.job_item_id] = a.score;
    }
  }

  return {
    groups,
    jobItems,
    initialCore,
    initialJob,
    initialKpi,
    existing: kind === "head" ? hasAssessment || evaluation !== null : evaluation !== null,
  };
}
