import type { OptimizationProposal } from "@/lib/ai/optimization-schema";
import type { CampaignSpec } from "@/lib/ads";

export type Autonomy = "approve_all" | "approve_spend" | "full_auto";

export const AUTONOMY_LABELS: Record<Autonomy, string> = {
  approve_all: "Approve every action",
  approve_spend: "Approve spend only",
  full_auto: "Full autopilot",
};

/** Launching starts ad spend — gated unless full autopilot. */
export function launchRequiresApproval(level: Autonomy): boolean {
  return level !== "full_auto";
}

/**
 * In approve_spend mode, only spend-INCREASING actions need a human; the AI may
 * auto-apply pause / kill / scale_down (spend-neutral or reducing).
 */
export function optimizationRequiresApproval(
  action: OptimizationProposal["action"],
  level: Autonomy,
): boolean {
  if (level === "full_auto") return false;
  if (level === "approve_all") return true;
  return action === "scale_up";
}

// Currency mentions we can detect in free-text budgets ("300 MAD / week").
const CURRENCY_PATTERNS: [RegExp, string][] = [
  [/\bmad\b|dirham|\bdhs?\b/i, "MAD"],
  [/\beur\b|€|euro/i, "EUR"],
  [/\busd\b|\$|dollar/i, "USD"],
  [/\bgbp\b|£/i, "GBP"],
];

/**
 * Approximate USD value of 1 unit — static on purpose. The ad platform bills
 * in the AD ACCOUNT's currency regardless of what the user typed, so a stated
 * "300 MAD/week" on a USD account would silently become $42/day (~10×). This
 * conversion prevents that order-of-magnitude surprise; the human approval
 * gate still reviews the exact final figure before anything spends.
 */
const USD_PER_UNIT: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  MAD: 0.1,
};

function detectCurrency(text: string): string | null {
  for (const [re, code] of CURRENCY_PATTERNS) {
    if (re.test(text)) return code;
  }
  return null;
}

/**
 * Pull a daily-budget figure out of free text and return minor units in
 * `targetCurrency` (the ad account's billing currency), converting when the
 * text states a different currency.
 */
export function parseBudgetMinor(
  budget: string | null | undefined,
  targetCurrency = "USD",
): number {
  if (!budget) return 5000; // default 50.00 / day
  const raw = budget.match(/[\d,.]+/)?.[0] ?? "";
  const n = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return 5000;
  const lower = budget.toLowerCase();
  let daily = lower.includes("month") ? n / 30 : lower.includes("week") ? n / 7 : n;

  const stated = detectCurrency(budget);
  const target = targetCurrency.toUpperCase();
  if (stated && stated !== target && USD_PER_UNIT[stated] && USD_PER_UNIT[target]) {
    daily = (daily * USD_PER_UNIT[stated]) / USD_PER_UNIT[target];
  }
  return Math.round(daily * 100);
}

export function buildCampaignSpec(args: {
  name: string;
  objective: string | null;
  currency: string;
  budget: string | null | undefined;
}): CampaignSpec {
  return {
    name: args.name,
    objective: args.objective ?? "traffic",
    dailyBudgetMinor: parseBudgetMinor(args.budget, args.currency),
    currency: args.currency,
  };
}
