import { request, TokenStore } from '@/lib/http';
import type { UserResponse } from '@/lib/types';

const P = '/api/v1/users';

export async function getCurrentUser(): Promise<UserResponse> {
  const user = await request<UserResponse>('GET', `${P}/me`, { auth: true });
  TokenStore.setUser(user);
  return user;
}

export async function updateProfile(fullName: string): Promise<UserResponse> {
  const user = await request<UserResponse>('PATCH', `${P}/me/profile`, { body: { fullName }, auth: true });
  TokenStore.setUser(user);
  return user;
}

export function updatePassword(currentPassword: string, newPassword: string): Promise<void> {
  return request<void>('PATCH', `${P}/me/password`, { body: { currentPassword, newPassword }, auth: true });
}
