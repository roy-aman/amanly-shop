import { request } from '@/lib/http';
import type { AddressRequest, AddressResponse } from '@/lib/types';

const P = '/api/v1/users/me/addresses';

export function listAddresses(): Promise<AddressResponse[]> {
  return request('GET', P, { auth: true });
}
export function addAddress(body: AddressRequest): Promise<AddressResponse> {
  return request('POST', P, { body, auth: true });
}
export function updateAddress(id: string, body: AddressRequest): Promise<AddressResponse> {
  return request('PUT', `${P}/${id}`, { body, auth: true });
}
export function setDefaultAddress(id: string): Promise<AddressResponse> {
  return request('PATCH', `${P}/${id}/default`, { auth: true });
}
export function deleteAddress(id: string): Promise<void> {
  return request('DELETE', `${P}/${id}`, { auth: true });
}
