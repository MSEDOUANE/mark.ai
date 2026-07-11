import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * AI provider configuration — Claude direct by default, switchable to OpenRouter.
 *
 * Controlled entirely by env (no code change to switch):
 *   AI_PROVIDER=anthropic   (default) → Claude via the official Anthropic provider
 *   AI_PROVIDER=openrouter            → any model via OpenRouter (OpenAI-compatible)
 *   AI_MODEL=<id>           optional override of the model id for the active provider
 *
 * Model ids differ per provider: Anthropic uses bare ids (`claude-opus-4-8`),
 * OpenRouter uses `vendor/model` slugs (`anthropic/claude-opus-4-8`).
 *
 * Note: on Opus 4.8 the request surface is adaptive-thinking-only — we never pass
 * temperature/top_p (generateObject doesn't), so this works on either provider.
 */
export type AiProvider = "anthropic" | "openrouter";

const DEFAULT_MODEL: Record<AiProvider, string> = {
  anthropic: "claude-haiku-4-5-20251001",
  openrouter: "anthropic/claude-haiku-4-5",
};

function activeProvider(): AiProvider {
  return (process.env.AI_PROVIDER ?? "anthropic") as AiProvider;
}

/** Build the active language model from env. Kept lazy so a key/provider change
 *  only needs an env update. */
export function buildModel() {
  const provider = activeProvider();
  const modelId = process.env.AI_MODEL ?? DEFAULT_MODEL[provider];

  if (provider === "openrouter") {
    const openrouter = createOpenAICompatible({
      name: "openrouter",
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
    });
    return openrouter(modelId);
  }

  // Pin the official Anthropic endpoint — don't inherit ANTHROPIC_BASE_URL, which
  // tools like Claude Code set without the `/v1` suffix. Reads ANTHROPIC_API_KEY.
  const anthropic = createAnthropic({ baseURL: "https://api.anthropic.com/v1" });
  return anthropic(modelId);
}

/** Active language model used by the strategist + optimizer. */
export const strategistModel = buildModel();

/** Higher-quality model for copywriting tasks where output quality directly
 *  drives the result (e.g. the "Apply recommendations" refine loop). Uses Opus
 *  4.8 — already proven against this project's key in the prompt-gen route. */
export function buildCopywriterModel() {
  const provider = activeProvider();
  if (provider === "openrouter") {
    const openrouter = createOpenAICompatible({
      name: "openrouter",
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
    });
    return openrouter(process.env.AI_COPYWRITER_MODEL ?? "anthropic/claude-opus-4-8");
  }
  const anthropic = createAnthropic({ baseURL: "https://api.anthropic.com/v1" });
  return anthropic(process.env.AI_COPYWRITER_MODEL ?? "claude-opus-4-8");
}

export const copywriterModel = buildCopywriterModel();
