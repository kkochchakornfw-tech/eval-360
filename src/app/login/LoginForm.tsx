"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { firstError, loginSchema } from "@/lib/validation";
import { useToast } from "@/components/Toast";
import { PasswordInput } from "@/components/PasswordInput";
import { Spinner } from "@/components/Spinner";

export function LoginForm() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"google" | "email" | null>(null);
  // Google is the way in; email + password stays behind a link as a fallback for the system admin
  const [showEmail, setShowEmail] = useState(false);

  async function onGoogle() {
    setBusy("google");
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/` },
    });
    if (error) {
      setBusy(null);
      toast.error("เชื่อมต่อ Google ไม่สำเร็จ กรุณาลองใหม่");
    }
  }

  async function onEmail(e: React.FormEvent) {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) return toast.error(firstError(parsed.error));
    setBusy("email");
    const { error } = await createClient().auth.signInWithPassword(parsed.data);
    if (error) {
      setBusy(null);
      return toast.error("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    }
    // keep the spinner on while the next page loads
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="mt-6 space-y-4">
      <button type="button" className="btn btn-primary w-full" disabled={busy !== null} onClick={onGoogle}>
        {busy === "google" ? <Spinner /> : <GoogleMark />}
        เข้าสู่ระบบด้วย Google
      </button>
      <p className="text-center text-xs text-muted">ใช้อีเมล Google ที่หัวหน้าลงทะเบียนไว้ให้</p>
      <button
        type="button"
        className="w-full text-center text-xs text-muted hover:text-ink"
        onClick={() => setShowEmail((v) => !v)}
      >
        {showEmail ? "ซ่อน" : "เข้าด้วยอีเมลและรหัสผ่าน (ผู้ดูแลระบบ)"}
      </button>
      {showEmail && (
        <form onSubmit={onEmail} className="space-y-4 border-t border-line pt-4">
          <div>
            <label className="label" htmlFor="email">
              อีเมล
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              รหัสผ่าน
            </label>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
            />
          </div>
          <button className="btn w-full" disabled={busy !== null}>
            {busy === "email" && <Spinner />}
            {busy === "email" ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
          </button>
        </form>
      )}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" className="rounded-full bg-white p-0.5">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}
