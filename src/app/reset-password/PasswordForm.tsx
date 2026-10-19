"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { firstError, newPasswordSchema } from "@/lib/validation";
import { useToast } from "@/components/Toast";
import { PasswordInput } from "@/components/PasswordInput";
import { Spinner } from "@/components/Spinner";

/** Sets a new password for the signed-in user (reached from an emailed reset link). */
export function PasswordForm({ home }: { home: string }) {
  const router = useRouter();
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = newPasswordSchema.safeParse({ password, confirm });
    if (!parsed.success) return toast.error(firstError(parsed.error));
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password: parsed.data.password });
    if (error) {
      setBusy(false);
      return toast.error("ตั้งรหัสผ่านไม่สำเร็จ กรุณาลองใหม่");
    }
    toast.success("ตั้งรหัสผ่านเรียบร้อย");
    router.replace(home);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div>
        <label className="label" htmlFor="pw">
          รหัสผ่านใหม่
        </label>
        <PasswordInput id="pw" autoComplete="new-password" value={password} onChange={setPassword} />
        <p className="mt-1.5 text-xs text-muted">อย่างน้อย 8 ตัวอักษร</p>
      </div>
      <div>
        <label className="label" htmlFor="pw2">
          ยืนยันอีกครั้ง
        </label>
        <PasswordInput id="pw2" autoComplete="new-password" value={confirm} onChange={setConfirm} />
      </div>
      <button className="btn btn-primary w-full" disabled={busy}>
        {busy && <Spinner />}
        {busy ? "กำลังบันทึก…" : "บันทึก"}
      </button>
    </form>
  );
}
