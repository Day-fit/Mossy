import { apiFetch } from './client';
import { API_BASE } from '../utils/constants';
import type { UserDetailsResponse } from '../types';

export function executeLoginRequest(data: { identifier: string; password: string }) {
  return apiFetch(`${API_BASE.auth}/api/v1/auth/login`, {
    includeAuth: false,
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function executeCheckAuthState(data: { token: string }) {
  return apiFetch(`${API_BASE.auth}/api/v1/auth/status`, {
    method: 'GET',
    authToken: data.token,
  });
}

export function executeRefreshRequest() {
  return apiFetch(`${API_BASE.auth}/api/v1/auth/refresh`, {
    includeAuth: false,
    includeCredentials: true,
    method: 'POST',
  });
}

export async function executeUserDetailsRequest() {
  return (await apiFetch(`${API_BASE.auth}/api/v1/auth/user/details`, {
    method: 'GET',
  }).then((res) => res.json())) as UserDetailsResponse;
}
