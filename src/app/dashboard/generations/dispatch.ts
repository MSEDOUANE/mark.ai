/**
 * Refine dispatch table — a PLAIN server module (deliberately NOT "use
 * server"). It exports a const map and a synchronous helper, neither of which
 * is allowed as an export of a "use server" file (every export there must be
 * an async Server Function). The async `refineGeneration` action lives in
 * ./actions.ts and imports DISPATCH from here.
 */
import { generateAdCopy } from "../generate/ad-copy/actions";
import {
  generateProductDescription,
  generateMarketingCopy,
} from "../generate/ad-copy/content-actions";
import { generateSocialCaptions } from "../generate/social-captions/actions";
import { generatePersonas } from "../generate/personas/actions";
import { generateAudienceInsights } from "../generate/audience-insights/actions";
import { generateMarketingCalendar } from "../generate/calendar/actions";
import { checkBrandSafety } from "../generate/brand-safety/actions";
import { generateFunnel } from "../generate/funnel/actions";
import { generateEmail } from "../generate/email/actions";
import { planContent } from "../generate/scheduler/actions";

/**
 * A tool's refine result, narrowed to only what the dispatcher needs: whether
 * it succeeded, the new generation id (success), and a message (error). Every
 * Generate-hub action's success variant carries `generationId`.
 */
export type RefineResult = {
  status: "idle" | "success" | "error";
  generationId?: string;
  message?: string;
};

/**
 * Maps a `generations.tool` string to a thin caller that runs that tool's own
 * server action with a refine-round FormData. This REUSES every tool's
 * existing refine logic (loadRefineParent pulls the parent's saved input,
 * refineDirective builds the prompt, brand voice is recovered, the new row is
 * saved with parentId) — the thread page adds no second copy of any of it.
 */
export const DISPATCH: Record<string, (fd: FormData) => Promise<RefineResult>> = {
  "ad-copy": (fd) => generateAdCopy({ status: "idle" }, fd),
  "product-description": (fd) => generateProductDescription({ status: "idle" }, fd),
  "marketing-copy": (fd) => generateMarketingCopy({ status: "idle" }, fd),
  "social-captions": (fd) => generateSocialCaptions({ status: "idle" }, fd),
  personas: (fd) => generatePersonas({ status: "idle" }, fd),
  "audience-insights": (fd) => generateAudienceInsights({ status: "idle" }, fd),
  "marketing-calendar": (fd) => generateMarketingCalendar({ status: "idle" }, fd),
  "brand-safety": (fd) => checkBrandSafety({ status: "idle" }, fd),
  "funnel-design": (fd) => generateFunnel({ status: "idle" }, fd),
  "email-marketing": (fd) => generateEmail({ status: "idle" }, fd),
  "content-planner": (fd) => planContent({ status: "idle" }, fd),
};

/** Tool strings the thread page can refine (used by the UI to show/hide the box). */
export function isRefinable(tool: string): boolean {
  return tool in DISPATCH;
}
