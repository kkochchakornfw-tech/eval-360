import { Fragment } from "react";
import { formatScore } from "@/lib/scoring";
import type { PersonReport } from "@/lib/report";
import type { CoreGroupWithQuestions, EvalCycle } from "@/types/database";

/** Score cell: right-aligned tabular number, grey "รอข้อมูล" when null. */
export function Score({ value, digits = 2 }: { value: number | null; digits?: number }) {
  return value === null ? (
    <span className="waiting">รอข้อมูล</span>
  ) : (
    <span>{formatScore(value, digits)}</span>
  );
}

function Cell({ value, digits = 2 }: { value: number | null; digits?: number }) {
  return value === null ? <span className="waiting">-</span> : <span>{formatScore(value, digits)}</span>;
}

/** Frame: horizontal scroll inside the card, first (label) column sticky. */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full border-collapse">{children}</table>
    </div>
  );
}

const stickyTh = "th sticky left-0 z-10 min-w-[200px] max-w-[260px] whitespace-normal bg-stone-50";
const stickyTd = "td sticky left-0 z-10 min-w-[200px] max-w-[260px] bg-white";

function Head({ people, label }: { people: PersonReport[]; label: string }) {
  return (
    <thead>
      <tr>
        <th className={stickyTh}>{label}</th>
        {people.map((p) => (
          <th key={p.profile.id} className="th min-w-[110px] whitespace-normal text-right">
            {p.profile.full_name}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function CoreTable({
  people,
  groups,
}: {
  people: PersonReport[];
  groups: CoreGroupWithQuestions[];
}) {
  return (
    <Frame>
      <Head people={people} label="Core Competency (ปัดเป็นจำนวนเต็ม)" />
      <tbody>
        {groups.map((g) => (
          <Fragment key={g.id}>
            <tr>
              <td className={`${stickyTd} bg-stone-50 text-xs font-semibold`}>
                {g.code} · {g.name}
              </td>
              {people.map((p) => (
                <td key={p.profile.id} className="td bg-stone-50" />
              ))}
            </tr>
            {g.questions.map((q, i) => (
              <tr key={q.id}>
                <td className={`${stickyTd} whitespace-normal text-xs`}>
                  <span className="mr-1.5 text-muted tabular-nums">
                    {g.code}
                    {i + 1}
                  </span>
                  {q.text}
                </td>
                {people.map((p) => (
                  <td key={p.profile.id} className="td num">
                    <Cell value={p.result.coreRoundedByQuestion[q.id] ?? null} digits={0} />
                  </td>
                ))}
              </tr>
            ))}
          </Fragment>
        ))}
        <tr className="font-semibold">
          <td className={stickyTd}>Core (เต็ม 5)</td>
          {people.map((p) => (
            <td key={p.profile.id} className="td num">
              <Score value={p.result.core5Rounded} />
            </td>
          ))}
        </tr>
      </tbody>
    </Frame>
  );
}

export function JobTable({ people }: { people: PersonReport[] }) {
  const items = people[0]?.jobItems ?? [];
  if (items.length === 0) return <p className="text-sm text-muted">ยังไม่มีข้อ Job Base สำหรับกลุ่มนี้</p>;
  return (
    <Frame>
      <Head people={people} label="Job Base (คะแนนดิบที่หัวหน้าให้ เต็ม 5)" />
      <tbody>
        {items.map((it) => (
          <tr key={it.id}>
            <td className={`${stickyTd} whitespace-normal text-xs`}>
              {it.text}
              <span className="ml-1.5 text-muted tabular-nums">น้ำหนัก {Number(it.weight)}</span>
            </td>
            {people.map((p) => (
              <td key={p.profile.id} className="td num">
                <Cell value={p.result.jobRawByItem[it.id] ?? null} digits={Number.isInteger(p.result.jobRawByItem[it.id]) ? 0 : 2} />
              </td>
            ))}
          </tr>
        ))}
        <tr className="font-semibold">
          <td className={stickyTd}>Job Base (เต็ม 5)</td>
          {people.map((p) => (
            <td key={p.profile.id} className="td num">
              <Score value={p.result.job5} />
            </td>
          ))}
        </tr>
      </tbody>
    </Frame>
  );
}

export function KpiTable({ people }: { people: PersonReport[] }) {
  return (
    <Frame>
      <Head people={people} label="KPI" />
      <tbody>
        <tr>
          <td className={stickyTd}>% KPI ที่ทำได้</td>
          {people.map((p) => (
            <td key={p.profile.id} className="td num">
              <Cell value={p.result.kpiPercent} />
            </td>
          ))}
        </tr>
        <tr className="font-semibold">
          <td className={stickyTd}>KPI (เต็ม 5)</td>
          {people.map((p) => (
            <td key={p.profile.id} className="td num">
              <Score value={p.result.kpi5} />
            </td>
          ))}
        </tr>
      </tbody>
    </Frame>
  );
}

/** Final summary: rows in the order fixed by the spec. Proportions come from the cycle. */
export function SummaryTable({ people, cycle }: { people: PersonReport[]; cycle: EvalCycle }) {
  const n = (v: number) => Number(v);
  const rows: { label: string; pick: (p: PersonReport) => number | null; strong?: boolean }[] = [
    { label: "Core (เต็ม 5)", pick: (p) => p.result.core5Rounded },
    { label: "Job Base (เต็ม 5)", pick: (p) => p.result.job5 },
    { label: "KPI (เต็ม 5)", pick: (p) => p.result.kpi5 },
    { label: `Core ตามสัดส่วน (เต็ม ${n(cycle.core_weight)})`, pick: (p) => p.result.corePctRounded },
    { label: `Job Base ตามสัดส่วน (เต็ม ${n(cycle.job_weight)})`, pick: (p) => p.result.jobPct },
    { label: `KPI ตามสัดส่วน (เต็ม ${n(cycle.kpi_weight)})`, pick: (p) => p.result.kpiPct },
    { label: "คะแนนรวม (เต็ม 100)", pick: (p) => p.result.total100Rounded, strong: true },
    { label: "คะแนนรวมแปลงเต็ม 5", pick: (p) => p.result.total5Rounded, strong: true },
  ];
  return (
    <Frame>
      <Head people={people} label="สรุปคะแนน (ใช้ Core ที่ปัดเศษรายข้อแล้ว)" />
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className={r.strong ? "font-semibold" : ""}>
            <td className={`${stickyTd} ${r.strong ? "bg-accent-soft" : ""}`}>{r.label}</td>
            {people.map((p) => (
              <td key={p.profile.id} className={`td num ${r.strong ? "bg-accent-soft" : ""}`}>
                <Score value={r.pick(p)} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </Frame>
  );
}
