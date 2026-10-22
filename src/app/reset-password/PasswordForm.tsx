"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { changeSecretAction } from "@/app/actions/accounts";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { PasswordInput } from "@/components/PasswordInput";
import { Spinner } from "@/components/Spinner";

export function PasswordForm({
  home,
  email,
  min,
  label,
  numeric,
}: {
  home: string;
  email: string | null;
  min: number;
  label: string;
  numeric: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [secret, setSecret] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (numeric && !/^\d+$/.test(secret)) return toast.error("PIN ต้องเป็นตัวเลขเท่านั้น");
    if (secret.length < min) return toast.error(`ต้องมีอย่างน้อย ${min} ${numeric ? "หลัก" : "ตัวอักษร"}`);
    if (secret !== confirm) return toast.error("รหัสทั้งสองช่องไม่ตรงกัน");
    setBusy(true);
    const res = await changeSecretAction({ secret });
    if (!res.ok) {
      setBusy(false);
      return toast.error(res.error);
    }
    // make sure the session is fresh after the secret changed
    if (res.email) await createClient().auth.signInWithPassword({ email: res.email, password: secret });
    toast.success("ตั้งรหัสเรียบร้อย");
    router.replace(home);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div>
        <label className="label" htmlFor="pw">
          {label}
        </label>
        <PasswordInput id="pw" autoComplete="new-password" value={secret} onChange={setSecret} numeric={numeric} />
        <p className="mt-1.5 text-xs text-muted">
          {numeric ? `ตัวเลขอย่างน้อย ${min} หลัก` : `อย่างน้อย ${min} ตัวอักษร`}
        </p>
      </div>
      <div>
        <label className="label" htmlFor="pw2">
          ยืนยันอีกครั้ง
        </label>
        <PasswordInput id="pw2" autoComplete="new-password" value={confirm} onChange={setConfirm} numeric={numeric} />
      </div>
      <button className="btn btn-primary w-full" disabled={busy}>
        {busy && <Spinner />}
        {busy ? "กำลังบันทึก…" : "บันทึก"}
      </button>
    </form>
  );
}
