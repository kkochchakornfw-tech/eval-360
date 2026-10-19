import { fetchAll, getCurrentCycle, getCycles } from "@/lib/data";
import { requireHead } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Evaluation, Profile } from "@/types/database";
import { DataTable, type DataRow } from "./DataTable";

export default async function DataPage({
  searchParams,
}: {
  searchParams: Promise<{ cycle?: string }>;
}) {
  await requireHead();
  const { cycle: cycleParam } = await searchParams;
  const supabase = await createClient();
  const cycles = await getCycles(supabase);
  const current = await getCurrentCycle(supabase);
  const cycle = cycles.find((c) => String(c.id) === cycleParam) ?? current;

  let rows: DataRow[] = [];
  if (cycle) {
    const [{ data: profiles }, evaluations] = await Promise.all([
      supabase.from("profiles").select("id,full_name,role"),
      fetchAll<Evaluation>((from, to) =>
        supabase
          .from("evaluations")
          .select("*")
          .eq("cycle_id", cycle.id)
          .order("updated_at", { ascending: false })
          .range(from, to),
      ),
    ]);
    const byId = new Map(
      ((profiles ?? []) as Pick<Profile, "id" | "full_name" | "role">[]).map((p) => [p.id, p]),
    );
    rows = evaluations.map((e) => ({
      evaluatorId: e.evaluator_id,
      evaluateeId: e.evaluatee_id,
      evaluator: byId.get(e.evaluator_id)?.full_name ?? "-",
      evaluatee: byId.get(e.evaluatee_id)?.full_name ?? "-",
      evaluatorRole: byId.get(e.evaluator_id)?.role ?? "staff",
      updatedAt: e.updated_at,
    }));
  }

  return (
    <div>
      <h1 className="page-title">จัดการข้อมูล</h1>
      <p className="mt-1 text-sm text-muted">ผู้ประเมิน → ผู้รับการประเมิน แก้ไขหรือลบได้แม้ปิดรอบแล้ว</p>
      {cycle ? (
        <DataTable
          rows={rows}
          cycleId={cycle.id}
          cycles={cycles.map((c) => ({ id: c.id, name: c.name }))}
        />
      ) : (
        <p className="mt-8 text-sm text-muted">ยังไม่มีรอบประเมิน</p>
      )}
    </div>
  );
}
