import Link from "next/link";
import { getCoreStructure, getCurrentCycle, getCycles, getJobItems, getStaffGroups } from "@/lib/data";
import { requireHead } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";
import { CorePanel } from "./CorePanel";
import { CyclesPanel } from "./CyclesPanel";
import { JobPanel } from "./JobPanel";
import { UsersPanel } from "./UsersPanel";
import { WeightsPanel } from "./WeightsPanel";

const TABS = [
  { key: "users", label: "ผู้ใช้" },
  { key: "core", label: "Core Competency" },
  { key: "job", label: "Job Base" },
  { key: "weights", label: "น้ำหนักและสัดส่วน" },
  { key: "cycles", label: "รอบประเมิน" },
] as const;

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const me = await requireHead();
  const { tab: rawTab } = await searchParams;
  const tab = TABS.find((t) => t.key === rawTab)?.key ?? "users";

  const supabase = await createClient();
  const [cycle, groups] = await Promise.all([getCurrentCycle(supabase), getStaffGroups(supabase)]);

  let panel: React.ReactNode;
  if (tab === "users") {
    const { data } = await supabase.from("profiles").select("*").order("role").order("full_name");
    panel = <UsersPanel users={(data ?? []) as Profile[]} groups={groups} selfId={me.id} />;
  } else if (tab === "cycles") {
    panel = <CyclesPanel cycles={await getCycles(supabase)} />;
  } else if (!cycle) {
    panel = <p className="text-sm text-muted">ยังไม่มีรอบประเมิน กรุณาสร้างรอบในแท็บ “รอบประเมิน”</p>;
  } else if (tab === "core") {
    panel = <CorePanel cycleId={cycle.id} groups={await getCoreStructure(supabase, cycle.id)} />;
  } else if (tab === "job") {
    panel = (
      <JobPanel
        cycleId={cycle.id}
        staffGroups={groups}
        items={await getJobItems(supabase, cycle.id)}
      />
    );
  } else {
    panel = <WeightsPanel cycle={cycle} />;
  }

  return (
    <div>
      <h1 className="page-title">ตั้งค่าระบบ</h1>
      {cycle && tab !== "users" && tab !== "cycles" && (
        <p className="mt-1 text-sm text-muted">แก้ไขรอบ: {cycle.name}</p>
      )}
      <div className="-mx-4 mt-6 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        <div className="card flex min-w-max gap-1 p-1.5">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/settings?tab=${t.key}`}
              className={`rounded-xl px-4 py-2 text-sm transition duration-150 ${
                tab === t.key
                  ? "bg-accent font-medium text-white shadow-glow"
                  : "text-muted hover:bg-white/80 hover:text-ink"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="mt-6">{panel}</div>
    </div>
  );
}
