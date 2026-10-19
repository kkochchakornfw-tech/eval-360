"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardCheck,
  ClipboardList,
  Database,
  FileText,
  Settings,
  type LucideIcon,
} from "lucide-react";

interface Item {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
}

export const HEAD_ITEMS: Item[] = [
  { href: "/evaluate", label: "ตอบแบบสอบถาม", short: "ตอบ", icon: ClipboardList },
  { href: "/assess", label: "แบบประเมินหัวหน้า", short: "หัวหน้า", icon: ClipboardCheck },
  { href: "/dashboard", label: "ภาพรวมและกราฟ", short: "ภาพรวม", icon: BarChart3 },
  { href: "/report", label: "รายงานบุคคล", short: "รายงาน", icon: FileText },
  { href: "/settings", label: "ตั้งค่าระบบ", short: "ตั้งค่า", icon: Settings },
  { href: "/data", label: "จัดการข้อมูล", short: "ข้อมูล", icon: Database },
];

function useActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav() {
  const isActive = useActive();
  return (
    <nav className="space-y-1.5">
      {HEAD_ITEMS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition duration-150 ${
            isActive(href)
              ? "bg-accent font-medium text-white shadow-glow"
              : "text-muted hover:bg-white/80 hover:text-ink"
          }`}
        >
          <Icon size={18} strokeWidth={1.8} />
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function BottomNav() {
  const isActive = useActive();
  return (
    <nav className="fixed inset-x-3 bottom-3 z-30 flex h-16 rounded-2xl border border-white/80 bg-white/80 p-1 shadow-glass backdrop-blur-xl md:hidden">
      {HEAD_ITEMS.map(({ href, short, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] transition duration-150 ${
            isActive(href) ? "bg-accent font-medium text-white shadow-glow" : "text-muted"
          }`}
        >
          <Icon size={19} strokeWidth={1.8} />
          {short}
        </Link>
      ))}
    </nav>
  );
}
