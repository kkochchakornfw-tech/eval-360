import { minSecretLength } from "@/lib/roles";
import { homeFor, requireProfile } from "@/lib/session";
import { PasswordForm } from "./PasswordForm";

export default async function ResetPasswordPage() {
  const profile = await requireProfile({ allowMustChange: true });
  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="card w-full max-w-md p-8 md:p-10">
        <h1 className="text-2xl font-semibold tracking-tight">
          {profile.must_change_password ? "ตั้งรหัส PIN ใหม่ของคุณ" : "เปลี่ยนรหัส PIN"}
        </h1>
        <p className="mt-1.5 text-sm text-muted">{profile.full_name}</p>
        {profile.must_change_password && (
          <p className="mt-4 rounded-xl border border-line bg-white/70 px-4 py-3 text-sm text-muted">
            เข้าสู่ระบบครั้งแรก กรุณาตั้งรหัสใหม่ที่คุณจำได้ก่อนใช้งาน
          </p>
        )}
        <PasswordForm
          home={homeFor(profile)}
          email={profile.email}
          min={minSecretLength(profile)}
          label="รหัส PIN ใหม่ (ตัวเลข)"
          numeric
        />
      </div>
    </main>
  );
}
