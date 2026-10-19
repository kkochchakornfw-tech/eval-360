import { CheckCircle2, ClipboardCheck, Users, UserPlus } from "lucide-react";
import { EmptyState, StatTile } from "@/components/EmptyState";
import { FilterBar } from "@/components/FilterBar";
import { PillFilter } from "@/components/PillFilter";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ProgressSection } from "@/components/ProgressTable";
import { ScoreChart } from "@/components/ScoreChart";
import { CoreTable, JobTable, KpiTable, SummaryTable } from "@/components/ScoreTables";
import { getCurrentCycle, getStaffGroups } from "@/lib/data";
import { buildReport, type PersonReport } from "@/lib/report";
import { sortDescNullsLast } from "@/lib/scoring";
import { requireHead } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

const METRICS = {
  total: {
    label: "คะแนนรวม (เต็ม 100)",
    tab: "คะแนนรวม",
    max: 100,
    pick: (p: PersonReport) => p.result.total100Rounded,
    partial: (p: PersonReport) => !p.result.isComplete || !p.peersComplete,
  },
  core: {
    label: "Core (เต็ม 5)",
    tab: "Core",
    max: 5,
    pick: (p: PersonReport) => p.result.core5Rounded,
    partial: (p: PersonReport) => p.result.corePartial || !p.peersComplete,
  },
  job: {
    label: "Job Base (เต็ม 5)",
    tab: "Job Base",
    max: 5,
    pick: (p: PersonReport) => p.result.job5,
    partial: () => false,
  },
  kpi: {
    label: "KPI (เต็ม 5)",
    tab: "KPI",
    max: 5,
    pick: (p: PersonReport) => p.result.kpi5,
    partial: () => false,
  },
} as const;
type MetricKey = keyof typeof METRICS;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ metric?: string; group?: string }>;
}) {
  await requireHead();
  const sp = await searchParams;
  const metricKey: MetricKey = sp.metric && sp.metric in METRICS ? (sp.metric as MetricKey) : "total";
  const metric = METRICS[metricKey];

  const supabase = await createClient();
  const [cycle, staffGroups] = await Promise.all([getCurrentCycle(supabase), getStaffGroups(supabase)]);
  if (!cycle) return <p className="text-sm text-muted">ยังไม่มีรอบประเมิน</p>;

  const report = await buildReport(supabase, cycle, staffGroups);
  const groupFilter = staffGroups.find((g) => String(g.id) === sp.group)?.id ?? null;
  const visibleGroups = staffGroups.filter((g) => groupFilter === null || g.id === groupFilter);

  const everyone = report.people.filter(
    (p) => groupFilter === null || p.profile.staff_group_id === groupFilter,
  );
  const ranked = sortDescNullsLast(everyone, metric.pick);
  // counted only once every colleague on the roster has evaluated the person
  const complete = everyone.filter((p) => p.peersComplete).length;
  const scored = everyone.filter((p) => p.result.total100 !== null).length;
  const headDone = everyone.filter((p) => p.headDone).length;

  return (
    <div className="space-y-12">
      <AutoRefresh />
      <div>
        <h1 className="page-title">ภาพรวมและกราฟ</h1>
        <p className="mt-1 text-sm text-muted">{cycle.name}</p>
        <div className="mt-5">
          <FilterBar
            filters={[
              {
                key: "group",
                label: "กลุ่ม",
                value: groupFilter === null ? "all" : String(groupFilter),
                options: [
                  { value: "all", label: "ทุกกลุ่ม" },
                  ...staffGroups.map((g) => ({ value: String(g.id), label: g.name })),
                ],
              },
            ]}
          />
        </div>
      </div>

      {everyone.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="ยังไม่มีพนักงานในระบบ"
          hint="เพิ่มพนักงานที่เมนู ตั้งค่าระบบ → ผู้ใช้ แล้วกราฟและตารางคะแนนจะแสดงที่นี่"
          action={{ href: "/settings?tab=users", label: "ไปเพิ่มผู้ใช้" }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <StatTile icon={Users} label="พนักงานที่ถูกประเมิน" value={String(everyone.length)} sub={cycle.name} />
          <StatTile
            icon={ClipboardCheck}
            label="หัวหน้าประเมินแล้ว"
            value={`${headDone}/${everyone.length}`}
            sub="Core + Job Base + KPI"
          />
          <StatTile
            icon={CheckCircle2}
            label="ประเมินครบแล้ว"
            value={`${complete}/${everyone.length}`}
            sub={scored === 0 ? "รอข้อมูลจากผู้ประเมิน" : `ถูกเพื่อนประเมินครบทุกคน · มีคะแนนระหว่างทางแล้ว ${scored} คน`}
          />
        </div>
      )}

      {everyone.length > 0 && (
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">{metric.label}</h2>
          <PillFilter
            param="metric"
            value={metricKey}
            options={Object.entries(METRICS).map(([value, m]) => ({ value, label: m.tab }))}
          />
        </div>
        <div className="card p-3 md:p-4">
          <ScoreChart
            rows={ranked.map((p) => ({
              name: p.profile.full_name,
              value: metric.pick(p),
              partial: metric.partial(p),
            }))}
            max={metric.max}
          />
        </div>
        <p className="mt-2 text-xs text-muted">
          คะแนน Core ในกราฟปัดเศษรายข้อก่อนรวม (ตั้งแต่ .5 ขึ้นปัดขึ้น) ส่วนตารางด้านล่างแสดงค่าเต็ม · แท่งสีอ่อนและเครื่องหมาย * = คะแนนระหว่างทาง (เพื่อนยังประเมินไม่ครบทุกคน หรือหัวหน้ายังไม่ประเมิน) ตัวเลขอัปเดตเองเมื่อมีคนประเมินเพิ่ม
        </p>
      </section>
      )}

      {everyone.length > 0 && (
        <ProgressSection
          rows={everyone.map((p) => ({
            id: p.profile.id,
            name: p.profile.full_name,
            peersDone: p.peersDone,
            peersExpected: p.peersExpected,
            headDone: p.headDone,
            evaluatedBy: p.evaluatedBy,
            notEvaluatedBy: p.notEvaluatedBy,
          }))}
          evaluators={report.evaluators}
          completeCount={complete}
        />
      )}

      {visibleGroups.map((g) => {
        const people = sortDescNullsLast(
          report.people.filter((p) => p.profile.staff_group_id === g.id),
          metric.pick,
        );
        if (people.length === 0) return null;
        return (
          <section key={g.id} className="space-y-6">
            <h2 className="text-base font-semibold">{g.name}</h2>
            <div className="space-y-2">
              <h3 className="text-sm text-muted">Core Competency รายข้อ</h3>
              <CoreTable people={people} groups={report.groups} />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm text-muted">Job Base รายข้อ</h3>
              <JobTable people={people} />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm text-muted">KPI</h3>
              <KpiTable people={people} />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm text-muted">สรุปคะแนน</h3>
              <SummaryTable people={people} cycle={cycle} />
            </div>
          </section>
        );
      })}
    </div>
  );
}
