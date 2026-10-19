import { describe, expect, it } from "vitest";
import {
  computeScores,
  formatScore,
  sortDescNullsLast,
  type CoreEvaluationInput,
  type HeadAssessmentInput,
  type ScoreInput,
} from "@/lib/scoring";

const weights = { headWeight: 50, coreWeight: 30, jobWeight: 35, kpiWeight: 35 };

const peer = (score: number, q = 1): CoreEvaluationInput => ({
  evaluatorRole: "staff",
  countsInScore: true,
  scores: { [q]: score },
});
const head = (score: number, countsInScore = true, q = 1): CoreEvaluationInput => ({
  evaluatorRole: "head",
  countsInScore,
  scores: { [q]: score },
});
const assess = (
  jobScores: Record<number, number>,
  kpiPercent: number,
  countsInScore = true,
): HeadAssessmentInput => ({ countsInScore, jobScores, kpiPercent });

function base(over: Partial<ScoreInput> = {}): ScoreInput {
  // 10 peers sum to 40 -> avg 4.0
  const peers = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4].map((s) => peer(s));
  return {
    weights,
    coreQuestionIds: [1],
    jobItems: [{ id: 1, weight: 100 }],
    coreEvaluations: [...peers, head(4)],
    headAssessments: [assess({ 1: 4 }, 90)],
    ...over,
  };
}

describe("computeScores — worked example (CLAUDE.md 4.6)", () => {
  const r = computeScores(base());
  it("core", () => {
    expect(r.core5).toBeCloseTo(4.0, 10);
    expect(r.corePct).toBeCloseTo(24.0, 10);
  });
  it("job", () => {
    expect(r.jobRaw).toBe(400);
    expect(r.jobMax).toBe(500);
    expect(r.job5).toBeCloseTo(4.0, 10);
    expect(r.jobPct).toBeCloseTo(28.0, 10);
  });
  it("kpi", () => {
    expect(r.kpi5).toBeCloseTo(4.5, 10);
    expect(r.kpiPct).toBeCloseTo(31.5, 10);
  });
  it("total", () => {
    expect(r.total100).toBeCloseTo(83.5, 10);
    expect(r.total5).toBeCloseTo(4.175, 10);
    expect(formatScore(r.total5)).toBe("4.18");
  });
});

describe("Core", () => {
  it("combines peer avg and head with wHead", () => {
    const r = computeScores(base({ coreEvaluations: [peer(3), peer(5), head(2)] }));
    // peerAvg 4, head 2 => 4*.5 + 2*.5 = 3
    expect(r.core5).toBeCloseTo(3, 10);
    expect(r.coreByQuestion[1]).toEqual({ peerAvg: 4, headScore: 2, combined: 3 });
  });

  it("wHead = 0.6", () => {
    const r = computeScores(
      base({
        weights: { ...weights, headWeight: 60 },
        coreEvaluations: [peer(3), head(5)],
      }),
    );
    // 3*.4 + 5*.6 = 4.2
    expect(r.core5).toBeCloseTo(4.2, 10);
    expect(r.corePct).toBeCloseTo((4.2 / 5) * 30, 10);
  });

  it("averages multiple counted heads", () => {
    const r = computeScores(base({ coreEvaluations: [peer(4), head(2), head(4)] }));
    expect(r.coreByQuestion[1].headScore).toBe(3);
    expect(r.core5).toBeCloseTo(3.5, 10);
  });

  it("averages over several questions", () => {
    const r = computeScores(
      base({
        coreQuestionIds: [1, 2],
        coreEvaluations: [
          { evaluatorRole: "staff", countsInScore: true, scores: { 1: 2, 2: 4 } },
          { evaluatorRole: "head", countsInScore: true, scores: { 1: 4, 2: 4 } },
        ],
      }),
    );
    // q1: 3, q2: 4 => 3.5
    expect(r.core5).toBeCloseTo(3.5, 10);
  });

  it("head with counts_in_score=false is excluded entirely", () => {
    const withIgnored = computeScores(
      base({ coreEvaluations: [peer(4), head(4), head(1, false)] }),
    );
    const without = computeScores(base({ coreEvaluations: [peer(4), head(4)] }));
    expect(withIgnored).toEqual(without);
  });

  it("head assessment with counts_in_score=false does not change Job/KPI", () => {
    const withIgnored = computeScores(
      base({ headAssessments: [assess({ 1: 4 }, 90), assess({ 1: 1 }, 0, false)] }),
    );
    const without = computeScores(base());
    expect(withIgnored).toEqual(without);
  });

  it("only a non-counting head => peers still show, Job/KPI wait (never zero)", () => {
    const r = computeScores(
      base({
        coreEvaluations: [peer(4), head(5, false)],
        headAssessments: [assess({ 1: 5 }, 100, false)],
      }),
    );
    // the ignored head changes nothing: Core is the peer average alone
    expect(r.core5).toBeCloseTo(4, 10);
    expect(r.corePartial).toBe(true);
    expect(r.job5).toBeNull();
    expect(r.kpi5).toBeNull();
    expect(r.total100).toBeCloseTo(24, 10);
    expect(r.isComplete).toBe(false);
    expect(r.availablePoints).toBe(30);
  });

  it("no peers yet => Core uses the head's score alone and the total still shows", () => {
    const r = computeScores(base({ coreEvaluations: [head(4)] }));
    expect(r.core5).toBeCloseTo(4, 10);
    expect(r.corePct).toBeCloseTo(24, 10);
    expect(r.corePartial).toBe(true);
    expect(r.jobPct).toBeCloseTo(28, 10);
    expect(r.kpiPct).toBeCloseTo(31.5, 10);
    expect(r.total100).toBeCloseTo(83.5, 10);
    expect(r.isComplete).toBe(false);
    expect(r.availablePoints).toBe(100);
  });

  it("peers only (no head yet) => score shows right away from the peer average", () => {
    const r = computeScores(base({ coreEvaluations: [peer(4), peer(2)], headAssessments: [] }));
    expect(r.core5).toBeCloseTo(3, 10);
    expect(r.corePct).toBeCloseTo(18, 10);
    expect(r.job5).toBeNull();
    expect(r.kpi5).toBeNull();
    expect(r.total100).toBeCloseTo(18, 10);
    expect(r.total5).toBeCloseTo(0.9, 10);
    expect(r.isComplete).toBe(false);
    expect(r.availablePoints).toBe(30);
  });

  it("updates as evaluations arrive one by one", () => {
    const totals = [[peer(5)], [peer(5), peer(3)], [peer(5), peer(3), head(4)]].map(
      (evals) => computeScores(base({ coreEvaluations: evals, headAssessments: [] })).core5,
    );
    expect(totals[0]).toBeCloseTo(5, 10);
    expect(totals[1]).toBeCloseTo(4, 10);
    // head joins: blend of peer avg 4 and head 4
    expect(totals[2]).toBeCloseTo(4, 10);
  });

  it("is complete only when peers, head, Job Base and KPI all exist", () => {
    expect(computeScores(base()).isComplete).toBe(true);
    expect(computeScores(base({ headAssessments: [] })).isComplete).toBe(false);
  });

  it("nobody evaluated yet", () => {
    const r = computeScores(base({ coreEvaluations: [], headAssessments: [] }));
    expect(r.total100).toBeNull();
    expect(r.total5).toBeNull();
    expect(r.peerCount).toBe(0);
  });
});

describe("Job Base", () => {
  it("weights not summing to 100 use actual max", () => {
    const r = computeScores(
      base({
        jobItems: [
          { id: 1, weight: 10 },
          { id: 2, weight: 20 },
        ],
        headAssessments: [assess({ 1: 5, 2: 3 }, 50)],
      }),
    );
    // raw = 50 + 60 = 110; max = 5*30 = 150
    expect(r.jobRaw).toBe(110);
    expect(r.jobMax).toBe(150);
    expect(r.job5).toBeCloseTo((110 / 150) * 5, 10);
    expect(r.jobPct).toBeCloseTo((110 / 150) * 35, 10);
    expect(r.jobByItem[1]).toBeCloseTo(10, 10);
    expect(r.jobByItem[2]).toBeCloseTo(12, 10);
  });

  it("averages multiple counted heads", () => {
    const r = computeScores(
      base({ headAssessments: [assess({ 1: 2 }, 40), assess({ 1: 4 }, 80)] }),
    );
    expect(r.jobRaw).toBe(300);
    expect(r.kpiPercent).toBe(60);
  });

  it("follows cycle proportion settings", () => {
    const r = computeScores(
      base({ weights: { headWeight: 50, coreWeight: 20, jobWeight: 50, kpiWeight: 30 } }),
    );
    expect(r.corePct).toBeCloseTo((4 / 5) * 20, 10);
    expect(r.jobPct).toBeCloseTo(0.8 * 50, 10);
    expect(r.kpiPct).toBeCloseTo(0.9 * 30, 10);
  });
});

describe("KPI", () => {
  it("0%", () => {
    const r = computeScores(base({ headAssessments: [assess({ 1: 4 }, 0)] }));
    expect(r.kpi5).toBe(0);
    expect(r.kpiPct).toBe(0);
    expect(r.total100).toBeCloseTo(24 + 28, 10);
  });
  it("100%", () => {
    const r = computeScores(base({ headAssessments: [assess({ 1: 4 }, 100)] }));
    expect(r.kpi5).toBe(5);
    expect(r.kpiPct).toBe(35);
  });
  it("accepts decimals", () => {
    const r = computeScores(base({ headAssessments: [assess({ 1: 4 }, 87.5)] }));
    expect(r.kpi5).toBeCloseTo(4.375, 10);
  });
});

describe("helpers", () => {
  it("formatScore", () => {
    expect(formatScore(null)).toBe("รอข้อมูล");
    expect(formatScore(83.5)).toBe("83.50");
  });
  it("sortDescNullsLast puts nulls last and is stable", () => {
    const rows = [
      { n: "a", v: null },
      { n: "b", v: 3 },
      { n: "c", v: 5 },
      { n: "d", v: 3 },
      { n: "e", v: null },
    ];
    expect(sortDescNullsLast(rows, (r) => r.v).map((r) => r.n)).toEqual([
      "c",
      "b",
      "d",
      "a",
      "e",
    ]);
  });
});

describe("computeScores — rounded Core and raw Job Base", () => {
  it("rounds each question half-up before averaging", () => {
    // q1: peers 4, head 5 -> 4.5 -> 5 ; q2: peers 3, head 4 -> 3.5 -> 4 ; q3: 2.4 -> 2
    const ev = (a: number, b: number, c: number, role: "staff" | "head"): CoreEvaluationInput => ({
      evaluatorRole: role,
      countsInScore: true,
      scores: { 1: a, 2: b, 3: c },
    });
    const r = computeScores(
      base({
        coreQuestionIds: [1, 2, 3],
        coreEvaluations: [ev(4, 3, 2, "staff"), ev(5, 4, 3, "head")],
      }),
    );
    expect(r.coreRoundedByQuestion).toEqual({ 1: 5, 2: 4, 3: 3 });
    expect(r.core5Rounded).toBeCloseTo(4, 10);
    // 2.5 rounds up too
    expect(r.coreByQuestion[3].combined).toBeCloseTo(2.5, 10);
  });

  it("total100Rounded uses the rounded Core", () => {
    const r = computeScores(base({ coreEvaluations: [peer(3), head(4)] })); // 3.5 -> 4
    expect(r.core5).toBeCloseTo(3.5, 10);
    expect(r.core5Rounded).toBe(4);
    expect(r.total100Rounded).toBeCloseTo(24 + 28 + 31.5, 10);
  });

  it("no data -> null", () => {
    const r = computeScores(base({ coreEvaluations: [], headAssessments: [] }));
    expect(r.core5Rounded).toBeNull();
    expect(r.total100Rounded).toBeNull();
  });

  it("exposes the raw 1-5 Job Base score per item", () => {
    const r = computeScores(
      base({ jobItems: [{ id: 1, weight: 60 }, { id: 2, weight: 40 }], headAssessments: [assess({ 1: 4, 2: 3 }, 90)] }),
    );
    expect(r.jobRawByItem).toEqual({ 1: 4, 2: 3 });
  });
});

describe("computeScores — rounded summary figures", () => {
  it("corePctRounded and total5Rounded follow the rounded Core", () => {
    const r = computeScores(base({ coreEvaluations: [peer(3), head(4)] })); // 3.5 -> 4
    expect(r.corePctRounded).toBeCloseTo(24, 10);
    expect(r.total5Rounded).toBeCloseTo(((24 + 28 + 31.5) / 100) * 5, 10);
  });
});
