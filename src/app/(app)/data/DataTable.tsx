"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteEvaluationAction } from "@/app/actions/evaluation";
import { useRun } from "@/components/useRun";
import { EmptyState } from "@/components/EmptyState";

export interface DataRow {
  evaluatorId: string;
  evaluateeId: string;
  evaluator: string;
  evaluatee: string;
  evaluatorRole: "head" | "staff";
  updatedAt: string;
}

const dateFmt = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Bangkok",
});

export function DataTable({
  rows,
  cycleId,
  cycles,
}: {
  rows: DataRow[];
  cycleId: number;
  cycles: { id: number; name: string }[];
}) {
  const router = useRouter();
  const { run, pending } = useRun();
  const [q, setQ] = useState("");
  const [role, setRole] = useState<"all" | "head" | "staff">("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (role === "all" || r.evaluatorRole === role) &&
        (!needle ||
          r.evaluator.toLowerCase().includes(needle) ||
          r.evaluatee.toLowerCase().includes(needle)),
    );
  }, [rows, q, role]);

  return (
    <div className="mt-6">
      <div className="grid gap-2 md:grid-cols-[1fr_180px_220px]">
        <input
          className="input"
          placeholder="ค้นหาชื่อผู้ประเมินหรือผู้รับการประเมิน"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="input" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
          <option value="all">ผู้ประเมินทั้งหมด</option>
          <option value="head">เฉพาะหัวหน้า</option>
          <option value="staff">เฉพาะพนักงาน</option>
        </select>
        <select
          className="input"
          value={cycleId}
          onChange={(e) => router.push(`/data?cycle=${e.target.value}`)}
        >
          {cycles.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <p className="mt-4 text-xs tabular-nums text-muted">
        {filtered.length} จาก {rows.length} รายการ
      </p>

      {filtered.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="ไม่พบข้อมูลการประเมิน"
            hint={rows.length === 0 ? "ยังไม่มีใครส่งแบบประเมินในรอบนี้" : "ลองเปลี่ยนคำค้นหาหรือตัวกรอง"}
          />
        </div>
      ) : (
        <div className="card mt-2 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr>
                <th className="th">ผู้ประเมิน</th>
                <th className="th">ผู้รับการประเมิน</th>
                <th className="th">บันทึกเมื่อ</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={`${r.evaluatorId}-${r.evaluateeId}`}>
                  <td className="td">
                    {r.evaluator}
                    {r.evaluatorRole === "head" && (
                      <span className="ml-2 text-xs text-accent">หัวหน้า</span>
                    )}
                  </td>
                  <td className="td">{r.evaluatee}</td>
                  <td className="td whitespace-nowrap text-muted">
                    {dateFmt.format(new Date(r.updatedAt))}
                  </td>
                  <td className="td whitespace-nowrap text-right">
                    <Link
                      href={`/data/edit/${r.evaluatorId}/${r.evaluateeId}?cycle=${cycleId}`}
                      className="btn btn-sm mr-2"
                    >
                      แก้ไข
                    </Link>
                    <button
                      className="btn btn-sm btn-danger"
                      disabled={pending}
                      onClick={() => {
                        if (
                          confirm(`ลบการประเมินของ ${r.evaluator} → ${r.evaluatee}? ลบแล้วกู้คืนไม่ได้`)
                        ) {
                          run(
                            () =>
                              deleteEvaluationAction({
                                cycleId,
                                evaluatorId: r.evaluatorId,
                                evaluateeId: r.evaluateeId,
                              }),
                            "ลบข้อมูลแล้ว",
                          );
                        }
                      }}
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
