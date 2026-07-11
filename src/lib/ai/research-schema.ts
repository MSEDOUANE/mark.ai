import { z } from "zod";

/**
 * Structured market/competitor/audience research — the agent's "step 0" before
 * strategy. Produced by `researchMarket` (web-search-grounded when on Anthropic).
 */
export const researchSchema = z.object({
  marketOverview: z
    .string()
    .describe(
      "2-4 sentences: category, demand level, trend, seasonality, and any regional notes.",
    ),
  competitors: z
    .array(
      z.object({
        name: z.string().describe("Real competitor/brand name."),
        positioning: z
          .string()
          .describe("How they position themselves / their main angle."),
        strengths: z.string().describe("What they do well."),
        gaps: z
          .string()
          .describe("Weaknesses or gaps this product can exploit."),
      }),
    )
    .min(2)
    .max(7),
  audiencePersonas: z
    .array(
      z.object({
        name: z.string().describe("Short persona label, e.g. 'Budget-conscious new parent'."),
        description: z
          .string()
          .describe("Who they are: demographics + context."),
        painPoints: z.array(z.string()).min(1).max(4),
        motivations: z.array(z.string()).min(1).max(4),
        channels: z
          .array(z.string())
          .describe("Where to reach them (platforms/placements)."),
        messagingHooks: z
          .array(z.string())
          .min(1)
          .max(3)
          .describe("Angles/hooks that resonate with this persona."),
      }),
    )
    .min(1)
    .max(4),
  opportunities: z
    .array(z.string())
    .min(1)
    .max(5)
    .describe("Specific, concrete angles/opportunities to exploit."),
  recommendedChannels: z
    .array(z.string())
    .describe("Channels worth prioritising for this product/audience."),
  sources: z
    .array(z.string())
    .describe("URLs or sources the research drew on; empty array if none."),
});

export type MarketResearch = z.infer<typeof researchSchema>;
