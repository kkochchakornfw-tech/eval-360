"use client";

import { useEffect } from "react";
import { Spinner } from "@/components/Spinner";

/** Rendered by loading.tsx: keeps the top progress bar on for as long as the skeleton is visible. */
export function LoadingMark() {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-loading", "");
    return () => root.removeAttribute("data-loading");
  }, []);
  return (
    <p className="flex items-center gap-2 text-sm text-muted" role="status">
      <Spinner size={16} /> กำลังโหลด…
    </p>
  );
}
