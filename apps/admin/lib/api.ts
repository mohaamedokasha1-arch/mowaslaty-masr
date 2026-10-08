'use client';

const TOKEN_KEY = 'mowaslaty_admin_token';
const USER_KEY = 'mowaslaty_admin_user';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getUser(): { id: string; email: string; name?: string; role: string } | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(USER_KEY);
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: unknown) {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401 || res.status === 403) {
    clearSession();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    throw new UnauthorizedError();
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const details = Array.isArray(data.details)
      ? data.details.map((d: { message: string }) => d.message).join('، ')
      : '';
    throw new Error(details || data.error || `طلب غير ناجح (${res.status})`);
  }
  return data as T;
}

export const apiGet = <T>(path: string) => request<T>(path);
export const apiPost = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) });
export const apiPatch = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
