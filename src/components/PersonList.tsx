import Link from "next/link";
import { Check, Users } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import type { DirectoryEntry, StaffGroup } from "@/types/database";

/** People grouped by staff group as compact tiles in a responsive grid, with done / not-done status. */
export function PersonList({
  people,
  groups,
  doneIds,
  hrefBase,
}: {
  people: DirectoryEntry[];
  groups: StaffGroup[];
  doneIds: Set<string>;
  hrefBase: string;
  readOnly?: boolean;
}) {
  if (people.length === 0) {
    return (
      <div className="mt-8">
        <EmptyState
          icon={Users}
          title="ยังไม่มีรายชื่อให้ประเมิน"
          hint="เมื่อหัวหน้าเพิ่มพนักงานเข้าระบบแล้ว รายชื่อจะปรากฏที่นี่"
        />
      </div>
    );
  }
  return (
    <div className="mt-8 space-y-8">
      {groups.map((g) => {
        const list = people.filter((p) => p.staff_group_id === g.id);
        if (list.length === 0) return null;
        const done = list.filter((p) => doneIds.has(p.id)).length;
        return (
          <section key={g.id}>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-base font-semibold">{g.name}</h2>
              <span className="text-xs tabular-nums text-muted">
                ประเมินแล้ว {done}/{list.length}
              </span>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((p) => {
                const isDone = doneIds.has(p.id);
                return (
                  <li key={p.id}>
                    <Link
                      href={`${hrefBase}/${p.id}`}
                      className="card flex min-h-[46px] items-center justify-between gap-3 px-4 py-2 transition duration-150 hover:border-accent/40 hover:bg-white"
                    >
                      <span className="truncate text-sm">{p.full_name}</span>
                      {isDone ? (
                        <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
                          <Check size={12} strokeWidth={2.5} /> แล้ว
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs text-muted">
                          ยังไม่ประเมิน
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
