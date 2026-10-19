import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAll, getCoreStructure, getJobItems } from "@/lib/data";
import {
  computeScores,
  type CoreEvaluationInput,
  type HeadAssessmentInput,
  type ScoreResult,
} from "@/lib/scoring";
import type {
  CoreAnswer,
  CoreGroupWithQuestions,
  EvalCycle,
  Evaluation,
  HeadAssessment,
  JobAnswer,
  JobItem,
  Profile,
  StaffGroup,
} from "@/types/database";

export interface PersonReport {
  profile: Profile;
  groupName: string;
  result: ScoreResult;
  /** staff who have evaluated this person / staff who could */
  peersDone: number;
  peersExpected: number;
  /** every other active staff member has evaluated this person */
  peersComplete: boolean;
  /** a head that counts toward the score has assessed this person */
  headDone: boolean;
  jobItems: JobItem[];
  /** staff (with an account, excluding the person) split by whether they evaluated this person */
  evaluatedBy: EvaluatorRef[];
  notEvaluatedBy: EvaluatorRef[];
}

export interface EvaluatorRef {
  id: string;
  name: string;
  groupName: string;
  /** false = on the roster but cannot sign in yet */
  hasAccount: boolean;
}

export interface EvaluatorProgress extends EvaluatorRef {
  /** how many colleagues this person has evaluated / could evaluate */
  done: number;
  expected: number;
}

export interface ReportData {
  cycle: EvalCycle;
  groups: CoreGroupWithQuestions[];
  staffGroups: StaffGroup[];
  people: PersonReport[];
  /** every staff member who can sign in and evaluate, with their own progress */
  evaluators: EvaluatorProgress[];
}

/** Loads the whole cycle (heads only — RLS hides this from staff) and computes every score. */
export async function buildReport(
  supabase: SupabaseClient,
  cycle: EvalCycle,
  staffGroups: StaffGroup[],
): Promise<ReportData> {
  const [groups, jobItems, profilesRes] = await Promise.all([
    getCoreStructure(supabase, cycle.id),
    getJobItems(supabase, cycle.id),
    supabase.from("profiles").select("*"),
  ]);
  const profiles = (profilesRes.data ?? []) as Profile[];
  const byId = new Map(profiles.map((p) => [p.id, p]));

  // Four independent reads; answers are filtered to this cycle in the database (inner join)
  const [evaluations, coreAnswers, assessments, jobAnswers] = await Promise.all([
    fetchAll<Evaluation>((from, to) =>
      supabase.from("evaluations").select("*").eq("cycle_id", cycle.id).order("id").range(from, to),
    ),
    fetchAll<CoreAnswer>((from, to) =>
      supabase
        .from("core_answers")
        .select("evaluation_id,question_id,score,evaluations!inner(cycle_id)")
        .eq("evaluations.cycle_id", cycle.id)
        .order("evaluation_id")
        .order("question_id")
        .range(from, to),
    ),
    fetchAll<HeadAssessment>((from, to) =>
      supabase
        .from("head_assessments")
        .select("*")
        .eq("cycle_id", cycle.id)
        .order("id")
        .range(from, to),
    ),
    fetchAll<JobAnswer>((from, to) =>
      supabase
        .from("job_answers")
        .select("head_assessment_id,job_item_id,score,head_assessments!inner(cycle_id)")
        .eq("head_assessments.cycle_id", cycle.id)
        .order("head_assessment_id")
        .order("job_item_id")
        .range(from, to),
    ),
  ]);

  const answersByEval = new Map<number, Record<number, number>>();
  for (const a of coreAnswers) {
    const m = answersByEval.get(a.evaluation_id) ?? {};
    m[a.question_id] = a.score;
    answersByEval.set(a.evaluation_id, m);
  }
  const jobByAssessment = new Map<number, Record<number, number>>();
  for (const a of jobAnswers) {
    const m = jobByAssessment.get(a.head_assessment_id) ?? {};
    m[a.job_item_id] = a.score;
    jobByAssessment.set(a.head_assessment_id, m);
  }

  const questionIds = groups.flatMap((g) => g.questions.map((q) => q.id));
  const evaluatees = profiles.filter((p) => p.role === "staff" && p.is_active);
  const groupName = new Map(staffGroups.map((g) => [g.id, g.name]));
  const nameOfGroup = (id: number | null) => groupName.get(id ?? -1) ?? "-";
  // everyone on the roster counts as an expected evaluator, whether or not they have signed in yet
  const evaluators = evaluatees;
  const evaluatedPairs = new Set(evaluations.map((e) => `${e.evaluator_id}>${e.evaluatee_id}`));

  const people: PersonReport[] = evaluatees.map((person) => {
    const coreEvaluations: CoreEvaluationInput[] = [];
    for (const e of evaluations) {
      if (e.evaluatee_id !== person.id) continue;
      const evaluator = byId.get(e.evaluator_id);
      if (!evaluator) continue;
      coreEvaluations.push({
        evaluatorRole: evaluator.role,
        countsInScore: evaluator.counts_in_score,
        scores: answersByEval.get(e.id) ?? {},
      });
    }
    const headAssessments: HeadAssessmentInput[] = [];
    for (const a of assessments) {
      if (a.evaluatee_id !== person.id) continue;
      const assessor = byId.get(a.assessor_id);
      if (!assessor) continue;
      headAssessments.push({
        countsInScore: assessor.counts_in_score,
        jobScores: jobByAssessment.get(a.id) ?? {},
        kpiPercent: Number(a.kpi_percent),
      });
    }
    const personJobItems = jobItems.filter((j) => j.staff_group_id === person.staff_group_id);
    const result = computeScores({
      weights: {
        headWeight: Number(cycle.head_weight),
        coreWeight: Number(cycle.core_weight),
        jobWeight: Number(cycle.job_weight),
        kpiWeight: Number(cycle.kpi_weight),
      },
      coreQuestionIds: questionIds,
      jobItems: personJobItems.map((j) => ({ id: j.id, weight: Number(j.weight) })),
      coreEvaluations,
      headAssessments,
    });
    const others = evaluators.filter((e) => e.id !== person.id);
    const toRef = (e: Profile): EvaluatorRef => ({
      id: e.id,
      name: e.full_name,
      groupName: nameOfGroup(e.staff_group_id),
      hasAccount: e.has_account,
    });
    const evaluatedBy = others.filter((e) => evaluatedPairs.has(`${e.id}>${person.id}`)).map(toRef);
    const notEvaluatedBy = others.filter((e) => !evaluatedPairs.has(`${e.id}>${person.id}`)).map(toRef);
    return {
      profile: person,
      evaluatedBy,
      notEvaluatedBy,
      groupName: nameOfGroup(person.staff_group_id),
      result,
      peersDone: evaluatedBy.length,
      peersExpected: others.length,
      peersComplete: others.length > 0 && notEvaluatedBy.length === 0,
      headDone: result.headAssessmentCount > 0,
      jobItems: personJobItems,
    };
  });

  const evaluatorProgress: EvaluatorProgress[] = evaluators.map((e) => {
    const targets = evaluatees.filter((t) => t.id !== e.id);
    return {
      id: e.id,
      name: e.full_name,
      groupName: nameOfGroup(e.staff_group_id),
      hasAccount: e.has_account,
      done: targets.filter((t) => evaluatedPairs.has(`${e.id}>${t.id}`)).length,
      expected: targets.length,
    };
  });

  return { cycle, groups, staffGroups, people, evaluators: evaluatorProgress };
}
