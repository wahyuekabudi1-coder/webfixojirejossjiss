/**
 * SMART JOURNEY — AUTHORITATIVE ADMIN AUTHENTICATION & ERROR HANDLER
 * 
 * Provides consistent admin session management, request headers,
 * automatic 401/403 session expiration detection, and safe server error reporting.
 */

export const ADMIN_AUTH_EXPIRED_EVENT = 'sj:admin-auth-expired';

export function getAdminToken(): string {
  if (typeof window === 'undefined') return '';
  return (
    localStorage.getItem('smart_journey_admin_token') ||
    localStorage.getItem('smartjourney_admin_token') ||
    ''
  );
}

export function clearAdminSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('smartjourney_admin_unlocked');
  localStorage.removeItem('smart_journey_admin_token');
  localStorage.removeItem('smartjourney_admin_token');
  window.dispatchEvent(new CustomEvent(ADMIN_AUTH_EXPIRED_EVENT));
}

export function saveAdminSessionToken(token: string): void {
  if (typeof window === 'undefined' || !token) return;
  localStorage.setItem('smartjourney_admin_unlocked', 'true');
  localStorage.setItem('smart_journey_admin_token', token);
  localStorage.setItem('smartjourney_admin_token', token);
}

export function getAdminHeaders(): Record<string, string> {
  const token = getAdminToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Validates the admin session against the authoritative server endpoint.
 * Returns true if valid, false if expired or invalid (and automatically clears client tokens).
 */
export async function verifyAdminSession(): Promise<boolean> {
  const token = getAdminToken();
  if (!token) {
    clearAdminSession();
    return false;
  }

  try {
    const res = await fetch('/api/auth/verify', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && (data.valid || data.authenticated)) {
        return true;
      }
    }

    clearAdminSession();
    return false;
  } catch (err) {
    console.error('[AdminAuth] Session verification error:', err);
    clearAdminSession();
    return false;
  }
}

/**
 * Consistent response handler for all Admin CRUD operations.
 * - On 401 / 403: clears stale session and throws 'Session admin telah berakhir. Silakan login kembali.'
 * - On 400: throws specific server validation error message.
 * - On 500: throws safe server error message.
 * - On 2xx: returns parsed JSON response.
 */
export async function handleAdminResponse<T = any>(
  res: Response,
  defaultErrorMsg = 'Gagal memproses data pada database server.'
): Promise<T> {
  if (res.ok) {
    return (await res.json()) as T;
  }

  // Handle Authentication / Authorization Failures (401 / 403)
  if (res.status === 401 || res.status === 403) {
    clearAdminSession();
    throw new Error('Session admin telah berakhir. Silakan login kembali.');
  }

  // Extract server error details safely
  let serverMessage = '';
  try {
    const errorJson = await res.json();
    serverMessage = errorJson?.error || errorJson?.message || '';
  } catch {
    try {
      serverMessage = await res.text();
    } catch {
      serverMessage = '';
    }
  }

  if (res.status === 400) {
    throw new Error(serverMessage || 'Permintaan data tidak valid (HTTP 400).');
  }

  if (res.status === 413) {
    throw new Error(serverMessage || 'Data paket tour terlalu besar untuk dikirim ke server (maksimal 20MB). Kurangi ukuran atau jumlah foto galeri.');
  }

  if (res.status >= 500) {
    throw new Error(serverMessage || 'Terjadi kesalahan pada database server (HTTP 500).');
  }

  throw new Error(serverMessage || defaultErrorMsg);
}
