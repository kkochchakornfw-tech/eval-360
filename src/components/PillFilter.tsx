"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FilterOption } from "@/components/FilterBar";

/** Segmented pill buttons that write the chosen value to the URL query string. */
export function PillFilter({
  param,
  value,
  options,
}: {
  param: string;
  value: string;
  options: FilterOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function choose(next: string) {
    const q = new URLSearchParams(params.toString());
    q.set(param, next);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  }

  return (
    <div role="tablist" className="card inline-flex max-w-full gap-1 overflow-x-auto p-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => choose(o.value)}
          className={`whitespace-nowrap rounded-xl px-5 py-2 text-sm transition duration-150 ${
            value === o.value
              ? "bg-accent font-medium text-white shadow-glow"
              : "text-muted hover:bg-white/80 hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
