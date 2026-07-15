"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

const DEFAULT_ORDER = ["performance", "projects", "activity", "workflow"] as const;

type SectionId = (typeof DEFAULT_ORDER)[number];

type DashboardSectionOrdererProps = {
  initialOrder: SectionId[];
  projectStatus: string;
  assetKind: string;
  projectSort: string;
  assetSort: string;
  density: string;
  focus: string;
};

const SECTION_LABELS: Record<SectionId, string> = {
  performance: "Performance",
  projects: "Projects",
  activity: "Activity",
  workflow: "Workflow",
};

function reorder(items: SectionId[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function buildSaveHref({
  order,
  projectStatus,
  assetKind,
  projectSort,
  assetSort,
  density,
  focus,
  showSaved,
}: {
  order: SectionId[];
  projectStatus: string;
  assetKind: string;
  projectSort: string;
  assetSort: string;
  density: string;
  focus: string;
  showSaved?: boolean;
}) {
  const dashboardParams = new URLSearchParams();
  if (projectStatus !== "all") dashboardParams.set("projectStatus", projectStatus);
  if (assetKind !== "all") dashboardParams.set("assetKind", assetKind);
  if (projectSort !== "updated") dashboardParams.set("projectSort", projectSort);
  if (assetSort !== "updated") dashboardParams.set("assetSort", assetSort);
  if (density !== "comfortable") dashboardParams.set("density", density);
  if (focus !== "operations") dashboardParams.set("focus", focus);

  const orderCsv = order.join(",");
  const defaultCsv = DEFAULT_ORDER.join(",");
  if (orderCsv !== defaultCsv) dashboardParams.set("panelOrder", orderCsv);

  const target = dashboardParams.toString() ? `/dashboard?${dashboardParams.toString()}` : "/dashboard";

  const prefParams = new URLSearchParams();
  prefParams.set("to", target);
  prefParams.set("projectStatus", projectStatus);
  prefParams.set("assetKind", assetKind);
  prefParams.set("projectSort", projectSort);
  prefParams.set("assetSort", assetSort);
  prefParams.set("density", density);
  prefParams.set("focus", focus);
  prefParams.set("panelOrder", orderCsv);
  if (showSaved) prefParams.set("saved", "1");

  return `/dashboard/preferences?${prefParams.toString()}`;
}

export function DashboardSectionOrderer({
  initialOrder,
  projectStatus,
  assetKind,
  projectSort,
  assetSort,
  density,
  focus,
}: DashboardSectionOrdererProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);
  const wasOpenRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [order, setOrder] = useState<SectionId[]>(initialOrder);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [undoOrder, setUndoOrder] = useState<SectionId[] | null>(null);

  const saveHref = useMemo(
    () =>
      buildSaveHref({
        order,
        projectStatus,
        assetKind,
        projectSort,
        assetSort,
        density,
        focus,
        showSaved: true,
      }),
    [assetKind, assetSort, density, focus, order, projectSort, projectStatus],
  );

  useEffect(() => {
    if (!isAutoSaving) return;
    setOpen(false);
    const timeoutId = window.setTimeout(() => {
      window.location.assign(saveHref);
    }, 900);
    return () => window.clearTimeout(timeoutId);
  }, [isAutoSaving, saveHref]);

  useEffect(() => {
    if (!open) return;
    wasOpenRef.current = true;

    const focusId = window.setTimeout(() => {
      rowRefs.current[0]?.focus();
    }, 0);

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!rootRef.current.contains(target)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusId);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open || !wasOpenRef.current) return;
    triggerRef.current?.focus();
    wasOpenRef.current = false;
  }, [open]);

  function applyOrder(nextOrder: SectionId[]) {
    if (nextOrder.join(",") === order.join(",")) return;
    setUndoOrder(order);
    setOrder(nextOrder);
    setIsAutoSaving(true);
  }

  function handleItemKey(index: number, key: string) {
    if (key === "ArrowUp") {
      applyOrder(reorder(order, index, index - 1));
      return true;
    }
    if (key === "ArrowDown") {
      applyOrder(reorder(order, index, index + 1));
      return true;
    }
    if (key === "Home") {
      applyOrder(reorder(order, index, 0));
      return true;
    }
    if (key === "End") {
      applyOrder(reorder(order, index, order.length - 1));
      return true;
    }
    return false;
  }

  function handlePopoverKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    if (!popoverRef.current) return;

    const focusable = Array.from(
      popoverRef.current.querySelectorAll<HTMLElement>(
        'button, [href], [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true");

    if (focusable.length === 0) return;
    const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);

    if (event.shiftKey) {
      if (currentIndex <= 0) {
        event.preventDefault();
        focusable[focusable.length - 1]?.focus();
      }
      return;
    }

    if (currentIndex === -1 || currentIndex === focusable.length - 1) {
      event.preventDefault();
      focusable[0]?.focus();
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
      >
        Reorder panels
      </button>

      <div
        ref={popoverRef}
        aria-hidden={!open}
        onKeyDown={handlePopoverKeyDown}
        className={`absolute right-0 top-9 z-30 w-72 rounded-xl border border-zinc-800 bg-zinc-950/95 p-3 shadow-2xl transition duration-150 ease-out motion-reduce:transition-none ${
          open
            ? "translate-y-0 scale-100 opacity-100"
            : "pointer-events-none -translate-y-1 scale-[0.98] opacity-0"
        }`}
      >
          <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Drag or use keyboard to reorder</p>
          <p className="mt-1 text-[11px] text-zinc-600">Focused row: Arrow up/down, Home, End</p>
          <div className="mt-2 space-y-2">
            {order.map((id, index) => (
              <div
                key={id}
                ref={(node) => {
                  rowRefs.current[index] = node;
                }}
                tabIndex={0}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(event) => event.preventDefault()}
                onKeyDown={(event) => {
                  const handled = handleItemKey(index, event.key);
                  if (handled) event.preventDefault();
                }}
                onDrop={() => {
                  if (dragIndex == null) return;
                  applyOrder(reorder(order, dragIndex, index));
                  setDragIndex(null);
                }}
                className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
              >
                <span className="text-xs text-zinc-200">{index + 1}. {SECTION_LABELS[id]}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => applyOrder(reorder(order, index, index - 1))}
                    className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                    aria-label={`Move ${SECTION_LABELS[id]} up`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => applyOrder(reorder(order, index, index + 1))}
                    className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                    aria-label={`Move ${SECTION_LABELS[id]} down`}
                  >
                    ↓
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => applyOrder([...DEFAULT_ORDER])}
              className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
            >
              Default order
            </button>
            {isAutoSaving ? (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-500">Saving...</span>
                <button
                  type="button"
                  onClick={() => {
                    if (!undoOrder) return;
                    setOrder(undoOrder);
                    setUndoOrder(null);
                    setIsAutoSaving(false);
                  }}
                  className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
                >
                  Undo
                </button>
              </div>
            ) : (
              <span className="text-[11px] text-zinc-500">Auto-saves on reorder</span>
            )}
          </div>
        </div>
    </div>
  );
}
