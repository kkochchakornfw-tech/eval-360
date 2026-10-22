import { redirect } from "next/navigation";
import { IsoScene } from "@/components/IsoScene";
import { getProfile, homeFor } from "@/lib/session";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // already signed in -> go straight to the app
  const profile = await getProfile();
  if (profile?.is_active) redirect(homeFor(profile));

  const notice =
    error === "inactive"
      ? "บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อหัวหน้า"
      : error === "google"
        ? "อีเมล Google นี้ยังไม่ได้รับอนุญาตให้เข้าระบบ กรุณาแจ้งหัวหน้าให้เพิ่มอีเมลของคุณ"
      : error === "link"
        ? "ลิงก์หมดอายุหรือไม่ถูกต้อง กรุณาขอลิงก์ใหม่"
        : null;

  return (
    <main className="mx-auto grid min-h-dvh max-w-[96rem] items-center gap-6 px-5 py-8 lg:grid-cols-[1.1fr_1fr] lg:px-12">
      {/* scene scales with the viewport: smaller above the form on phones, large beside it on desktop */}
      <div className="order-first flex justify-center overflow-hidden lg:order-none">
        <div
          className="flex items-center justify-center"
          style={{ fontSize: "clamp(0.42rem, 2vw, 1.05rem)", height: "34em" }}
        >
          <IsoScene />
        </div>
      </div>

      <div className="card mx-auto w-full max-w-md p-8 md:p-10">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-lg font-bold text-white shadow-glow">
          360
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">ระบบประเมิน 360 องศา</h1>
        <p className="mt-1.5 text-sm text-muted">เข้าสู่ระบบด้วยชื่อและรหัส PIN</p>
        {notice && (
          <p className="mt-5 rounded-xl border border-danger/30 bg-orange-50/80 px-4 py-3 text-sm text-danger">
            {notice}
          </p>
        )}
        <LoginForm />
      </div>
    </main>
  );
}
