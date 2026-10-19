import { notFound } from "next/navigation";
import { EvalForm } from "@/components/EvalForm";
import { getCurrentCycle, getCycles } from "@/lib/data";
import { loadFormData } from "@/lib/forms";
import { requireHead } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export default async function DataEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ evaluatorId: string; evaluateeId: string }>;
  searchParams: Promise<{ cycle?: string }>;
}) {
  const { evaluatorId, evaluateeId } = await params;
  const { cycle: cycleParam } = await searchParams;
  await requireHead();
  const supabase = await createClient();

  const cycles = await getCycles(supabase);
  const cycle = cycles.find((c) => String(c.id) === cycleParam) ?? (await getCurrentCycle(supabase));
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .in("id", [evaluatorId, evaluateeId]);
  const profiles = (data ?? []) as Profile[];
  const evaluator = profiles.find((p) => p.id === evaluatorId);
  const evaluatee = profiles.find((p) => p.id === evaluateeId);
  if (!cycle || !evaluator || !evaluatee || evaluatee.role !== "staff") notFound();

  const kind = evaluator.role === "head" ? "head" : "core";
  const form = await loadFormData(supabase, {
    cycle,
    evaluatorId,
    evaluateeId,
    evaluateeGroupId: evaluatee.staff_group_id,
    kind,
  });

  return (
    <div>
      <p className="mb-4 text-sm text-muted">
        แก้ไขการประเมินของ <span className="text-ink">{evaluator.full_name}</span> · {cycle.name}
      </p>
      <EvalForm
        mode={kind}
        cycleId={cycle.id}
        evaluatorId={evaluatorId}
        evaluateeId={evaluateeId}
        evaluateeName={evaluatee.full_name}
        groups={form.groups}
        jobItems={form.jobItems}
        initialCore={form.initialCore}
        initialJob={form.initialJob}
        initialKpi={form.initialKpi}
        existing={form.existing}
        locked={false}
        notCounted={evaluator.role === "head" && !evaluator.counts_in_score}
        backHref={`/data?cycle=${cycle.id}`}
        hasSidebar
      />
    </div>
  );
}
