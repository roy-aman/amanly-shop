import { request, TokenStore } from '@/lib/http';
import type { AuthResponse } from '@/lib/types';

const P = '/api/v1/auth';

export async function login(email: string, password: string): Promise<AuthResponse> {
  const data = await request<AuthResponse>('POST', `${P}/login`, { body: { email, password } });
  TokenStore.save(data);
  return data;
}

export async function register(email: string, fullName: string, password: string): Promise<AuthResponse> {
  const data = await request<AuthResponse>('POST', `${P}/register`, { body: { email, fullName, password } });
  TokenStore.save(data);
  return data;
}

export async function logout(): Promise<void> {
  const refreshToken = TokenStore.getRefreshToken();
  try {
    if (refreshToken) {
      await request<void>('POST', `${P}/logout`, { body: { refreshToken }, auth: true, retry: false });
    }
  } catch {
    // Ignore logout failures — always clear local state.
  } finally {
    TokenStore.clear();
  }
}

export function forgotPassword(email: string): Promise<void> {
  return request<void>('POST', `${P}/forgot-password`, { body: { email } });
}

export function resetPassword(token: string, newPassword: string): Promise<void> {
  return request<void>('POST', `${P}/reset-password`, { body: { token, newPassword } });
}

export function resendEmailVerification(email: string): Promise<void> {
  return request<void>('POST', `${P}/email-verification/resend`, { body: { email } });
}

export function verifyEmail(token: string): Promise<void> {
  return request<void>('POST', `${P}/email-verification/verify`, { body: { token } });
}
