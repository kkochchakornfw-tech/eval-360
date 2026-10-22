"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  listLoginPeopleAction,
  signInByNameAction,
  type LoginPerson,
} from "@/app/actions/accounts";
import { createClient } from "@/lib/supabase/client";
import { firstError, loginSchema } from "@/lib/validation";
import { useToast } from "@/components/Toast";
import { PasswordInput } from "@/components/PasswordInput";
import { Spinner } from "@/components/Spinner";

// Google sign-in stays in the code but is only shown once it is set up (see README)
const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "on";

export function LoginForm() {
  const router = useRouter();
  const toast = useToast();
  // everyone signs in by name + PIN; the email form is a small fallback for the admin account
  const [mode, setMode] = useState<"name" | "email">("name");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const [people, setPeople] = useState<LoginPerson[] | null>(null);
  const [picked, setPicked] = useState("");

  useEffect(() => {
    let alive = true;
    listLoginPeopleAction()
      .then((list) => alive && setPeople(list))
      .catch(() => alive && setPeople([]));
    return () => {
      alive = false;
    };
  }, []);

  function done() {
    // keep the spinner on while the next page loads
    router.replace("/");
    router.refresh();
  }

  async function onName(e: React.FormEvent) {
    e.preventDefault();
    if (!picked) return toast.error("กรุณาเลือกชื่อของคุณ");
    if (!password) return toast.error("กรุณากรอกรหัส PIN");
    setBusy(true);
    const res = await signInByNameAction({ id: picked, secret: password });
    if (!res.ok) {
      setBusy(false);
      return toast.error(res.error);
    }
    done();
  }

  async function onEmail(e: React.FormEvent) {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) return toast.error(firstError(parsed.error));
    setBusy(true);
    const { error } = await createClient().auth.signInWithPassword(parsed.data);
    if (error) {
      setBusy(false);
      return toast.error("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    }
    done();
  }

  async function onGoogle() {
    setBusy(true);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/` },
    });
    if (error) {
      setBusy(false);
      toast.error("เชื่อมต่อ Google ไม่สำเร็จ กรุณาลองใหม่");
    }
  }

  const groups = people ? [...new Set(people.map((p) => p.group))] : [];

  return (
    <form onSubmit={mode === "name" ? onName : onEmail} className="mt-6 space-y-4">
      {mode === "name" ? (
        <>
          <div>
            <label className="label" htmlFor="who">
              ชื่อของคุณ
            </label>
            {people === null ? (
              <div className="h-[46px] animate-pulse rounded-xl bg-stone-100" />
            ) : people.length === 0 ? (
              <p className="rounded-xl border border-line bg-white/70 px-4 py-3 text-sm text-muted">
                ยังไม่มีบัญชี ติดต่อหัวหน้าเพื่อสร้างบัญชีให้
              </p>
            ) : (
              <select
                id="who"
                className="input"
                value={picked}
                onChange={(e) => setPicked(e.target.value)}
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
            )}
          </div>
          <div>
            <label className="label" htmlFor="secret">
              รหัส PIN
            </label>
            <PasswordInput
              id="secret"
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
              numeric
            />
          </div>
        </>
      ) : (
        <>
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
        </>
      )}

      <button className="btn btn-primary w-full" disabled={busy}>
        {busy && <Spinner />}
        {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
      </button>

      {mode === "name" ? (
        <p className="text-center text-xs text-muted">ลืมรหัส PIN? ให้หัวหน้าสร้างรหัสใหม่ให้</p>
      ) : null}
      {GOOGLE_ENABLED && (
        <button type="button" className="btn w-full" disabled={busy} onClick={onGoogle}>
          เข้าสู่ระบบด้วย Google
        </button>
      )}
      <button
        type="button"
        className="w-full text-center text-xs text-muted hover:text-ink disabled:opacity-50"
        disabled={busy}
        onClick={() => {
          setMode(mode === "name" ? "email" : "name");
          setPassword("");
        }}
      >
        {mode === "name" ? "เข้าด้วยอีเมล (บัญชีผู้ดูแลเดิม)" : "กลับไปเข้าด้วยชื่อ + PIN"}
      </button>
    </form>
  );
}
