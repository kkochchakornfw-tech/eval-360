"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { addPersonAction, type IssuedSecret } from "@/app/actions/accounts";
import { Spinner } from "@/components/Spinner";
import type { StaffGroup } from "@/types/database";

/** Adds a person without an email and creates their PIN account in one step. */
export function AddPersonForm({
  groups,
  onDone,
  onSecrets,
}: {
  groups: StaffGroup[];
  onDone: () => void;
  onSecrets: (s: IssuedSecret[]) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"staff" | "head" | "admin">("staff");
  const [groupId, setGroupId] = useState<number | null>(groups[0]?.id ?? null);
  const [counts, setCounts] = useState(true);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await addPersonAction({
      fullName,
      role,
      staffGroupId: role === "staff" ? groupId : null,
      countsInScore: counts,
    });
    setBusy(false);
    if (!res.ok) return alert(res.error);
    onSecrets(res.secrets);
    setFullName("");
    onDone();
    router.refresh();
  }

  return (
    <form className="card space-y-4 p-5" onSubmit={submit}>
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold">เพิ่มผู้ใช้ใหม่</h2>
          <p className="mt-0.5 text-xs text-muted">ไม่ต้องใช้อีเมล ระบบสร้างรหัส PIN ให้ และแสดงครั้งเดียว</p>
        </div>
        <button type="button" aria-label="ปิด" className="text-muted hover:text-ink" onClick={onDone}>
          <X size={18} />
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label className="label">ชื่อ-สกุล</label>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <label className="label">บทบาท</label>
          <select
            className="input"
            value={role}
            onChange={(e) => setRole(e.target.value as "staff" | "head" | "admin")}
          >
            <option value="staff">พนักงาน</option>
            <option value="head">หัวหน้า</option>
            <option value="admin">แอดมิน (ผู้ดูแลระบบ)</option>
          </select>
        </div>
        {role === "staff" ? (
          <div>
            <label className="label">กลุ่ม</label>
            <select
              className="input"
              value={groupId ?? ""}
              onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : null)}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        ) : role === "admin" ? (
          <p className="pt-7 text-xs text-muted">เห็นทุกหน้า ไม่ถูกประเมิน ไม่นับคะแนน</p>
        ) : (
          <label className="flex items-center gap-2 pt-7 text-sm">
            <input type="checkbox" checked={counts} onChange={(e) => setCounts(e.target.checked)} />
            นำคะแนนที่ให้ไปคำนวณ
          </label>
        )}
      </div>
      <button className="btn btn-primary" disabled={busy || !fullName.trim()}>
        {busy && <Spinner />}
        {busy ? "กำลังสร้างบัญชี…" : "เพิ่มและสร้างรหัส"}
      </button>
    </form>
  );
}
