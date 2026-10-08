/** Fetch helpers — all requests use relative /api paths (proxied to the backend). */

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `طلب غير ناجح (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const details = Array.isArray(data.details)
      ? data.details.map((d: { message: string }) => d.message).join('، ')
      : '';
    throw new Error(details || data.error || `طلب غير ناجح (${res.status})`);
  }
  return data as T;
}
