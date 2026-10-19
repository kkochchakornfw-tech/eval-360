import { notFound } from "next/navigation";
import { EvalForm } from "@/components/EvalForm";
import { getCurrentCycle, getDirectory } from "@/lib/data";
import { loadFormData } from "@/lib/forms";
import { canAdmin } from "@/lib/roles";
import { requireProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function EvaluateFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const [cycle, directory] = await Promise.all([getCurrentCycle(supabase), getDirectory(supabase)]);
  const target = directory.find((d) => d.id === id);
  // heads and yourself are never valid targets
  if (!cycle || !target || target.role !== "staff" || target.id === profile.id) notFound();

  const data = await loadFormData(supabase, {
    cycle,
    evaluatorId: profile.id,
    evaluateeId: target.id,
    evaluateeGroupId: target.staff_group_id,
    kind: "core",
  });

  return (
    <EvalForm
      mode="core"
      cycleId={cycle.id}
      evaluateeId={target.id}
      evaluateeName={target.full_name}
      groups={data.groups}
      jobItems={[]}
      initialCore={data.initialCore}
      initialJob={{}}
      initialKpi={null}
      existing={data.existing}
      locked={!cycle.is_open}
      notCounted={profile.role === "head" && !profile.counts_in_score}
      backHref="/evaluate"
      hasSidebar={canAdmin(profile)}
    />
  );
}
