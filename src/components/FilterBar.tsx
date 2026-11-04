"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Spinner } from "@/components/Spinner";
import { useUrlNav } from "@/components/useUrlNav";

export interface FilterOption {
  value: string;
  label: string;
}

/** Selects that write to the URL query string, so the server page re-renders with the filter. */
export function FilterBar({
  filters,
}: {
  filters: { key: string; label: string; value: string; options: FilterOption[] }[];
}) {
  const nav = useUrlNav();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    next.set(key, value);
    nav.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-3">
      {filters.map((f) => (
        <div key={f.key} className="min-w-[160px] flex-1 md:flex-none">
          <label className="label flex items-center gap-1.5">
            {f.label}
            {nav.pending && <Spinner size={12} />}
          </label>
          <select className="input" value={f.value} onChange={(e) => set(f.key, e.target.value)}>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
