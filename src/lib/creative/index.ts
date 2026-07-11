import type { CreativeProvider } from "./provider";
import { ImageProvider } from "./image-provider";
import { MockCreativeProvider } from "./mock";

export * from "./provider";

/**
 * Returns the active image-generation provider.
 *
 * Priority:
 *   1. ImageProvider (FAL_KEY set) — dispatches to the model registry.
 *      Models live in image-models/; swap or add providers there.
 *   2. Mock — returns a placeholder instantly; used in local dev / CI.
 */
export function getCreativeProvider(): CreativeProvider {
  if (process.env.FAL_KEY) return new ImageProvider();
  return new MockCreativeProvider();
}
