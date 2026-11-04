"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Navigates by URL inside a transition, so the caller knows it is waiting for the server.
 * While pending, <html data-busy> is set: globals.css shows a top progress bar and dims <main>.
 */
export function useUrlNav() {
  const router = useRouter();
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!pending) return;
    const root = document.documentElement;
    root.setAttribute("data-busy", "");
    return () => root.removeAttribute("data-busy");
  }, [pending]);

  function replace(url: string) {
    start(() => router.replace(url, { scroll: false }));
  }
  function push(url: string) {
    start(() => router.push(url));
  }
  return { pending, replace, push };
}
