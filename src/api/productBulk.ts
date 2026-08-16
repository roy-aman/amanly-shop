import { TokenStore, apiUrl, buildQuery, request } from '@/lib/http';
import type { Page, ProductImportJobResponse, ProductStatus } from '@/lib/types';

const A = '/api/v1/admin/products';

/**
 * Bulk catalogue upload and download.
 *
 * Rows are keyed on `sku`: a SKU that already exists in this store is updated, a
 * new one is created as DRAFT. On an update a blank cell leaves that field
 * unchanged — there is no way to *clear* a field by importing, which is worth
 * saying on screen because merchants assume the opposite.
 *
 * Uploading is **ADMIN only** (one file can rewrite every price in the
 * catalogue); exporting is open to STAFF. The upload returns immediately and the
 * file is applied in the background, so the screen polls {@link status}.
 */
export const productBulk = {
  /**
   * 202 with a job id. Poll {@link status} until it is COMPLETED or FAILED.
   *
   * 409 IMPORT_ALREADY_RUNNING — only one import may run per store at a time, so
   * disable the control while a job is active rather than letting someone hit it.
   */
  import(file: File, dryRun: boolean): Promise<ProductImportJobResponse> {
    const form = new FormData();
    form.append('file', file);
    return request('POST', `${A}/import${buildQuery({ dryRun })}`, { body: form, auth: true });
  },

  status(jobId: string): Promise<ProductImportJobResponse> {
    return request('GET', `${A}/import/${jobId}`, { auth: true });
  },

  history(params: { page?: number; size?: number } = {}): Promise<Page<ProductImportJobResponse>> {
    return request('GET', `${A}/import${buildQuery(params)}`, { auth: true });
  },

  /**
   * Downloads the catalogue as CSV — the same columns the importer reads, so the
   * file can be edited in a spreadsheet and sent straight back.
   *
   * Hand-rolled rather than going through `request`, for two reasons: the
   * response is CSV rather than JSON, and a plain `<a href>` cannot carry the
   * bearer token, so the bytes have to be fetched and handed to the browser as an
   * object URL. Exporting an empty catalogue yields the header row alone, which
   * doubles as the blank template.
   */
  async exportCsv(filters: { status?: ProductStatus; categoryId?: string; brandId?: string; search?: string } = {}) {
    const token = TokenStore.getAccessToken();
    const res = await fetch(apiUrl(`${A}/export.csv${buildQuery(filters)}`), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('The export could not be produced.');

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'products.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Released on the next tick: revoking synchronously can cancel the download
    // in some browsers before it has read the blob.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  },
};
