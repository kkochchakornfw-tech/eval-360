import { PersonList } from "@/components/PersonList";
import { getCurrentCycle, getDirectory, getStaffGroups } from "@/lib/data";
import { requireProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function EvaluatePage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const [cycle, directory, groups] = await Promise.all([
    getCurrentCycle(supabase),
    getDirectory(supabase),
    getStaffGroups(supabase),
  ]);

  // Everyone except heads and yourself
  const people = directory.filter((d) => d.role === "staff" && d.id !== profile.id);

  let doneIds = new Set<string>();
  if (cycle) {
    const { data } = await supabase
      .from("evaluations")
      .select("evaluatee_id")
      .eq("cycle_id", cycle.id)
      .eq("evaluator_id", profile.id);
    doneIds = new Set((data ?? []).map((r: { evaluatee_id: string }) => r.evaluatee_id));
  }

  return (
    <div>
      <h1 className="page-title">ตอบแบบสอบถาม</h1>
      <p className="mt-1 text-sm text-muted">
        {cycle ? cycle.name : "ยังไม่มีรอบประเมิน"} · เลือกเพื่อนร่วมงานเพื่อให้คะแนน Core Competency
      </p>
      {cycle && !cycle.is_open && (
        <p className="mt-4 rounded-xl border border-line bg-white/70 px-4 py-3 text-sm text-muted">
          รอบประเมินปิดแล้ว ไม่สามารถแก้ไขคะแนนได้
        </p>
      )}
      {profile.role === "head" && !profile.counts_in_score && (
        <p className="mt-4 text-xs text-muted">คะแนนของคุณไม่ถูกนำไปคำนวณ</p>
      )}
      {cycle ? (
        <PersonList people={people} groups={groups} doneIds={doneIds} hrefBase="/evaluate" />
      ) : null}
    </div>
  );
}
