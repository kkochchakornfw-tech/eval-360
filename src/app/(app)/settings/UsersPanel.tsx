"use client";

import { useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { useRun } from "@/components/useRun";
import { Spinner } from "@/components/Spinner";
import { AddPersonForm } from "./AddPersonForm";
import { deleteUserAction, renameStaffGroupAction, updateUserAction } from "@/app/actions/settings";
import type { Profile, StaffGroup } from "@/types/database";

interface Draft {
  fullName: string;
  /** "admin" = system watcher: sees every page, not evaluated, never scored */
  role: "head" | "staff" | "admin";
  staffGroupId: number | null;
  countsInScore: boolean;
  isAdmin: boolean;
  isActive: boolean;
  googleEmail: string;
}

function GroupSelect({
  groups,
  value,
  onChange,
}: {
  groups: StaffGroup[];
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <select
      className="input"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
    >
      <option value="">เลือกกลุ่ม</option>
      {groups.map((g) => (
        <option key={g.id} value={g.id}>
          {g.name}
        </option>
      ))}
    </select>
  );
}

function StatusPill({ user }: { user: Profile }) {
  if (!user.is_active) {
    return <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-muted">ปิดใช้งาน</span>;
  }
  if (!user.has_account) {
    return (
      <span className="rounded-full bg-orange-50 px-3 py-1 text-xs text-danger">ยังไม่เคยเข้าระบบ</span>
    );
  }
  return <span className="rounded-full bg-accent-soft px-3 py-1 text-xs text-accent">ใช้งานอยู่</span>;
}

function EditPanel({
  user,
  groups,
  isSelf,
  onClose,
}: {
  user: Profile;
  groups: StaffGroup[];
  isSelf: boolean;
  onClose: () => void;
}) {
  const { run, pending } = useRun();
  const [d, setD] = useState<Draft>({
    fullName: user.full_name,
    role: user.role === "head" && user.is_admin ? "admin" : user.role,
    staffGroupId: user.staff_group_id,
    countsInScore: user.counts_in_score,
    isAdmin: user.is_admin,
    isActive: user.is_active,
    googleEmail: user.google_email ?? "",
  });

  const save = (patch: Partial<Draft> = {}) => {
    const v = { ...d, ...patch };
    run(
      () =>
        updateUserAction({
          id: user.id,
          fullName: v.fullName,
          role: v.role,
          staffGroupId: v.role === "staff" ? v.staffGroupId : null,
          countsInScore: v.countsInScore,
          isActive: v.isActive,
          googleEmail: v.googleEmail.trim(),
        }),
      "บันทึกแล้ว",
      onClose,
    );
  };

  return (
    <div className="space-y-4 bg-stone-50/60 px-5 py-4">
      <div className="grid gap-3 md:grid-cols-4">
        <div>
          <label className="label">ชื่อ-สกุล</label>
          <input
            className="input"
            value={d.fullName}
            onChange={(e) => setD({ ...d, fullName: e.target.value })}
          />
        </div>
        <div>
          <label className="label">บทบาท</label>
          <select
            className="input"
            value={d.role}
            onChange={(e) => setD({ ...d, role: e.target.value as Draft["role"] })}
          >
            <option value="staff">พนักงาน</option>
            <option value="head">หัวหน้า</option>
            <option value="admin">แอดมิน (ผู้ดูแลระบบ)</option>
          </select>
        </div>
        {d.role === "staff" ? (
          <div>
            <label className="label">กลุ่ม</label>
            <GroupSelect
              groups={groups}
              value={d.staffGroupId}
              onChange={(v) => setD({ ...d, staffGroupId: v })}
            />
          </div>
        ) : d.role === "admin" ? (
          <p className="pt-7 text-xs text-muted md:col-span-2">
            เห็นทุกหน้า ไม่อยู่ในรายชื่อที่ถูกประเมิน และไม่นับคะแนนที่กรอก
          </p>
        ) : (
          <label className="flex items-center gap-2 pt-7 text-sm">
            <input
              type="checkbox"
              checked={d.countsInScore}
              onChange={(e) => setD({ ...d, countsInScore: e.target.checked })}
            />
            นำคะแนนที่ให้ไปคำนวณ
          </label>
        )}
      </div>
      <div className="md:max-w-md">
        <label className="label" htmlFor={`g-${user.id}`}>
          อีเมล Google ที่ใช้เข้าสู่ระบบ
        </label>
        <input
          id={`g-${user.id}`}
          type="email"
          className="input"
          placeholder="name@gmail.com"
          value={d.googleEmail}
          onChange={(e) => setD({ ...d, googleEmail: e.target.value })}
        />
        <p className="mt-1 text-xs text-muted">คนนี้กด "เข้าสู่ระบบด้วย Google" ด้วยอีเมลนี้ได้เลย</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => save()}>
          {pending && <Spinner size={14} />}
          บันทึก
        </button>
        {!isSelf && (
          <button
            className={`btn btn-sm ${user.is_active ? "btn-danger" : ""}`}
            disabled={pending}
            onClick={() => {
              if (user.is_active && !confirm(`ปิดใช้งานบัญชีของ ${user.full_name}?`)) return;
              save({ isActive: !user.is_active });
            }}
          >
            {user.is_active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
          </button>
        )}
        <button className="btn btn-sm" onClick={onClose}>
          ยกเลิก
        </button>
        {!isSelf && (
          <button
            className="btn btn-sm btn-danger ml-auto"
            disabled={pending}
            onClick={() => {
              if (
                confirm(
                  `ลบ ${user.full_name} ถาวร?

คะแนนที่คนนี้ให้และได้รับทั้งหมดจะถูกลบด้วย และกู้คืนไม่ได้
ถ้าแค่ไม่ต้องการให้เข้าระบบ ให้ใช้ "ปิดใช้งาน" แทน`,
                )
              ) {
                run(() => deleteUserAction({ id: user.id }), "ลบแล้ว", onClose);
              }
            }}
          >
            ลบถาวร
          </button>
        )}
      </div>
    </div>
  );
}

function GroupNames({ groups }: { groups: StaffGroup[] }) {
  const { run, pending } = useRun();
  const [names, setNames] = useState<Record<number, string>>(
    Object.fromEntries(groups.map((g) => [g.id, g.name])),
  );
  return (
    <details className="card group">
      <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold">
        แก้ชื่อกลุ่มพนักงาน
        <span className="ml-2 text-xs font-normal text-muted">
          ({groups.map((g) => g.name).join(" · ")})
        </span>
      </summary>
      <div className="space-y-3 border-t border-line p-5">
        {groups.map((g) => (
          <div key={g.id} className="flex gap-2">
            <input
              className="input"
              value={names[g.id] ?? ""}
              onChange={(e) => setNames({ ...names, [g.id]: e.target.value })}
            />
            <button
              className="btn"
              disabled={pending || names[g.id] === g.name}
              onClick={() => run(() => renameStaffGroupAction({ id: g.id, name: names[g.id] }), "บันทึกแล้ว")}
            >
              บันทึก
            </button>
          </div>
        ))}
      </div>
    </details>
  );
}

type Filter = "all" | "head" | "admin" | "pending" | `g${number}`;

export function UsersPanel({
  users,
  groups,
  selfId,
}: {
  users: Profile[];
  groups: StaffGroup[];
  selfId: string;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [showInvite, setShowInvite] = useState(false);
  const [open, setOpen] = useState<{ id: string; kind: "edit" } | null>(null);

  const groupName = (id: number | null) => groups.find((g) => g.id === id)?.name ?? "พนักงาน";

  const chips: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "ทั้งหมด", count: users.length },
    { key: "head", label: "หัวหน้า", count: users.filter((u) => u.role === "head" && !u.is_admin).length },
    { key: "admin", label: "แอดมิน", count: users.filter((u) => u.role === "head" && u.is_admin).length },
    ...groups.map((g) => ({
      key: `g${g.id}` as Filter,
      label: g.name,
      count: users.filter((u) => u.staff_group_id === g.id).length,
    })),
    { key: "pending", label: "ยังไม่เคยเข้าระบบ", count: users.filter((u) => !u.has_account).length },
  ];

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return users.filter((u) => {
      if (filter === "head" && !(u.role === "head" && !u.is_admin)) return false;
      if (filter === "admin" && !(u.role === "head" && u.is_admin)) return false;
      if (filter === "pending" && u.has_account) return false;
      if (filter.startsWith("g") && `g${u.staff_group_id}` !== filter) return false;
      return (
        !needle ||
        u.full_name.toLowerCase().includes(needle) ||
        (u.email ?? "").toLowerCase().includes(needle)
      );
    });
  }, [users, q, filter]);

  return (
    <div className="space-y-5">
      <div className="card flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
        <div className="relative md:w-80">
          <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="input pl-11"
            placeholder="ค้นหาชื่อ"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={() => setShowInvite((v) => !v)}>
            <Plus size={17} /> เพิ่มผู้ใช้
          </button>
        </div>
      </div>

      {showInvite && (
        <AddPersonForm groups={groups} onDone={() => setShowInvite(false)} />
      )}

      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            className={`rounded-full border px-4 py-1.5 text-sm transition duration-150 ${
              filter === c.key
                ? "border-accent bg-accent text-white shadow-glow"
                : "border-line bg-white/70 text-muted hover:text-ink"
            }`}
          >
            {c.label} <span className="tabular-nums opacity-80">{c.count}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="card px-5 py-10 text-center text-sm text-muted">ไม่พบผู้ใช้ที่ตรงกับตัวกรอง</p>
      ) : (
        <div className="card overflow-hidden">
          <div className="hidden grid-cols-[2.2fr_1.3fr_1fr_15rem] gap-4 border-b border-line bg-stone-50/90 px-5 py-3 text-xs font-semibold text-muted md:grid">
            <span>ชื่อ</span>
            <span>กลุ่ม / บทบาท</span>
            <span>สถานะ</span>
            <span className="w-60 text-right" />
          </div>
          <ul className="divide-y divide-line/70">
            {shown.map((u) => {
              const isOpen = open?.id === u.id;
              return (
                <li key={u.id}>
                  <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-5 py-3 md:grid-cols-[2.2fr_1.3fr_1fr_15rem]">
                    <div className="min-w-0">
                      <p className={`truncate text-sm ${u.is_active ? "" : "text-muted line-through"}`}>
                        {u.full_name}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {u.google_email ?? u.email ?? "ยังไม่ได้ใส่อีเมล Google"}
                      </p>
                    </div>
                    <p className="order-3 text-xs text-muted md:order-none md:text-sm">
                      {u.role === "head"
                        ? u.is_admin
                          ? "แอดมิน"
                          : `หัวหน้า${u.counts_in_score ? "" : " · ไม่นำไปคำนวณ"}`
                        : `${groupName(u.staff_group_id)}${u.is_admin ? " · แอดมิน" : ""}`}
                    </p>
                    <div className="order-4 md:order-none">
                      <StatusPill user={u} />
                    </div>
                    <div className="row-span-2 flex flex-wrap justify-end gap-2 md:row-span-1">
                      <button
                        className="btn btn-sm"
                        onClick={() => setOpen(isOpen && open?.kind === "edit" ? null : { id: u.id, kind: "edit" })}
                      >
                        แก้ไข
                      </button>
                    </div>
                  </div>
                  {isOpen && open?.kind === "edit" && (
                    <EditPanel
                      key={`${u.id}-${u.full_name}-${u.role}-${u.is_active}-${u.counts_in_score}-${u.staff_group_id}-${u.is_admin}-${u.google_email ?? ""}`}
                      user={u}
                      groups={groups}
                      isSelf={u.id === selfId}
                      onClose={() => setOpen(null)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <GroupNames groups={groups} />
    </div>
  );
}
