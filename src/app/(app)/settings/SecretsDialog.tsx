"use client";

import { useState } from "react";
import { Check, Copy, X } from "lucide-react";
import type { IssuedSecret } from "@/app/actions/accounts";

/**
 * Shows freshly generated PINs once. They are stored hashed, so this is the only chance to hand
 * them out (copy or write down).
 */
export function SecretsDialog({
  secrets,
  onClose,
}: {
  secrets: IssuedSecret[];
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);

  /**
   * navigator.clipboard only exists on secure origins (https / localhost). The app is also opened
   * over plain http on the company network, so fall back to a hidden textarea + execCommand.
   */
  async function writeClipboard(text: string): Promise<boolean> {
    try {
      if (window.isSecureContext && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // fall through to the legacy path
    }
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "0";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.focus();
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    document.body.removeChild(area);
    return ok;
  }

  async function copy() {
    // tab-separated: pastes straight into Excel as name | group | code
    const text = secrets.map((s) => `${s.name}\t${s.group}\t${s.secret}`).join("\n");
    const ok = await writeClipboard(text);
    setCopied(ok ? "ok" : "fail");
    setTimeout(() => setCopied(null), 2500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-sm">
      <div className="card flex max-h-[90dvh] w-full max-w-3xl flex-col bg-white p-0">
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold">รหัส PIN สำหรับแจก</h2>
            <p className="mt-1 text-sm text-danger">
              แสดงครั้งเดียวเท่านั้น ปิดหน้านี้แล้วดูอีกไม่ได้ กรุณาคัดลอกหรือจดก่อนปิด
            </p>
            <p className="mt-1 text-xs text-muted">
              หน้าเข้าสู่ระบบ: เลือกชื่อแล้วใส่ PIN นี้ จากนั้นระบบจะให้ตั้ง PIN ใหม่ของตัวเองในการเข้าครั้งแรก
            </p>
          </div>
          <button type="button" aria-label="ปิด" className="text-muted hover:text-ink" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="th">ชื่อ</th>
                <th className="th">กลุ่ม</th>
                <th className="th text-right">PIN</th>
              </tr>
            </thead>
            <tbody>
              {secrets.map((s) => (
                <tr key={s.id}>
                  <td className="td">{s.name}</td>
                  <td className="td text-muted">{s.group}</td>
                  <td className="td num font-mono tracking-widest">{s.secret}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-4">
          <button type="button" className="btn" onClick={copy}>
            {copied === "ok" ? <Check size={16} /> : <Copy size={16} />}
            {copied === "ok" ? "คัดลอกแล้ว" : copied === "fail" ? "คัดลอกไม่สำเร็จ ให้จดเอง" : "คัดลอกทั้งหมด"}
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
