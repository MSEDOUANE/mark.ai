"use client";

import { useEffect, useState } from "react";

type DashboardPrefsSavedChipProps = {
  initialVisible: boolean;
};

export function DashboardPrefsSavedChip({ initialVisible }: DashboardPrefsSavedChipProps) {
  const [visible, setVisible] = useState(initialVisible);
  const [mounted, setMounted] = useState(initialVisible);

  useEffect(() => {
    if (!initialVisible) return;

    setMounted(true);
    setVisible(true);

    const url = new URL(window.location.href);
    if (url.searchParams.has("prefsSaved")) {
      url.searchParams.delete("prefsSaved");
      window.history.replaceState(window.history.state, "", url.toString());
    }

    const timeoutId = window.setTimeout(() => {
      setVisible(false);
    }, 2200);

    const unmountId = window.setTimeout(() => {
      setMounted(false);
    }, 2420);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearTimeout(unmountId);
    };
  }, [initialVisible]);

  if (!mounted) return null;

  return (
    <span
      className={`rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300 transition duration-200 ease-out motion-reduce:transition-none ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-0.5 opacity-0"
      }`}
    >
      Saved
    </span>
  );
}
