"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

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
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    next.set(key, value);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap gap-3">
      {filters.map((f) => (
        <div key={f.key} className="min-w-[160px] flex-1 md:flex-none">
          <label className="label">{f.label}</label>
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
