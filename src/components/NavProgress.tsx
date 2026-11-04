"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Shows the top progress bar as soon as an internal link is clicked, and hides it once the new
 * page has arrived (path or query changed). Covers menu, person list and back links alike.
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => {
    document.documentElement.removeAttribute("data-navigating");
  }, [pathname, search]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    function onClick(e: MouseEvent) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      document.documentElement.setAttribute("data-navigating", "");
      clearTimeout(timer);
      timer = setTimeout(() => document.documentElement.removeAttribute("data-navigating"), 20000);
    }
    // capture phase: next/link calls preventDefault() on its own click, so a bubbling listener would skip it
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clearTimeout(timer);
      document.documentElement.removeAttribute("data-navigating");
    };
  }, []);

  return null;
}
