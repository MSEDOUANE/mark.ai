import { z } from "zod";

/** The AI's recommended action for an active campaign, based on its metrics. */
export const optimizationSchema = z.object({
  action: z.enum([
    "keep",
    "scale_up",
    "scale_down",
    "pause",
    "kill",
    "refresh_creatives",
    // Produced by the deterministic A/B winner check, not the AI optimizer:
    // pause losing variant ads, leaving the winner with the full ad-set budget.
    "declare_winner",
  ]),
  rationale: z
    .string()
    .describe("1-3 sentences explaining the recommendation from the metrics"),
  suggestedDailyBudgetMinor: z
    .number()
    .int()
    .optional()
    .describe(
      "New daily budget in minor currency units; required for scale_up/scale_down",
    ),
  /** declare_winner only: the winning ad id and the losing ad ids to pause. */
  winnerAdId: z.string().optional(),
  loserAdIds: z.array(z.string()).optional(),
  confidence: z.enum(["low", "medium", "high"]),
});

export type OptimizationProposal = z.infer<typeof optimizationSchema>;
