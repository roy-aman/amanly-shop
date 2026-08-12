import { request } from '@/lib/http';
import type {
  AiQuotaResponse,
  GenerateImageRequest,
  GeneratePromptsRequest,
  GeneratedImageResponse,
  ImageView,
  PromptSuggestion,
} from '@/lib/types';

const A = '/api/v1/admin/media/ai';

/**
 * AI image generation (ADMIN, STAFF).
 *
 * Two steps on purpose. `draftPrompts` is free, instant and ungated — it just
 * turns what the catalogue knows into words. `generateImage` is the slow,
 * metered one, and it runs on whatever the merchant edited those words into, so
 * the expensive call never happens on text nobody read.
 */
export const aiImages = {
  /** Whether this store may generate, and how much is left. */
  quota(): Promise<AiQuotaResponse> {
    return request('GET', `${A}/quota`, { auth: true });
  },

  /** The sides the backend supports. Served rather than hard-coded so the two cannot drift. */
  views(): Promise<ImageView[]> {
    return request('GET', `${A}/views`, { auth: true });
  },

  /** Editable first drafts — one per requested view. Costs nothing. */
  draftPrompts(body: GeneratePromptsRequest): Promise<PromptSuggestion[]> {
    return request('POST', `${A}/prompts`, { body, auth: true });
  },

  /**
   * Generates ONE image. Takes roughly ten seconds.
   *
   * One per call because six views in a single request would run for a minute
   * and be cut off by the first proxy in the way. Call it once per view — each
   * settles independently, so a failed side does not lose the others.
   *
   * 403 AI_IMAGE_GENERATION_NOT_ALLOWED when the store lacks the entitlement;
   * 409 AI_IMAGE_LIMIT_REACHED when the quota is spent.
   */
  generateImage(body: GenerateImageRequest): Promise<GeneratedImageResponse> {
    return request('POST', `${A}/images`, { body, auth: true });
  },
};
