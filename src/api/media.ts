import { request } from '@/lib/http';
import type {
  QrCodeParams,
  QrCodeResponse,
  UploadQuotaResponse,
  UploadedImageResponse,
} from '@/lib/types';

const A = '/api/v1/admin/media';

/**
 * Image upload (ADMIN, STAFF).
 *
 * Sends real files as multipart rather than base64 in JSON: the browser hands a
 * `File` straight to `FormData` with no encoding step, and base64 would inflate
 * every upload by a third over the merchant's own connection. The backend does
 * the base64 hop the upstream service requires.
 *
 * Uploading is a platform-granted entitlement with a per-store quota, so ask
 * {@link mediaApi.quota} before offering the control — a refusal after someone
 * has chosen eight photographs is a worse experience than a disabled button.
 */
export const mediaApi = {
  /** 403 IMAGE_UPLOAD_NOT_ALLOWED when the store lacks the entitlement;
   *  409 IMAGE_UPLOAD_LIMIT_REACHED when the batch would pass the quota. */
  uploadImages(files: File[]): Promise<UploadedImageResponse[]> {
    const form = new FormData();
    // Repeated `files` parts — the backend binds them to List<MultipartFile>.
    for (const file of files) form.append('files', file);
    return request('POST', `${A}/images`, { body: form, auth: true });
  },

  quota(): Promise<UploadQuotaResponse> {
    return request('GET', `${A}/quota`, { auth: true });
  },

  /**
   * A QR poster for a storefront link — window, counter card, flyer.
   *
   * Returns the PNG inline as a data URI rather than image bytes, because this
   * endpoint needs a Bearer token: a plain `<img src="/api/v1/admin/media/qr-code">`
   * sends no Authorization header and would 401. Inline, it drops straight into
   * an `<img>` and an `<a download>`.
   *
   * Every parameter is optional. Leaving `url` out asks the server for the
   * store's own home page, the same canonical address its emails link to, so the
   * console never has to construct it. For `title`/`subtitle`, **omitted and
   * empty differ**: omitted takes the default caption, empty removes that line —
   * which is the only way to ask for a bare code. Hence the explicit
   * `!== undefined` checks rather than a truthiness test, which would silently
   * turn "no heading" back into the default.
   *
   * Nothing is cached server-side; a new custom domain changes the answer.
   */
  qrCode({ url, size, title, subtitle }: QrCodeParams = {}): Promise<QrCodeResponse> {
    const query = new URLSearchParams();
    if (url) query.set('url', url);
    if (size !== undefined) query.set('size', String(size));
    if (title !== undefined) query.set('title', title);
    if (subtitle !== undefined) query.set('subtitle', subtitle);

    const qs = query.toString();
    return request('GET', `${A}/qr-code${qs ? `?${qs}` : ''}`, { auth: true });
  },
};
