"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import type { LoginPerson } from "@/app/actions/accounts";

/**
 * Name chooser for the login form. On phones the native <select> opens the OS sheet, which is
 * hard to read and not on-brand, so below the `md` breakpoint a white modal with the same groups
 * is used instead. Desktop keeps the plain grouped <select>.
 */
export function NamePicker({
  people,
  groups,
  value,
  onChange,
}: {
  people: LoginPerson[];
  groups: string[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const picked = people.find((p) => p.id === value);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    // keep the page behind the modal from scrolling
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  function close() {
    setOpen(false);
    setQ("");
  }

  const needle = q.trim().toLowerCase();
  const visible = people.filter((p) => !needle || p.name.toLowerCase().includes(needle));

  return (
    <>
      {/* desktop */}
      <select
        id="who"
        className="input hidden md:block"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">เลือกชื่อ</option>
        {groups.map((g) => (
          <optgroup key={g} label={g}>
            {people
              .filter((p) => p.group === g)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </optgroup>
        ))}
      </select>

      {/* phone */}
      <button
        type="button"
        className="input flex w-full items-center justify-between gap-2 text-left md:hidden"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <span className={picked ? "" : "text-muted"}>{picked ? picked.name : "เลือกชื่อ"}</span>
        <ChevronDown size={18} className="shrink-0 text-muted" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-3 md:hidden"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="เลือกชื่อ"
            className="card flex max-h-[85dvh] w-full max-w-md flex-col bg-white p-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
              <h2 className="text-base font-semibold">เลือกชื่อของคุณ</h2>
              <button type="button" aria-label="ปิด" className="text-muted" onClick={close}>
                <X size={20} />
              </button>
            </div>
            <div className="border-b border-line px-5 py-3">
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  className="input pl-10"
                  placeholder="ค้นหาชื่อ"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>
            <div className="overflow-y-auto pb-2">
              {visible.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted">ไม่พบชื่อที่ค้นหา</p>
              ) : (
                groups.map((g) => {
                  const items = visible.filter((p) => p.group === g);
                  if (items.length === 0) return null;
                  return (
                    <section key={g}>
                      <h3 className="sticky top-0 bg-stone-50 px-5 py-2 text-xs font-semibold text-muted">{g}</h3>
                      <ul>
                        {items.map((p) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              className={`flex min-h-[48px] w-full items-center justify-between gap-3 px-5 py-3 text-left text-[15px] ${
                                p.id === value ? "bg-accent-soft text-accent-dark" : ""
                              }`}
                              onClick={() => {
                                onChange(p.id);
                                close();
                              }}
                            >
                              {p.name}
                              {p.id === value && <Check size={18} />}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
