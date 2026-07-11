"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Silently refreshes the page every 4 s while any creatives are still generating.
 * Stops automatically once generatingCount reaches 0 (server component re-renders
 * with the final ready state).
 */
export function CreativesPoller({ generatingCount }: { generatingCount: number }) {
  const router = useRouter();

  useEffect(() => {
    if (generatingCount === 0) return;
    const id = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(id);
  }, [generatingCount, router]);

  return null;
}
