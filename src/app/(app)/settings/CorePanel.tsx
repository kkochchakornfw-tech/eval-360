"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useRun } from "@/components/useRun";
import {
  deleteSettingRowAction,
  moveSettingRowAction,
  saveCoreGroupAction,
  saveCoreQuestionAction,
} from "@/app/actions/settings";
import type { CoreGroupWithQuestions } from "@/types/database";

type Kind = "core_groups" | "core_questions" | "job_items";

export function OrderDelete({
  kind,
  id,
  confirmText,
  isFirst,
  isLast,
}: {
  kind: Kind;
  id: number;
  confirmText: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { run, pending } = useRun();
  return (
    <div className="flex shrink-0 items-center">
      <button
        aria-label="เลื่อนขึ้น"
        className="rounded p-1.5 text-muted hover:bg-stone-100 disabled:opacity-30"
        disabled={pending || isFirst}
        onClick={() => run(() => moveSettingRowAction({ kind, id, direction: "up" }))}
      >
        <ArrowUp size={15} />
      </button>
      <button
        aria-label="เลื่อนลง"
        className="rounded p-1.5 text-muted hover:bg-stone-100 disabled:opacity-30"
        disabled={pending || isLast}
        onClick={() => run(() => moveSettingRowAction({ kind, id, direction: "down" }))}
      >
        <ArrowDown size={15} />
      </button>
      <button
        aria-label="ลบ"
        className="rounded p-1.5 text-danger hover:bg-red-50 disabled:opacity-30"
        disabled={pending}
        onClick={() => {
          if (confirm(confirmText)) run(() => deleteSettingRowAction({ kind, id }), "ลบแล้ว");
        }}
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

function EditableText({
  value,
  onSave,
  pending,
}: {
  value: string;
  onSave: (v: string) => void;
  pending: boolean;
}) {
  const [text, setText] = useState(value);
  return (
    <div className="flex min-w-0 flex-1 gap-2">
      <input className="input" value={text} onChange={(e) => setText(e.target.value)} />
      <button className="btn btn-sm self-center" disabled={pending || text === value} onClick={() => onSave(text)}>
        บันทึก
      </button>
    </div>
  );
}

function GroupBlock({
  group,
  cycleId,
  isFirst,
  isLast,
}: {
  group: CoreGroupWithQuestions;
  cycleId: number;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { run, pending } = useRun();
  const [code, setCode] = useState(group.code);
  const [name, setName] = useState(group.name);
  const [newQ, setNewQ] = useState("");

  return (
    <section className="card">
      <div className="flex items-center gap-2 border-b border-line p-3">
        <input
          aria-label="รหัสหมวด"
          className="input w-16 text-center"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <input
          aria-label="ชื่อหมวด"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          className="btn btn-sm"
          disabled={pending || (code === group.code && name === group.name)}
          onClick={() => run(() => saveCoreGroupAction({ id: group.id, cycleId, code, name }), "บันทึกแล้ว")}
        >
          บันทึก
        </button>
        <OrderDelete
          kind="core_groups"
          id={group.id}
          isFirst={isFirst}
          isLast={isLast}
          confirmText={`ลบหมวด ${group.code} พร้อมคำถามและคำตอบทั้งหมดในหมวดนี้?`}
        />
      </div>
      <ul className="divide-y divide-line">
        {group.questions.map((q, i) => (
          <li key={`${q.id}-${q.text}`} className="flex items-center gap-2 p-3">
            <span className="w-8 shrink-0 text-xs text-muted tabular-nums">
              {group.code}
              {i + 1}
            </span>
            <EditableText
              value={q.text}
              pending={pending}
              onSave={(text) =>
                run(() => saveCoreQuestionAction({ id: q.id, groupId: group.id, text }), "บันทึกแล้ว")
              }
            />
            <OrderDelete
              kind="core_questions"
              id={q.id}
              isFirst={i === 0}
              isLast={i === group.questions.length - 1}
              confirmText="ลบคำถามนี้และคำตอบที่เกี่ยวข้องทั้งหมด?"
            />
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2 border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveCoreQuestionAction({ groupId: group.id, text: newQ }), "เพิ่มคำถามแล้ว", () =>
            setNewQ(""),
          );
        }}
      >
        <input
          className="input"
          placeholder="เพิ่มคำถามใหม่"
          value={newQ}
          onChange={(e) => setNewQ(e.target.value)}
        />
        <button className="btn" disabled={pending || !newQ.trim()}>
          เพิ่ม
        </button>
      </form>
    </section>
  );
}

export function CorePanel({
  cycleId,
  groups,
}: {
  cycleId: number;
  groups: CoreGroupWithQuestions[];
}) {
  const { run, pending } = useRun();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  return (
    <div className="space-y-5">
      {groups.map((g, i) => (
        <GroupBlock
          key={`${g.id}-${g.code}-${g.name}-${g.sort_order}`}
          group={g}
          cycleId={cycleId}
          isFirst={i === 0}
          isLast={i === groups.length - 1}
        />
      ))}
      <form
        className="card flex flex-wrap gap-2 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveCoreGroupAction({ cycleId, code, name }), "เพิ่มหมวดแล้ว", () => {
            setCode("");
            setName("");
          });
        }}
      >
        <input
          className="input w-20 text-center"
          placeholder="รหัส"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <input
          className="input min-w-0 flex-1"
          placeholder="เพิ่มหมวดใหม่"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn" disabled={pending || !code.trim() || !name.trim()}>
          เพิ่มหมวด
        </button>
      </form>
    </div>
  );
}
