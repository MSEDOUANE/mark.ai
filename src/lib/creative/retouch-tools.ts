/**
 * Retouch suite — the six one-click photo tools shown in /dashboard/retouch.
 *
 * Three fal models back all six tools; the difference between the three
 * upscaler-based tools is preset params (upscaleFactor / creativity /
 * resemblance). `needsMask` tools require a brushed mask from the client.
 */

import type { RetouchParams } from "./image-models/types";
import {
  BG_REMOVE_MODEL,
  UPSCALE_MODEL,
  ERASER_MODEL,
} from "./image-models/registry";

export interface RetouchTool {
  id: string;
  label: string;
  icon: string;
  description: string;
  /** When true, the client must supply a brushed mask before running. */
  needsMask: boolean;
  run: (params: RetouchParams) => Promise<string>;
}

export const RETOUCH_TOOLS: RetouchTool[] = [
  {
    id: "remove-bg",
    label: "Remove Background",
    icon: "✂️",
    description: "Cut out a clean, transparent background.",
    needsMask: false,
    run: BG_REMOVE_MODEL,
  },
  {
    id: "upscale",
    label: "Upscale",
    icon: "🔍",
    description: "Double the resolution with crisp, faithful detail.",
    needsMask: false,
    run: (p) => UPSCALE_MODEL({ ...p, upscaleFactor: 2, creativity: 0.2, resemblance: 0.85 }),
  },
  {
    id: "enhance",
    label: "Enhance",
    icon: "✨",
    description: "Sharpen and boost clarity without resizing.",
    needsMask: false,
    run: (p) => UPSCALE_MODEL({ ...p, upscaleFactor: 1, creativity: 0.35, resemblance: 0.7 }),
  },
  {
    id: "restore",
    label: "Restore",
    icon: "🩹",
    description: "Repair old, blurry or low-quality photos.",
    needsMask: false,
    run: (p) => UPSCALE_MODEL({ ...p, upscaleFactor: 2, creativity: 0.5, resemblance: 0.45 }),
  },
  {
    id: "remove-object",
    label: "Remove Object",
    icon: "🧽",
    description: "Brush over anything you want gone from the photo.",
    needsMask: true,
    run: ERASER_MODEL,
  },
  {
    id: "cleanup",
    label: "AI Cleanup",
    icon: "🪄",
    description: "Erase blemishes, logos or clutter you brush over.",
    needsMask: true,
    run: ERASER_MODEL,
  },
];

export function findRetouchTool(id: string): RetouchTool | undefined {
  return RETOUCH_TOOLS.find((t) => t.id === id);
}
