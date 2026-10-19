import { homeFor, requireProfile } from "@/lib/session";
import { PasswordForm } from "./PasswordForm";

export default async function ResetPasswordPage() {
  const profile = await requireProfile();
  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="card w-full max-w-md p-8 md:p-10">
        <h1 className="text-2xl font-semibold tracking-tight">ตั้งรหัสผ่านใหม่</h1>
        <p className="mt-1.5 text-sm text-muted">{profile.full_name}</p>
        <PasswordForm home={homeFor(profile)} />
      </div>
    </main>
  );
}
