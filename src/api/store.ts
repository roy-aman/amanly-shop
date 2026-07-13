import { request } from '@/lib/http';
import type { PublicStoreResponse } from '@/lib/types';

export function getPublicStore(): Promise<PublicStoreResponse> {
  return request('GET', '/api/v1/store');
}
