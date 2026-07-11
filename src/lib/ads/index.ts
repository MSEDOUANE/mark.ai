import type { AdPlatform, CampaignProvider } from "./provider";
import { MetaCampaignProvider } from "./meta";

export * from "./provider";

/** Resolve the campaign provider for a platform. */
export function getCampaignProvider(platform: AdPlatform): CampaignProvider {
  switch (platform) {
    case "meta":
      return new MetaCampaignProvider();
    case "tiktok":
      throw new Error("TikTok provider not implemented yet (Phase 4)");
    default: {
      const _exhaustive: never = platform;
      throw new Error(`Unknown ad platform: ${String(_exhaustive)}`);
    }
  }
}
