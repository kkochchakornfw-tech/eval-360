import { LogOut } from "lucide-react";
import { canAdmin } from "@/lib/roles";
import { requireProfile } from "@/lib/session";
import { signOutAction } from "@/app/actions/auth";
import { BottomNav, SidebarNav } from "@/components/AppNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const isHead = canAdmin(profile);

  const account = (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent">
          {profile.full_name.trim().charAt(0)}
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium">{profile.full_name}</p>
          <p className="text-xs text-muted">{profile.is_admin ? "แอดมิน" : profile.role === "head" ? "หัวหน้า" : "พนักงาน"}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-muted">
        <form action={signOutAction}>
          <button className="inline-flex items-center gap-1 hover:text-ink">
            <LogOut size={13} /> ออกจากระบบ
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className={`min-h-dvh ${isHead ? "max-md:[--bottom-nav:88px]" : ""}`}>
      {isHead && (
        <aside className="card fixed bottom-4 left-4 top-4 hidden w-64 flex-col justify-between p-4 md:flex">
          <div>
            <div className="mb-6 flex items-center gap-3 px-2 pt-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-sm font-bold text-white shadow-glow">
                360
              </div>
              <p className="text-base font-semibold leading-tight">ประเมิน
                <br />
                360 องศา
              </p>
            </div>
            <SidebarNav />
          </div>
          <div className="border-t border-line px-2 pt-4">{account}</div>
        </aside>
      )}

      <div className={isHead ? "md:pl-72" : ""}>
        {isHead ? (
          <header className="card sticky top-3 z-20 mx-3 mt-3 flex items-center justify-between px-4 py-3 md:hidden">
            <p className="text-base font-semibold">ประเมิน 360 องศา</p>
            <details className="relative">
              <summary className="cursor-pointer list-none text-sm text-muted">
                {profile.full_name}
              </summary>
              <div className="card absolute right-0 z-40 mt-3 w-64 bg-white p-4">{account}</div>
            </details>
          </header>
        ) : (
          // ordinary staff have no sidebar: a visible bar with the sign-out button on every screen size
          <div className="mx-auto w-full max-w-[90rem] px-3 pt-3 md:px-10 md:pt-6">
            <header className="card sticky top-3 z-20 flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
                  {profile.full_name.trim().charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium leading-tight">{profile.full_name}</p>
                  <p className="text-xs text-muted">ประเมิน 360 องศา</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <form action={signOutAction}>
                  <button className="btn btn-sm btn-danger">
                    <LogOut size={14} /> ออกจากระบบ
                  </button>
                </form>
              </div>
            </header>
          </div>
        )}
        <main
          className={`mx-auto w-full max-w-[90rem] px-4 py-8 md:px-10 md:py-12 ${
            isHead ? "pb-32 md:pb-12" : "pb-32"
          }`}
        >
          {children}
        </main>
      </div>

      {isHead && <BottomNav />}
    </div>
  );
}
