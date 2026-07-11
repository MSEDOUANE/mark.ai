import type {
  CreativeJob,
  CreativeProvider,
  GenerateCreativeInput,
} from "./provider";

/**
 * Mock creative provider for local development before a Higgsfield key is live.
 * Returns a placeholder asset so the full brief -> creative pipeline can be
 * built and tested end-to-end without spending generation credits.
 */
export class MockCreativeProvider implements CreativeProvider {
  readonly name = "mock";

  async submit(input: GenerateCreativeInput): Promise<CreativeJob> {
    return {
      providerJobId: globalThis.crypto.randomUUID(),
      status: "generating",
      ...(input.type ? {} : {}),
    };
  }

  async poll(providerJobId: string): Promise<CreativeJob> {
    return {
      providerJobId,
      status: "ready",
      assetUrl: "https://placehold.co/1080x1920/png?text=MarkAI+Creative",
    };
  }
}
