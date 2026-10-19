import { ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { PersonList } from "@/components/PersonList";
import { getCurrentCycle, getDirectory, getStaffGroups } from "@/lib/data";
import { requireHead } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function AssessPage() {
  const profile = await requireHead();
  if (profile.role !== "head") {
    return (
      <div>
        <h1 className="page-title">แบบประเมินหัวหน้า</h1>
        <div className="mt-8">
          <EmptyState
            icon={ShieldAlert}
            title="เมนูนี้สำหรับหัวหน้า"
            hint="บัญชีแอดมินดูหน้านี้ได้ แต่กรอกแบบประเมินหัวหน้า (Job Base และ KPI) ไม่ได้ ใช้เมนู “ตอบแบบสอบถาม” เพื่อประเมินเพื่อนร่วมงานตามปกติ"
            action={{ href: "/evaluate", label: "ไปตอบแบบสอบถาม" }}
          />
        </div>
      </div>
    );
  }
  const supabase = await createClient();
  const [cycle, directory, groups] = await Promise.all([
    getCurrentCycle(supabase),
    getDirectory(supabase),
    getStaffGroups(supabase),
  ]);
  const people = directory.filter((d) => d.role === "staff");

  let doneIds = new Set<string>();
  if (cycle) {
    const { data } = await supabase
      .from("head_assessments")
      .select("evaluatee_id")
      .eq("cycle_id", cycle.id)
      .eq("assessor_id", profile.id);
    doneIds = new Set((data ?? []).map((r: { evaluatee_id: string }) => r.evaluatee_id));
  }

  return (
    <div>
      <h1 className="page-title">แบบประเมินหัวหน้า</h1>
      <p className="mt-1 text-sm text-muted">
        {cycle ? cycle.name : "ยังไม่มีรอบประเมิน"} · Core Competency + Job Base + KPI
      </p>
      {cycle && !cycle.is_open && (
        <p className="mt-4 rounded-xl border border-line bg-white/70 px-4 py-3 text-sm text-muted">
          รอบประเมินปิดแล้ว หากต้องการแก้ไขให้ไปที่เมนู “จัดการข้อมูล”
        </p>
      )}
      {!profile.counts_in_score && (
        <p className="mt-4 text-xs text-muted">คะแนนของคุณไม่ถูกนำไปคำนวณ</p>
      )}
      {cycle ? (
        <PersonList people={people} groups={groups} doneIds={doneIds} hrefBase="/assess" />
      ) : null}
    </div>
  );
}
