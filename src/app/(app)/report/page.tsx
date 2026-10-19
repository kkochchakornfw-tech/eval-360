import { FileText } from "lucide-react";
import { AutoRefresh } from "@/components/AutoRefresh";
import { EmptyState } from "@/components/EmptyState";
import { FilterBar } from "@/components/FilterBar";
import { Score } from "@/components/ScoreTables";
import { getCurrentCycle, getStaffGroups } from "@/lib/data";
import { buildReport } from "@/lib/report";
import { formatScore } from "@/lib/scoring";
import { requireHead } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  await requireHead();
  const { id } = await searchParams;
  const supabase = await createClient();
  const [cycle, staffGroups] = await Promise.all([getCurrentCycle(supabase), getStaffGroups(supabase)]);
  if (!cycle) return <p className="text-sm text-muted">ยังไม่มีรอบประเมิน</p>;

  const report = await buildReport(supabase, cycle, staffGroups);
  const people = [...report.people].sort((a, b) =>
    a.profile.full_name.localeCompare(b.profile.full_name, "th"),
  );
  const person = people.find((p) => p.profile.id === id) ?? null;
  const r = person?.result;
  const n = (v: number) => Number(v);

  return (
    <div>
      <AutoRefresh />
      <h1 className="page-title">รายงานบุคคล</h1>
      <p className="mt-1 text-sm text-muted">{cycle.name}</p>

      <div className="mt-5">
        <FilterBar
          filters={[
            {
              key: "id",
              label: "เลือกพนักงาน",
              value: person?.profile.id ?? "",
              options: [
                { value: "", label: "— เลือก —" },
                ...people.map((p) => ({ value: p.profile.id, label: p.profile.full_name })),
              ],
            },
          ]}
        />
      </div>

      {!person || !r ? (
        <div className="mt-10">
          <EmptyState
            icon={FileText}
            title="เลือกพนักงานเพื่อดูรายงาน"
            hint="คะแนนรวมเต็ม 100 พร้อมรายละเอียดรายหมวดและรายข้อจะแสดงที่นี่"
          />
        </div>
      ) : (
        <div className="mt-10 space-y-10">
          <section>
            <p className="text-sm text-muted">
              {person.profile.full_name} · {person.groupName}
            </p>
            <p className="mt-2 flex items-baseline gap-2">
              {r.total100Rounded === null ? (
                <span className="text-4xl font-semibold text-stone-400">รอข้อมูล</span>
              ) : (
                <>
                  <span className="text-6xl font-semibold tabular-nums text-accent-dark">
                    {formatScore(r.total100Rounded)}
                  </span>
                  <span className="text-lg text-muted">/ 100</span>
                </>
              )}
            </p>
            {r.total100Rounded !== null && !r.isComplete && (
              <p className="mt-2 inline-block rounded-full bg-accent-soft px-3 py-1 text-xs text-accent-dark">
                คะแนนระหว่างทาง: ตอนนี้มีข้อมูลครบ {Number(r.availablePoints)} จาก 100 คะแนน
                {r.corePartial ? " และ Core ยังมาไม่ครบทั้งฝั่งพนักงานและหัวหน้า" : ""} อัปเดตเองเมื่อมีคนประเมินเพิ่ม
              </p>
            )}
            <p className="mt-2 text-sm text-muted">
              แปลงเต็ม 5: <span className="tabular-nums text-ink"><Score value={r.total5Rounded} /></span>
              <span className="mx-2">·</span>
              พนักงานประเมินแล้ว {person.peersDone} จาก {person.peersExpected} คน
              <span className="mx-2">·</span>
              หัวหน้า {person.headDone ? "ประเมินแล้ว" : "ยังไม่ประเมิน"}
            </p>
            <p className="mt-1 text-xs text-muted">
              จำนวนเพื่อนทั้งหมด นับพนักงานทุกคนในรายชื่อ (ไม่รวมตัวเอง) แม้ยังไม่มีบัญชีเข้าระบบ
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold">แยกรายหมวด</h2>
            <p className="-mt-2 mb-3 text-xs text-muted">Core คิดจากคะแนนที่ปัดเศษรายข้อแล้ว คะแนนรวมด้านบนใช้ชุดเดียวกัน</p>
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse">
                <thead>
                  <tr>
                    <th className="th">หมวด</th>
                    <th className="th text-right">เต็ม 5</th>
                    <th className="th text-right">ตามสัดส่วน</th>
                    <th className="th text-right">เต็ม</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "Core Competency", s5: r.core5Rounded, pct: r.corePctRounded, max: n(cycle.core_weight) },
                    { label: "Job Base", s5: r.job5, pct: r.jobPct, max: n(cycle.job_weight) },
                    { label: "KPI", s5: r.kpi5, pct: r.kpiPct, max: n(cycle.kpi_weight) },
                  ].map((row) => (
                    <tr key={row.label}>
                      <td className="td">{row.label}</td>
                      <td className="td num"><Score value={row.s5} /></td>
                      <td className="td num"><Score value={row.pct} /></td>
                      <td className="td num text-muted">{row.max}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold">Core Competency รายข้อ</h2>
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[600px] border-collapse">
                <thead>
                  <tr>
                    <th className="th">ข้อ</th>
                    <th className="th text-right">เฉลี่ยพนักงาน</th>
                    <th className="th text-right">หัวหน้า</th>
                    <th className="th text-right">รวม</th>
                    <th className="th text-right">ปัดเศษ</th>
                  </tr>
                </thead>
                <tbody>
                  {report.groups.map((g) => {
                    const rounded = g.questions
                      .map((q) => r.coreRoundedByQuestion[q.id])
                      .filter((v): v is number => v !== null && v !== undefined);
                    const sum = rounded.reduce((a, b) => a + b, 0);
                    return (
                    <GroupRows key={g.id}>
                      <tr>
                        <td colSpan={4} className="td bg-stone-50 text-xs font-semibold">
                          {g.code} · {g.name}
                        </td>
                        <td className="td num bg-stone-50 text-xs font-semibold">
                          {rounded.length === 0 ? (
                            <span className="waiting">รอข้อมูล</span>
                          ) : (
                            <>
                              รวม {sum}/{g.questions.length * 5} · เฉลี่ย{" "}
                              {formatScore(sum / g.questions.length)}
                            </>
                          )}
                        </td>
                      </tr>
                      {g.questions.map((q, i) => {
                        const s = r.coreByQuestion[q.id];
                        return (
                          <tr key={q.id}>
                            <td className="td whitespace-normal text-xs">
                              <span className="mr-1.5 text-muted tabular-nums">
                                {g.code}
                                {i + 1}
                              </span>
                              {q.text}
                            </td>
                            <td className="td num"><Score value={s?.peerAvg ?? null} /></td>
                            <td className="td num"><Score value={s?.headScore ?? null} /></td>
                            <td className="td num font-medium"><Score value={s?.combined ?? null} /></td>
                            <td className="td num font-semibold">
                              <Score value={r.coreRoundedByQuestion[q.id] ?? null} digits={0} />
                            </td>
                          </tr>
                        );
                      })}
                    </GroupRows>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold">Job Base รายข้อ</h2>
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse">
                <thead>
                  <tr>
                    <th className="th">ข้อ</th>
                    <th className="th text-right">น้ำหนัก</th>
                    <th className="th text-right">คะแนนที่หัวหน้าให้ (เต็ม 5)</th>
                  </tr>
                </thead>
                <tbody>
                  {person.jobItems.map((it) => (
                    <tr key={it.id}>
                      <td className="td whitespace-normal text-xs">{it.text}</td>
                      <td className="td num text-muted">{n(it.weight)}</td>
                      <td className="td num"><Score value={r.jobRawByItem[it.id] ?? null} digits={Number.isInteger(r.jobRawByItem[it.id]) ? 0 : 2} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold">KPI</h2>
            <p className="text-sm">
              ผลงาน{" "}
              <span className="tabular-nums">
                {r.kpiPercent === null ? <span className="waiting">รอข้อมูล</span> : `${r.kpiPercent}%`}
              </span>
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

function GroupRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
