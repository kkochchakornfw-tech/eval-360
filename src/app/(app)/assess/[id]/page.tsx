import { notFound } from "next/navigation";
import { EvalForm } from "@/components/EvalForm";
import { getCurrentCycle, getDirectory } from "@/lib/data";
import { loadFormData } from "@/lib/forms";
import { requireHead } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function AssessFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireHead();
  if (profile.role !== "head") notFound();
  const supabase = await createClient();

  const [cycle, directory] = await Promise.all([getCurrentCycle(supabase), getDirectory(supabase)]);
  const target = directory.find((d) => d.id === id);
  if (!cycle || !target || target.role !== "staff") notFound();

  const data = await loadFormData(supabase, {
    cycle,
    evaluatorId: profile.id,
    evaluateeId: target.id,
    evaluateeGroupId: target.staff_group_id,
    kind: "head",
  });

  return (
    <EvalForm
      mode="head"
      cycleId={cycle.id}
      evaluateeId={target.id}
      evaluateeName={target.full_name}
      groups={data.groups}
      jobItems={data.jobItems}
      initialCore={data.initialCore}
      initialJob={data.initialJob}
      initialKpi={data.initialKpi}
      existing={data.existing}
      locked={!cycle.is_open}
      notCounted={!profile.counts_in_score}
      backHref="/assess"
      hasSidebar
    />
  );
}
