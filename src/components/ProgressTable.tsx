"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { EvaluatorProgress, EvaluatorRef } from "@/lib/report";

export interface ProgressRow {
  id: string;
  name: string;
  peersDone: number;
  peersExpected: number;
  headDone: boolean;
  evaluatedBy: EvaluatorRef[];
  notEvaluatedBy: EvaluatorRef[];
}

type View = "person" | "evaluator";

/**
 * One section, two views (toggle): how many colleagues have evaluated each person, and who has
 * not evaluated anyone yet. Clicking a name in the first view opens the full who-did / who-didn't list.
 */
export function ProgressSection({
  rows,
  evaluators,
  completeCount,
}: {
  rows: ProgressRow[];
  evaluators: EvaluatorProgress[];
  completeCount: number;
}) {
  const [view, setView] = useState<View>("person");
  const [openId, setOpenId] = useState<string | null>(null);
  const open = rows.find((r) => r.id === openId) ?? null;
  const none = evaluators.filter((e) => e.done === 0);

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" className="card inline-flex gap-1 p-1">
          {(
            [
              ["person", "ความคืบหน้า"],
              ["evaluator", `ยังไม่ได้ประเมินใครเลย (${none.length})`],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`whitespace-nowrap rounded-xl px-4 py-1.5 text-sm transition duration-150 ${
                view === v ? "bg-accent font-medium text-white shadow-glow" : "text-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {view === "person" && (
          <span className="text-xs tabular-nums text-muted">
            ถูกเพื่อนประเมินครบทุกคนแล้ว {completeCount}/{rows.length} คน
          </span>
        )}
      </div>

      {view === "person" ? (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse">
              <thead>
                <tr>
                  <th className="th">ชื่อ</th>
                  <th className="th text-right">เพื่อนประเมินแล้ว / เพื่อนทั้งหมด</th>
                  <th className="th text-right">หัวหน้าประเมิน</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td className="td">
                      <button
                        type="button"
                        onClick={() => setOpenId(p.id)}
                        className="text-left text-accent-dark underline-offset-2 hover:underline"
                      >
                        {p.name}
                      </button>
                    </td>
                    <td className="td num">
                      {p.peersDone}/{p.peersExpected}
                    </td>
                    <td className={`td text-right ${p.headDone ? "text-accent" : "text-muted"}`}>
                      {p.headDone ? "ประเมินแล้ว" : "ยังไม่ประเมิน"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">
            ตัวเลข 1/30 = มีเพื่อนในรายชื่อให้คะแนนคนนี้แล้ว 1 คน จากเพื่อนทั้งหมด 30 คน (ไม่นับตัวเอง) คลิกที่ชื่อเพื่อดูรายชื่อ
          </p>
        </>
      ) : (
        <div className="card overflow-x-auto">
          {none.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">ทุกคนประเมินอย่างน้อย 1 คนแล้ว</p>
          ) : (
            <table className="w-full min-w-[360px] border-collapse">
              <thead>
                <tr>
                  <th className="th">ชื่อ</th>
                  <th className="th">กลุ่ม</th>
                  <th className="th text-right">ประเมินเพื่อนแล้ว</th>
                </tr>
              </thead>
              <tbody>
                {none.map((e) => (
                  <tr key={e.id}>
                    <td className="td">
                      {e.name}
                      {!e.hasAccount && <span className="ml-2 text-xs text-muted">(ยังไม่มีบัญชี)</span>}
                    </td>
                    <td className="td text-muted">{e.groupName}</td>
                    <td className="td num">
                      {e.done}/{e.expected}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {open && (
        <Modal title={open.name} onClose={() => setOpenId(null)}>
          <p className="text-sm text-muted">
            ให้คะแนนคนนี้แล้ว {open.evaluatedBy.length} คน · ยังไม่ได้ให้ {open.notEvaluatedBy.length} คน (จากทั้งหมด{" "}
            {open.evaluatedBy.length + open.notEvaluatedBy.length} คน)
          </p>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <NameList title="ให้คะแนนคนนี้แล้ว" people={open.evaluatedBy} />
            <NameList title="ยังไม่ได้ให้คะแนนคนนี้" people={open.notEvaluatedBy} muted />
          </div>
        </Modal>
      )}
    </section>
  );
}

function NameList({ title, people, muted }: { title: string; people: EvaluatorRef[]; muted?: boolean }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">
        {title} <span className="tabular-nums text-muted">({people.length})</span>
      </h3>
      {people.length === 0 ? (
        <p className="text-sm text-muted">-</p>
      ) : (
        <ul className="divide-y divide-line/70 rounded-xl border border-line">
          {people.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className={muted ? "text-muted" : ""}>
                {p.name}
                {!p.hasAccount && <span className="ml-1.5 text-xs">(ยังไม่มีบัญชี)</span>}
              </span>
              <span className="shrink-0 text-xs text-muted">{p.groupName}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="card flex max-h-[90dvh] w-full max-w-3xl flex-col bg-white p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" className="btn btn-sm" onClick={onClose} aria-label="ปิด">
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
