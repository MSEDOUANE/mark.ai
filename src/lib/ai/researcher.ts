import { generateObject, generateText, stepCountIs } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { strategistModel } from "./models";
import { researchSchema, type MarketResearch } from "./research-schema";

export interface ResearchInput {
  productName: string;
  productDescription?: string | null;
  goal?: string | null;
  audienceHint?: string | null;
  /** Optional ISO country code (e.g. "MA") to bias web-search results. */
  country?: string | null;
}

const RESEARCH_SYSTEM =
  "You are a market research analyst for performance marketing. Research the product's market, " +
  "its real competitors, and its likely target audience. Prefer current, specific, real-world " +
  "facts — use web search to verify competitor names, positioning, pricing and audience context. " +
  "Cite the sources you use. If you cannot find specifics, say so rather than inventing them.";

const STRUCTURE_SYSTEM =
  "Convert the research notes into the required structured schema. Use only what the notes " +
  "support — do not invent competitors or numbers. Keep every entry concise and concrete. " +
  "Put any URLs from the notes into `sources`.";

function describe(input: ResearchInput): string {
  return [
    `Product: ${input.productName}`,
    input.productDescription ? `Description: ${input.productDescription}` : null,
    input.goal ? `Marketing goal: ${input.goal}` : null,
    input.audienceHint ? `Audience hint: ${input.audienceHint}` : null,
    input.country ? `Target country: ${input.country}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

const findingsPrompt = (input: ResearchInput): string =>
  "Research the market for this product and produce detailed notes covering:\n" +
  "1) Market overview — demand, trend, seasonality, regional notes.\n" +
  "2) 3-6 REAL competitors — name, positioning, strengths, exploitable gaps.\n" +
  "3) 2-4 audience personas — who they are, pains, motivations, where to reach them, messaging hooks.\n" +
  "4) Opportunities/angles and recommended channels.\n\n" +
  describe(input);

/** Gather grounded research notes — web-search-backed on Anthropic, else LLM-only. */
async function gatherFindings(input: ResearchInput): Promise<string> {
  const prompt = findingsPrompt(input);
  const provider = process.env.AI_PROVIDER ?? "anthropic";

  if (provider === "anthropic") {
    try {
      const anthropic = createAnthropic({
        baseURL: "https://api.anthropic.com/v1",
      });
      const model = anthropic(process.env.AI_MODEL ?? "claude-opus-4-8");
      const { text } = await generateText({
        model,
        system: RESEARCH_SYSTEM,
        prompt,
        tools: {
          web_search: anthropic.tools.webSearch_20250305({
            maxUses: 5,
            ...(input.country
              ? {
                  userLocation: {
                    type: "approximate" as const,
                    country: input.country,
                  },
                }
              : {}),
          }),
        },
        stopWhen: stepCountIs(8),
      });
      if (text && text.trim()) return text;
    } catch (e) {
      console.error(
        "[research] web search failed, falling back to LLM-only:",
        e instanceof Error ? e.message : e,
      );
    }
  }

  // Fallback: no web search (OpenRouter, or web search unavailable/failed).
  const { text } = await generateText({
    model: strategistModel,
    system: RESEARCH_SYSTEM,
    prompt,
  });
  return text;
}

/**
 * The agent's research capability: produce a structured market/competitor/
 * audience report for a product. Two-step — gather grounded notes (web search),
 * then structure them into the schema.
 */
export async function researchMarket(
  input: ResearchInput,
): Promise<MarketResearch> {
  const findings = await gatherFindings(input);
  const { object } = await generateObject({
    model: strategistModel,
    schema: researchSchema,
    system: STRUCTURE_SYSTEM,
    prompt: `${describe(input)}\n\nResearch notes:\n${findings}\n\nStructure these into the schema.`,
  });
  return object;
}
