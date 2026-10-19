"use client";

import { useState } from "react";
import { useRun } from "@/components/useRun";
import { Spinner } from "@/components/Spinner";
import { saveWeightsAction } from "@/app/actions/settings";
import type { EvalCycle } from "@/types/database";

const clamp = (n: number) => Math.min(100, Math.max(0, Number.isFinite(n) ? n : 0));

export function WeightsPanel({ cycle }: { cycle: EvalCycle }) {
  const { run, pending } = useRun();
  const [head, setHead] = useState(Number(cycle.head_weight));
  const [core, setCore] = useState(Number(cycle.core_weight));
  const [job, setJob] = useState(Number(cycle.job_weight));
  const [kpi, setKpi] = useState(Number(cycle.kpi_weight));
  const sum = core + job + kpi;
  const sumOk = Math.abs(sum - 100) < 1e-9;

  const field = (value: number, set: (n: number) => void, label: string) => (
    <div>
      <label className="label">{label}</label>
      <input
        className="input text-right tabular-nums"
        type="number"
        inputMode="decimal"
        min={0}
        max={100}
        step="any"
        value={value}
        onChange={(e) => set(clamp(e.target.valueAsNumber))}
      />
    </div>
  );

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            saveWeightsAction({
              cycleId: cycle.id,
              headWeight: head,
              coreWeight: core,
              jobWeight: job,
              kpiWeight: kpi,
            }),
          "บันทึกแล้ว",
        );
      }}
    >
      <section className="card space-y-4 p-4">
        <div>
          <h2 className="text-sm font-semibold">น้ำหนัก Core Competency</h2>
          <p className="mt-1 text-xs text-muted">คะแนนจากหัวหน้า เทียบกับค่าเฉลี่ยจากพนักงาน</p>
        </div>
        <div className="grid max-w-md grid-cols-2 gap-3">
          {field(head, setHead, "หัวหน้า (%)")}
          <div>
            <label className="label">พนักงาน (%)</label>
            <input
              className="input text-right tabular-nums"
              disabled
              value={Number((100 - head).toFixed(4))}
              readOnly
            />
          </div>
        </div>
      </section>

      <section className="card space-y-4 p-4">
        <div>
          <h2 className="text-sm font-semibold">สัดส่วนหมวดคะแนน</h2>
          <p className="mt-1 text-xs text-muted">ต้องรวมได้ 100 จึงจะบันทึกได้</p>
        </div>
        <div className="grid max-w-md grid-cols-3 gap-3">
          {field(core, setCore, "Core")}
          {field(job, setJob, "Job Base")}
          {field(kpi, setKpi, "KPI")}
        </div>
        <p className={`text-sm tabular-nums ${sumOk ? "text-muted" : "text-danger"}`}>
          รวม {Number(sum.toFixed(4))}
          {!sumOk && " — ต้องเท่ากับ 100"}
        </p>
      </section>

      <button className="btn btn-primary" disabled={pending || !sumOk}>
        {pending && <Spinner />}
        {pending ? "กำลังบันทึก…" : "บันทึก"}
      </button>
    </form>
  );
}
