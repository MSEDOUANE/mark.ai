import { HiggsfieldClient, type JobSet } from "@higgsfield/client";
import type {
  CreativeJob,
  CreativeProvider,
  GenerateCreativeInput,
} from "./provider";

const SOUL_ENDPOINT = "/v1/text2image/soul";
const DOP_ENDPOINT = "/v1/image2video/dop";
// 9:16 portrait — the standard format for Meta/TikTok story & reel ads.
const AD_SIZE = "1152x2048";

/**
 * Higgsfield Cloud API provider (official @higgsfield/client v1 SDK).
 *
 * The deployed API expects a `{ params }` request body and returns job-sets, so
 * we use the v1 `generate(endpoint, params)` method (not v2 `subscribe`, which
 * posts the input un-wrapped). `generate({ withPolling: true })` blocks until the
 * job-set reaches a terminal status, so poll() is effectively unused.
 *
 * - image creatives -> /v1/text2image/soul
 * - video creatives -> generate an image, then animate it via /v1/image2video/dop
 *
 * For long videos in production, switch to Higgsfield's webhook delivery to avoid
 * serverless request timeouts.
 */
export class HiggsfieldProvider implements CreativeProvider {
  readonly name = "higgsfield";
  private readonly client: HiggsfieldClient;

  constructor(
    apiKey = process.env.HIGGSFIELD_API_KEY,
    apiSecret = process.env.HIGGSFIELD_API_SECRET,
  ) {
    if (!apiKey || !apiSecret) {
      throw new Error(
        "HIGGSFIELD_API_KEY and HIGGSFIELD_API_SECRET are both required",
      );
    }
    this.client = new HiggsfieldClient({ apiKey, apiSecret });
  }

  async submit(input: GenerateCreativeInput): Promise<CreativeJob> {
    if (input.type === "image") {
      const jobSet = await this.client.generate(
        SOUL_ENDPOINT,
        this.soulParams(input.prompt),
        { withPolling: true },
      );
      return this.toJob(jobSet);
    }

    // Video: animate a provided image, or first generate one from the prompt.
    let sourceImageUrl = input.imageUrl;
    if (!sourceImageUrl) {
      const imgSet = await this.client.generate(
        SOUL_ENDPOINT,
        this.soulParams(input.prompt),
        { withPolling: true },
      );
      sourceImageUrl = this.firstUrl(imgSet);
      if (!sourceImageUrl) {
        return {
          providerJobId: imgSet.id,
          status: "failed",
          error: "image step produced no asset",
        };
      }
    }

    const jobSet = await this.client.generate(
      DOP_ENDPOINT,
      {
        model: "dop-turbo",
        prompt: input.prompt,
        input_images: [{ type: "image_url", image_url: sourceImageUrl }],
        enhance_prompt: true,
      },
      { withPolling: true },
    );
    return this.toJob(jobSet);
  }

  async poll(providerJobId: string): Promise<CreativeJob> {
    // generate({ withPolling: true }) blocks until terminal, so this is only hit
    // if the SDK's own poll timed out — report as still generating.
    return { providerJobId, status: "generating" };
  }

  private soulParams(prompt: string) {
    return {
      prompt,
      width_and_height: AD_SIZE,
      quality: "1080p",
      batch_size: 1,
      enhance_prompt: true,
    };
  }

  private firstUrl(jobSet: JobSet): string | undefined {
    const job = jobSet.jobs?.[0];
    return job?.results?.raw.url ?? job?.results?.min.url;
  }

  private toJob(jobSet: JobSet): CreativeJob {
    const assetUrl = this.firstUrl(jobSet);
    if (jobSet.isCompleted && assetUrl) {
      return { providerJobId: jobSet.id, status: "ready", assetUrl };
    }
    return {
      providerJobId: jobSet.id,
      status: "failed",
      assetUrl,
      error: jobSet.isNsfw ? "flagged as NSFW" : "generation did not complete",
    };
  }
}
