import { request } from '@/lib/http';
import type { UploadQuotaResponse, UploadedImageResponse } from '@/lib/types';

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
};
