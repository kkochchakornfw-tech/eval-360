"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { Spinner } from "@/components/Spinner";
import {
  submitEvaluationAction,
  submitHeadAssessmentAction,
} from "@/app/actions/evaluation";
import type { CoreGroupWithQuestions, JobItem } from "@/types/database";

interface Props {
  mode: "core" | "head";
  cycleId: number;
  evaluateeId: string;
  evaluateeName: string;
  /** set when a head edits someone else's record from the data page */
  evaluatorId?: string;
  groups: CoreGroupWithQuestions[];
  jobItems: JobItem[];
  initialCore: Record<number, number>;
  initialJob: Record<number, number>;
  initialKpi: number | null;
  existing: boolean;
  locked: boolean;
  /** show the "not counted" note (head with counts_in_score = false) */
  notCounted?: boolean;
  backHref: string;
  /** head layout has a left sidebar on desktop */
  hasSidebar: boolean;
}

export function RatingInput({
  value,
  onChange,
  disabled,
  label,
}: {
  value: number | undefined;
  onChange: (v: number) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid w-full grid-cols-5 gap-1.5 md:w-[21rem] md:shrink-0"
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const selected = value === n;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(n)}
            className={`h-12 rounded-xl border text-base tabular-nums transition duration-150 disabled:cursor-not-allowed ${
              selected
                ? "border-accent bg-accent font-semibold text-white shadow-glow"
                : "border-line bg-white/80 text-ink hover:border-accent/50 hover:bg-white disabled:text-muted"
            }`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

export function EvalForm(props: Props) {
  const { mode, groups, jobItems, locked } = props;
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [core, setCore] = useState<Record<number, number>>(props.initialCore);
  const [job, setJob] = useState<Record<number, number>>(props.initialJob);
  const [kpi, setKpi] = useState<string>(props.initialKpi === null ? "" : String(props.initialKpi));

  const coreIds = useMemo(() => groups.flatMap((g) => g.questions.map((q) => q.id)), [groups]);
  const jobIds = useMemo(() => jobItems.map((j) => j.id), [jobItems]);

  // The head may type KPI as a percentage or as a score out of 5; it is stored as a percentage.
  const [kpiMode, setKpiMode] = useState<"percent" | "five">("percent");
  const kpiMax = kpiMode === "percent" ? 100 : 5;
  const kpiRaw = kpi.trim() === "" ? null : Number(kpi);
  const kpiValid = kpiRaw !== null && Number.isFinite(kpiRaw) && kpiRaw >= 0 && kpiRaw <= kpiMax;
  const kpiNum = kpiRaw === null ? null : kpiMode === "percent" ? kpiRaw : (kpiRaw / 5) * 100;

  function switchKpiMode(next: "percent" | "five") {
    if (next === kpiMode) return;
    if (kpiNum !== null && kpiValid) {
      const converted = next === "percent" ? kpiNum : (kpiNum / 100) * 5;
      setKpi(String(Math.round(converted * 100) / 100));
    }
    setKpiMode(next);
  }

  const total = coreIds.length + (mode === "head" ? jobIds.length + 1 : 0);
  const done =
    coreIds.filter((id) => core[id] !== undefined).length +
    (mode === "head" ? jobIds.filter((id) => job[id] !== undefined).length + (kpiValid ? 1 : 0) : 0);
  const complete = total > 0 && done === total;

  function save() {
    if (!complete) return toast.error("กรุณาให้คะแนนให้ครบทุกข้อ");
    const toMap = (m: Record<number, number>, ids: number[]) =>
      Object.fromEntries(ids.map((id) => [String(id), m[id]]));

    startTransition(async () => {
      const res =
        mode === "core"
          ? await submitEvaluationAction({
              cycleId: props.cycleId,
              evaluateeId: props.evaluateeId,
              evaluatorId: props.evaluatorId,
              answers: toMap(core, coreIds),
            })
          : await submitHeadAssessmentAction({
              cycleId: props.cycleId,
              evaluateeId: props.evaluateeId,
              evaluatorId: props.evaluatorId,
              core: toMap(core, coreIds),
              job: toMap(job, jobIds),
              kpi: kpiNum,
            });
      if (!res.ok) return toast.error(res.error);
      toast.success("บันทึกผลการประเมินแล้ว");
      router.push(props.backHref);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-xl font-semibold">{props.evaluateeName}</h1>
      <p className="mt-1 text-sm text-muted">
        {mode === "head" ? "Core Competency · Job Base · KPI" : "Core Competency"} · ให้คะแนน 1–5
      </p>

      {props.notCounted && (
        <p className="mt-4 text-xs text-muted">คะแนนของคุณไม่ถูกนำไปคำนวณ</p>
      )}
      {locked && (
        <p className="mt-4 rounded-xl border border-line bg-white/70 px-4 py-3 text-sm text-muted">
          รอบประเมินปิดแล้ว ไม่สามารถแก้ไขได้
        </p>
      )}
      {props.existing && !locked && (
        <p className="mt-4 rounded-xl border border-line bg-white/70 px-4 py-3 text-sm text-muted">
          เคยประเมินคนนี้แล้ว ระบบแสดงคะแนนเดิม แก้ไขแล้วกดบันทึกเพื่อทับข้อมูลเดิม
        </p>
      )}

      <div className="mt-8 space-y-10">
        {groups.map((g) => (
          <section key={g.id}>
            <h2 className="text-sm font-semibold">
              {g.code} · {g.name}
            </h2>
            <div className="mt-3 card divide-y divide-line overflow-hidden">
              {g.questions.map((q, i) => (
                <div key={q.id} className="flex flex-col gap-3 px-5 py-3 md:flex-row md:items-center md:justify-between md:gap-6">
                  <p className="text-sm">
                    <span className="mr-2 text-muted tabular-nums">
                      {g.code}
                      {i + 1}
                    </span>
                    {q.text}
                  </p>
                  <RatingInput
                    label={q.text}
                    value={core[q.id]}
                    disabled={locked}
                    onChange={(v) => setCore((s) => ({ ...s, [q.id]: v }))}
                  />
                </div>
              ))}
            </div>
          </section>
        ))}

        {mode === "head" && (
          <>
            <section>
              <h2 className="text-sm font-semibold">Job Base</h2>
              {jobItems.length === 0 ? (
                <p className="mt-3 text-sm text-muted">ยังไม่มีข้อ Job Base สำหรับกลุ่มนี้</p>
              ) : (
                <div className="mt-3 card divide-y divide-line overflow-hidden">
                  {jobItems.map((j) => (
                    <div key={j.id} className="flex flex-col gap-3 px-5 py-3 md:flex-row md:items-center md:justify-between md:gap-6">
                      <p className="text-sm">
                        {j.text}
                        <span className="ml-2 text-xs text-muted tabular-nums">
                          น้ำหนัก {Number(j.weight)}
                        </span>
                      </p>
                      <RatingInput
                        label={j.text}
                        value={job[j.id]}
                        disabled={locked}
                        onChange={(v) => setJob((s) => ({ ...s, [j.id]: v }))}
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-sm font-semibold">KPI</h2>
              <div className="card mt-3 p-5">
                <div className="mb-3 inline-flex gap-1 rounded-xl border border-line p-1" role="tablist">
                  {(
                    [
                      ["percent", "เปอร์เซ็นต์ (0–100)"],
                      ["five", "คะแนนเต็ม 5 (0–5)"],
                    ] as const
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      role="tab"
                      aria-selected={kpiMode === v}
                      disabled={locked}
                      onClick={() => switchKpiMode(v)}
                      className={`rounded-lg px-4 py-1.5 text-sm transition duration-150 ${
                        kpiMode === v ? "bg-accent font-medium text-white" : "text-muted hover:text-ink"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <label htmlFor="kpi" className="label">
                  {kpiMode === "percent" ? "% KPI ที่ทำได้ (0–100)" : "คะแนน KPI (0–5)"}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="kpi"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={kpiMax}
                    step="any"
                    disabled={locked}
                    value={kpi}
                    onChange={(e) => setKpi(e.target.value)}
                    className="input w-32 text-right tabular-nums"
                  />
                  <span className="text-sm text-muted">{kpiMode === "percent" ? "%" : "/ 5"}</span>
                </div>
                {kpiMode === "five" && kpiValid && kpiNum !== null && (
                  <p className="mt-2 text-xs text-muted">เท่ากับ {Math.round(kpiNum * 100) / 100}%</p>
                )}
                {kpi !== "" && !kpiValid && (
                  <p className="mt-2 text-xs text-danger">ค่า KPI ต้องอยู่ระหว่าง 0 ถึง {kpiMax}</p>
                )}
              </div>
            </section>
          </>
        )}
      </div>

      <div className={`fixed inset-x-0 bottom-[var(--bottom-nav,0px)] z-20 border-t border-white/80 bg-white/80 px-4 py-3 shadow-glass backdrop-blur-xl ${props.hasSidebar ? "md:left-72" : ""}`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 md:px-4">
          <p className="text-sm tabular-nums text-muted">
            {done}/{total} ข้อ
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn" onClick={() => router.push(props.backHref)}>
              ยกเลิก
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={pending || locked || !complete}
              onClick={save}
            >
              {pending && <Spinner />}
              {pending ? "กำลังบันทึก…" : "บันทึก"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
