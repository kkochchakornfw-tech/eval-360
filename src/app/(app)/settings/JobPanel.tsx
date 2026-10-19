"use client";

import { useState } from "react";
import { useRun } from "@/components/useRun";
import { saveJobItemAction } from "@/app/actions/settings";
import type { JobItem, StaffGroup } from "@/types/database";
import { OrderDelete } from "./CorePanel";

function ItemRow({
  item,
  index,
  count,
  cycleId,
}: {
  item: JobItem;
  index: number;
  count: number;
  cycleId: number;
}) {
  const { run, pending } = useRun();
  const [text, setText] = useState(item.text);
  const [weight, setWeight] = useState(String(Number(item.weight)));
  const dirty = text !== item.text || Number(weight) !== Number(item.weight);

  return (
    <li className="space-y-2 p-3 md:flex md:items-center md:gap-2 md:space-y-0">
      <input className="input md:flex-1" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex items-center gap-2">
        <input
          aria-label="น้ำหนัก"
          className="input w-20 text-right tabular-nums"
          type="number"
          inputMode="decimal"
          min={0}
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />
        <button
          className="btn btn-sm"
          disabled={pending || !dirty}
          onClick={() =>
            run(
              () =>
                saveJobItemAction({
                  id: item.id,
                  cycleId,
                  staffGroupId: item.staff_group_id,
                  text,
                  weight: Number(weight),
                }),
              "บันทึกแล้ว",
            )
          }
        >
          บันทึก
        </button>
        <OrderDelete
          kind="job_items"
          id={item.id}
          isFirst={index === 0}
          isLast={index === count - 1}
          confirmText="ลบข้อนี้และคะแนนที่เกี่ยวข้องทั้งหมด?"
        />
      </div>
    </li>
  );
}

function GroupSection({
  group,
  items,
  cycleId,
}: {
  group: StaffGroup;
  items: JobItem[];
  cycleId: number;
}) {
  const { run, pending } = useRun();
  const [text, setText] = useState("");
  const [weight, setWeight] = useState("10");
  const total = items.reduce((s, i) => s + Number(i.weight), 0);
  const ok = Math.abs(total - 100) < 1e-9;

  return (
    <section className="card">
      <div className="flex items-baseline justify-between border-b border-line p-3">
        <h2 className="text-sm font-semibold">{group.name}</h2>
        <span className={`text-xs tabular-nums ${ok ? "text-muted" : "text-danger"}`}>
          น้ำหนักรวม {total}
          {!ok && " (ควรเท่ากับ 100)"}
        </span>
      </div>
      <ul className="divide-y divide-line">
        {items.map((it, i) => (
          <ItemRow
            key={`${it.id}-${it.text}-${it.weight}-${it.sort_order}`}
            item={it}
            index={i}
            count={items.length}
            cycleId={cycleId}
          />
        ))}
        {items.length === 0 && <li className="p-3 text-sm text-muted">ยังไม่มีข้อ</li>}
      </ul>
      <form
        className="flex gap-2 border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => saveJobItemAction({ cycleId, staffGroupId: group.id, text, weight: Number(weight) }),
            "เพิ่มข้อแล้ว",
            () => setText(""),
          );
        }}
      >
        <input
          className="input"
          placeholder="เพิ่มข้อ Job Base ใหม่"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <input
          aria-label="น้ำหนัก"
          className="input w-20 text-right tabular-nums"
          type="number"
          min={0}
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />
        <button className="btn" disabled={pending || !text.trim()}>
          เพิ่ม
        </button>
      </form>
    </section>
  );
}

export function JobPanel({
  cycleId,
  staffGroups,
  items,
}: {
  cycleId: number;
  staffGroups: StaffGroup[];
  items: JobItem[];
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        หัวหน้าให้คะแนน 1–5 ต่อข้อ คูณด้วยน้ำหนัก แยกชุดคำถามตามกลุ่มของผู้รับการประเมิน
      </p>
      {staffGroups.map((g) => (
        <GroupSection
          key={g.id}
          group={g}
          cycleId={cycleId}
          items={items.filter((i) => i.staff_group_id === g.id)}
        />
      ))}
    </div>
  );
}
