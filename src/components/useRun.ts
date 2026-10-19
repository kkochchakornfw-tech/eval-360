"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import type { ActionResult } from "@/app/actions/evaluation";

/** Runs a server action, toasts the outcome and refreshes server data on success. */
export function useRun() {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();

  function run(fn: () => Promise<ActionResult>, successMessage?: string, onDone?: () => void) {
    start(async () => {
      const res = await fn();
      if (!res.ok) return toast.error(res.error);
      if (successMessage) toast.success(successMessage);
      onDone?.();
      router.refresh();
    });
  }

  return { run, pending };
}
