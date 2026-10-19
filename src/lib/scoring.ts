/**
 * Pure scoring functions. No I/O.
 * Full precision throughout; round only when displaying (see formatScore).
 * `null` means "waiting for data" (รอข้อมูล).
 */

export interface CycleWeights {
  /** Head weight for Core, 0-100 */
  headWeight: number;
  /** Category proportions, sum to 100 */
  coreWeight: number;
  jobWeight: number;
  kpiWeight: number;
}

export interface CoreEvaluationInput {
  evaluatorRole: "head" | "staff";
  /** Only meaningful for heads; false = excluded from every calculation */
  countsInScore: boolean;
  /** question id -> score 1..5 */
  scores: Record<number, number>;
}

export interface HeadAssessmentInput {
  countsInScore: boolean;
  /** job item id -> score 1..5 */
  jobScores: Record<number, number>;
  /** 0..100 */
  kpiPercent: number;
}

export interface JobItemInput {
  id: number;
  weight: number;
}

export interface ScoreInput {
  weights: CycleWeights;
  coreQuestionIds: number[];
  jobItems: JobItemInput[];
  coreEvaluations: CoreEvaluationInput[];
  headAssessments: HeadAssessmentInput[];
}

export interface CoreQuestionScore {
  peerAvg: number | null;
  headScore: number | null;
  combined: number | null;
}

export interface ScoreResult {
  core5: number | null;
  job5: number | null;
  kpi5: number | null;
  corePct: number | null;
  jobPct: number | null;
  kpiPct: number | null;
  /** Sum of the categories that have data so far (provisional until `isComplete`) */
  total100: number | null;
  total5: number | null;
  /** True when Core (peers AND head), Job Base and KPI all have data */
  isComplete: boolean;
  /** Core is based on only one side (peers or head) so far */
  corePartial: boolean;
  /** Share of the 100 points that already has data (e.g. 30 when only Core exists) */
  availablePoints: number;
  /** Core detail per question id */
  coreByQuestion: Record<number, CoreQuestionScore>;
  /** Weighted contribution per job item: score/5 * weight (head-average) */
  jobByItem: Record<number, number | null>;
  /** Raw 1-5 score per job item (head-average, normally a single head) */
  jobRawByItem: Record<number, number | null>;
  /** Core per question rounded half-up to a whole number (used by the chart and report) */
  coreRoundedByQuestion: Record<number, number | null>;
  /** Average of the rounded per-question Core scores (out of 5) */
  core5Rounded: number | null;
  /** Core share of the total computed from `core5Rounded` */
  corePctRounded: number | null;
  /** Total out of 100 computed from `core5Rounded` instead of `core5` */
  total100Rounded: number | null;
  total5Rounded: number | null;
  jobRaw: number | null;
  jobMax: number;
  kpiPercent: number | null;
  peerCount: number;
  headCoreCount: number;
  headAssessmentCount: number;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function computeScores(input: ScoreInput): ScoreResult {
  const { weights, coreQuestionIds, jobItems } = input;
  const wHead = weights.headWeight / 100;
  const wPeer = 1 - wHead;

  const peers = input.coreEvaluations.filter((e) => e.evaluatorRole === "staff");
  const heads = input.coreEvaluations.filter(
    (e) => e.evaluatorRole === "head" && e.countsInScore,
  );
  const assessments = input.headAssessments.filter((a) => a.countsInScore);

  // ---- Core ----
  const coreByQuestion: Record<number, CoreQuestionScore> = {};
  const combinedList: number[] = [];
  for (const q of coreQuestionIds) {
    const peerAvg = mean(peers.map((e) => e.scores[q]).filter((s) => s !== undefined));
    const headScore = mean(heads.map((e) => e.scores[q]).filter((s) => s !== undefined));
    // Both sides present: weighted blend. Only one side so far: use it as is (provisional).
    const combined =
      peerAvg !== null && headScore !== null
        ? peerAvg * wPeer + headScore * wHead
        : (peerAvg ?? headScore);
    coreByQuestion[q] = { peerAvg, headScore, combined };
    if (combined !== null) combinedList.push(combined);
  }
  const core5 = mean(combinedList);
  const coreRoundedByQuestion: Record<number, number | null> = {};
  for (const q of coreQuestionIds) {
    const c = coreByQuestion[q].combined;
    coreRoundedByQuestion[q] = c === null ? null : roundHalfUp(c, 0);
  }
  const core5Rounded = mean(
    Object.values(coreRoundedByQuestion).filter((v): v is number => v !== null),
  );
  const corePartial = core5 !== null && (peers.length === 0 || heads.length === 0);

  // ---- Job Base ----
  const jobMax = 5 * jobItems.reduce((sum, i) => sum + i.weight, 0);
  const jobByItem: Record<number, number | null> = {};
  const jobRawByItem: Record<number, number | null> = {};
  let jobRaw: number | null = null;
  if (assessments.length > 0) {
    jobRaw = 0;
    for (const item of jobItems) {
      const s = mean(
        assessments.map((a) => a.jobScores[item.id]).filter((v) => v !== undefined),
      );
      jobRawByItem[item.id] = s;
      jobByItem[item.id] = s === null ? null : (s / 5) * item.weight;
      if (s !== null) jobRaw += s * item.weight;
    }
  } else {
    for (const item of jobItems) {
      jobByItem[item.id] = null;
      jobRawByItem[item.id] = null;
    }
  }
  const job5 = jobRaw !== null && jobMax > 0 ? (jobRaw / jobMax) * 5 : null;
  const jobPct = jobRaw !== null && jobMax > 0 ? (jobRaw / jobMax) * weights.jobWeight : null;

  // ---- KPI ----
  const kpiPercent = mean(assessments.map((a) => a.kpiPercent));
  const kpi5 = kpiPercent === null ? null : (kpiPercent / 100) * 5;
  const kpiPct = kpiPercent === null ? null : (kpiPercent / 100) * weights.kpiWeight;

  const corePct = core5 === null ? null : (core5 / 5) * weights.coreWeight;

  // Provisional total: add up whatever categories have data, so scores show as soon as anyone evaluates
  const parts: [number | null, number][] = [
    [corePct, weights.coreWeight],
    [jobPct, weights.jobWeight],
    [kpiPct, weights.kpiWeight],
  ];
  const present = parts.filter(([v]) => v !== null);
  const total100 = present.length === 0 ? null : present.reduce((sum, [v]) => sum + (v as number), 0);
  const total5 = total100 === null ? null : (total100 / 100) * 5;
  const availablePoints = present.reduce((sum, [, w]) => sum + w, 0);
  const isComplete = present.length === 3 && !corePartial;
  const corePctRounded = core5Rounded === null ? null : (core5Rounded / 5) * weights.coreWeight;
  const presentRounded = [corePctRounded, jobPct, kpiPct].filter((v): v is number => v !== null);
  const total100Rounded =
    presentRounded.length === 0 ? null : presentRounded.reduce((a, b) => a + b, 0);
  const total5Rounded = total100Rounded === null ? null : (total100Rounded / 100) * 5;

  return {
    core5,
    job5,
    kpi5,
    corePct,
    jobPct,
    kpiPct,
    total100,
    total5,
    isComplete,
    corePartial,
    availablePoints,
    coreByQuestion,
    jobByItem,
    jobRawByItem,
    coreRoundedByQuestion,
    core5Rounded,
    corePctRounded,
    total100Rounded,
    total5Rounded,
    jobRaw,
    jobMax,
    kpiPercent,
    peerCount: peers.length,
    headCoreCount: heads.length,
    headAssessmentCount: assessments.length,
  };
}

/** Display helper: 2 decimals, or "รอข้อมูล" when null. */
export function formatScore(value: number | null, digits = 2): string {
  return value === null ? "รอข้อมูล" : roundHalfUp(value, digits).toFixed(digits);
}

/** Decimal-safe rounding so 4.175 -> 4.18 (plain toFixed gives 4.17). */
export function roundHalfUp(value: number, digits = 2): number {
  const shifted = Number(`${Math.abs(value)}e${digits}`);
  if (!Number.isFinite(shifted)) return value;
  const rounded = Number(`${Math.round(shifted)}e-${digits}`);
  return value < 0 ? -rounded : rounded;
}

/** Sort descending by value; nulls (รอข้อมูล) always last. Stable on ties. */
export function sortDescNullsLast<T>(items: T[], pick: (item: T) => number | null): T[] {
  return items
    .map((item, index) => ({ item, index, v: pick(item) }))
    .sort((a, b) => {
      if (a.v === null && b.v === null) return a.index - b.index;
      if (a.v === null) return 1;
      if (b.v === null) return -1;
      return b.v - a.v || a.index - b.index;
    })
    .map((x) => x.item);
}
