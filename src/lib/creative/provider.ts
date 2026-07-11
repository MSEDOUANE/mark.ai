/**
 * Creative generation provider interface.
 *
 * Callers depend on this interface, never on a concrete vendor, so Higgsfield
 * can be swapped for Veo / Kling / Runway without touching call sites.
 * Generation is async (slow), so the contract is submit -> poll.
 */

export type CreativeType = "image" | "video";

export type CreativeJobStatus = "pending" | "generating" | "ready" | "failed";

export interface GenerateCreativeInput {
  type: CreativeType;
  prompt: string;
  /** Optional source image (e.g. product photo) for image-to-image. */
  imageUrl?: string;
  /**
   * Multiple reference images (e.g. product + model) for AI compose mode.
   * When set and non-empty, takes precedence over imageUrl/text-to-image.
   */
  imageUrls?: string[];
  /** Output aspect ratio hint for compose mode (e.g. "4:5"). */
  aspectRatio?: string;
  /** Target duration in seconds for video creatives. */
  durationSeconds?: number;
  /** Text-to-image model to use when imageUrl is not set. */
  imageModel?: string;
  /** Provider-specific options passed through untouched. */
  options?: Record<string, unknown>;
}

export interface CreativeJob {
  /** Provider's job/generation id, used for polling. */
  providerJobId: string;
  status: CreativeJobStatus;
  /** Set once status is "ready". */
  assetUrl?: string;
  /** Set once status is "failed". */
  error?: string;
}

export interface CreativeProvider {
  readonly name: string;
  /** Kick off an async generation; returns a job to poll. */
  submit(input: GenerateCreativeInput): Promise<CreativeJob>;
  /** Poll a previously submitted job for status / result. */
  poll(providerJobId: string): Promise<CreativeJob>;
}
