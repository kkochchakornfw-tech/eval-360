"use client";

import { useState } from "react";
import { useRun } from "@/components/useRun";
import { createCycleAction, updateCycleAction } from "@/app/actions/settings";
import type { EvalCycle } from "@/types/database";

export function CyclesPanel({ cycles }: { cycles: EvalCycle[] }) {
  const { run, pending } = useRun();
  const [name, setName] = useState("");

  return (
    <div className="space-y-6">
      <form
        className="card space-y-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => createCycleAction({ name }), "สร้างรอบใหม่แล้ว", () => setName(""));
        }}
      >
        <div>
          <h2 className="text-sm font-semibold">สร้างรอบใหม่</h2>
          <p className="mt-1 text-xs text-muted">
            คัดลอกคำถาม Core, Job Base และน้ำหนักจากรอบล่าสุด รอบใหม่ยังไม่ถูกตั้งเป็นรอบที่ใช้งาน
          </p>
        </div>
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="เช่น ปี 2569 รอบ 2"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn btn-primary shrink-0" disabled={pending || !name.trim()}>
            สร้าง
          </button>
        </div>
      </form>

      <ul className="card divide-y divide-line">
        {cycles.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-medium">
                {c.name}
                {c.is_current && <span className="ml-2 text-xs font-normal text-accent">รอบที่ใช้งาน</span>}
              </p>
              <p className="mt-0.5 text-xs text-muted">{c.is_open ? "เปิดรับการประเมิน" : "ปิดรอบแล้ว"}</p>
            </div>
            <div className="flex gap-2">
              <button
                className="btn btn-sm"
                disabled={pending}
                onClick={() =>
                  run(
                    () => updateCycleAction({ id: c.id, isOpen: !c.is_open }),
                    c.is_open ? "ปิดรอบแล้ว" : "เปิดรอบแล้ว",
                  )
                }
              >
                {c.is_open ? "ปิดรอบ" : "เปิดรอบ"}
              </button>
              {!c.is_current && (
                <button
                  className="btn btn-sm"
                  disabled={pending}
                  onClick={() =>
                    run(() => updateCycleAction({ id: c.id, isCurrent: true }), "ตั้งเป็นรอบที่ใช้งานแล้ว")
                  }
                >
                  ใช้รอบนี้
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
