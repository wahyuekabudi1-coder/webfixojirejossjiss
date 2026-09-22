/**
 * System Auto-Save Draft Storage for Smart Journey Admin Dashboard
 * 
 * Provides robust client-side persistent storage for Tour and Service forms.
 * Resilient against:
 * - Sudden power loss / battery drain
 * - Laptop/computer crash
 * - Accidental page refresh or tab close
 * - Network/internet disconnection
 * - Browser crash
 */

export type DraftType = 'tour' | 'service';

export interface AdminDraft<T = any> {
  key: string;
  type: DraftType;
  subType: string; // e.g. 'private_tour', 'sharetour', 'airport_transfer', 'airport_config', 'taxi_route', 'rental_service'
  targetId: string; // 'new' or specific package/service ID
  isEditing: boolean;
  title: string;
  data: T;
  meta?: Record<string, any>;
  savedAt: string; // ISO string
  savedAtTimestamp: number; // Date.now()
  isOnline: boolean;
}

const STORAGE_PREFIX = 'admin_draft_';

/**
 * Generate standardized namespaced key:
 * Tour: admin_draft_tour_[packageId] or admin_draft_tour_[subType]_[packageId]
 * Service: admin_draft_service_[packageId] or admin_draft_service_[subType]_[packageId]
 */
export function generateDraftKey(type: DraftType, targetId: string = 'new', subType: string = 'default'): string {
  const cleanId = (targetId || 'new').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanSubType = subType.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  
  if (type === 'tour') {
    if (!subType || subType === 'default' || subType === 'main' || subType === 'private_tour') {
      return `${STORAGE_PREFIX}tour_${cleanId}`;
    }
    return `${STORAGE_PREFIX}tour_${cleanSubType}_${cleanId}`;
  } else {
    if (!subType || subType === 'default' || subType === 'main') {
      return `${STORAGE_PREFIX}service_${cleanId}`;
    }
    return `${STORAGE_PREFIX}service_${cleanSubType}_${cleanId}`;
  }
}

/**
 * Check if the browser currently has internet connectivity
 */
export function getIsOnline(): boolean {
  if (typeof window === 'undefined' || typeof window.navigator === 'undefined') {
    return true;
  }
  return window.navigator.onLine !== false;
}

// Circuit breaker state for 401/403 / server unavailable to prevent infinite failing request loops
let serverAuthRejected = false;
let lastAuthRejectTime = 0;
const AUTH_REJECT_COOLDOWN_MS = 60000; // 60 seconds cooldown on auth failure

// Draft key versioning to prevent race conditions when a draft is cleared while a network request is in-flight
const draftVersions = new Map<string, number>();

export function getDraftVersion(key: string): number {
  return draftVersions.get(key) || 0;
}

export function bumpDraftVersion(key: string): number {
  const next = (draftVersions.get(key) || 0) + 1;
  draftVersions.set(key, next);
  return next;
}

/**
 * Fetch with strict timeout using AbortController
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 5000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

function shouldSkipServerSync(): boolean {
  if (typeof window === 'undefined' || !getIsOnline()) return true;
  if (serverAuthRejected) {
    if (Date.now() - lastAuthRejectTime < AUTH_REJECT_COOLDOWN_MS) {
      return true;
    }
    // Cooldown expired, allow retry
    serverAuthRejected = false;
  }
  return false;
}

function getAdminAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' 
    ? (localStorage.getItem('smart_journey_admin_token') || localStorage.getItem('smartjourney_admin_token') || '')
    : '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['x-secret-key'] = token;
  }
  return headers;
}

/**
 * Fetch draft directly from authoritative backend database
 * Essential for sudden laptop reboot, battery loss, or cross-browser recovery
 */
export async function fetchDraftFromServer<T = any>(
  type: DraftType,
  targetId: string = 'new',
  subType: string = 'default'
): Promise<AdminDraft<T> | null> {
  if (shouldSkipServerSync()) return null;
  const key = generateDraftKey(type, targetId, subType);
  try {
    const res = await fetchWithTimeout(`/api/admin/drafts?key=${encodeURIComponent(key)}`, {
      headers: getAdminAuthHeaders()
    }, 5000);

    if (res.status === 401 || res.status === 403) {
      serverAuthRejected = true;
      lastAuthRejectTime = Date.now();
      return null;
    }

    if (res.ok) {
      const result = await res.json();
      if (result && result.draft && result.draft.data) {
        // Cache to local storage as emergency fallback
        try {
          localStorage.setItem(key, JSON.stringify(result.draft));
        } catch (e) {}
        return result.draft as AdminDraft<T>;
      }
    }
  } catch (err) {
    console.debug('[AutoSave] Could not fetch server draft (timeout or network):', err);
  }
  return null;
}

/**
 * Sync draft directly to backend database endpoint
 */
export async function syncDraftToServer(draft: AdminDraft): Promise<boolean> {
  if (shouldSkipServerSync()) return false;
  const key = draft.key;
  const versionBefore = getDraftVersion(key);

  try {
    const res = await fetchWithTimeout('/api/admin/drafts', {
      method: 'POST',
      headers: getAdminAuthHeaders(),
      body: JSON.stringify(draft)
    }, 5000);

    if (res.status === 401 || res.status === 403) {
      serverAuthRejected = true;
      lastAuthRejectTime = Date.now();
      return false;
    }

    // If draft was cleared while request was in-flight, discard
    if (getDraftVersion(key) !== versionBefore) {
      return false;
    }

    return res.ok;
  } catch (err) {
    console.debug('[AutoSave] Backend sync skipped or timed out:', err);
    return false;
  }
}

/**
 * Delete draft directly from backend database endpoint
 */
export async function deleteDraftFromServer(key: string): Promise<boolean> {
  bumpDraftVersion(key);
  if (shouldSkipServerSync()) return false;

  try {
    const res = await fetchWithTimeout(`/api/admin/drafts/${encodeURIComponent(key)}`, {
      method: 'DELETE',
      headers: getAdminAuthHeaders()
    }, 5000);

    if (res.status === 401 || res.status === 403) {
      serverAuthRejected = true;
      lastAuthRejectTime = Date.now();
      return false;
    }

    return res.ok;
  } catch (err) {
    console.debug('[AutoSave] Backend draft deletion skipped or timed out:', err);
    return false;
  }
}

/**
 * Sync all local drafts to backend when connection is restored
 * Throttled to prevent mass sync spam
 */
let lastBulkSyncTimestamp = 0;
export async function syncAllLocalDraftsToServer(): Promise<void> {
  if (shouldSkipServerSync()) return;
  const now = Date.now();
  if (now - lastBulkSyncTimestamp < 30000) return; // at most once every 30 seconds
  lastBulkSyncTimestamp = now;

  const drafts = listAllDrafts();
  for (const draft of drafts) {
    if (serverAuthRejected) break; // Stop immediately if server rejected auth
    try {
      await syncDraftToServer(draft);
    } catch {
      // Continue safely with others
    }
  }
}

/**
 * Async save draft into both persistent localStorage and authoritative backend database
 */
export async function saveDraftAsync<T = any>(
  type: DraftType,
  targetId: string = 'new',
  subType: string = 'default',
  title: string = '',
  data: T,
  meta?: Record<string, any>,
  isEditing: boolean = false
): Promise<{ success: boolean; key: string; isOnline: boolean; serverConfirmed: boolean; error?: string }> {
  if (typeof window === 'undefined') return { success: false, key: '', isOnline: true, serverConfirmed: false };

  const key = generateDraftKey(type, targetId, subType);
  const versionBefore = getDraftVersion(key);
  const isOnline = getIsOnline();

  const draft: AdminDraft<T> = {
    key,
    type,
    subType,
    targetId: targetId || 'new',
    isEditing,
    title: title || (type === 'tour' ? 'Draft Paket Tour' : 'Draft Layanan Service'),
    data,
    meta,
    savedAt: new Date().toISOString(),
    savedAtTimestamp: Date.now(),
    isOnline
  };

  try {
    localStorage.setItem(key, JSON.stringify(draft));
  } catch (err: any) {
    try {
      cleanupOldDrafts(30);
      localStorage.setItem(key, JSON.stringify(draft));
    } catch (e) {}
  }

  let serverConfirmed = false;
  if (isOnline && !shouldSkipServerSync()) {
    serverConfirmed = await syncDraftToServer(draft);
  }

  // If draft was cleared while awaiting server sync, ensure it's not resurrected
  if (getDraftVersion(key) !== versionBefore) {
    try {
      localStorage.removeItem(key);
    } catch {}
    return { success: false, key, isOnline, serverConfirmed: false };
  }

  return { success: true, key, isOnline, serverConfirmed };
}

/**
 * Synchronous local save draft (with background server sync)
 */
export function saveDraft<T = any>(
  type: DraftType,
  targetId: string = 'new',
  subType: string = 'default',
  title: string = '',
  data: T,
  meta?: Record<string, any>,
  isEditing: boolean = false
): { success: boolean; key: string; isOnline: boolean; error?: string } {
  if (typeof window === 'undefined') return { success: false, key: '', isOnline: true };

  const key = generateDraftKey(type, targetId, subType);
  const isOnline = getIsOnline();

  const draft: AdminDraft<T> = {
    key,
    type,
    subType,
    targetId: targetId || 'new',
    isEditing,
    title: title || (type === 'tour' ? 'Draft Paket Tour' : 'Draft Layanan Service'),
    data,
    meta,
    savedAt: new Date().toISOString(),
    savedAtTimestamp: Date.now(),
    isOnline
  };

  try {
    localStorage.setItem(key, JSON.stringify(draft));
    // Asynchronously sync to backend if online
    if (isOnline) {
      syncDraftToServer(draft).catch(() => {});
    }
    return { success: true, key, isOnline };
  } catch (err: any) {
    console.warn(`[AutoSave] Failed to save draft under ${key}:`, err);
    // If quota exceeded, try cleaning up very old drafts (> 30 days)
    try {
      cleanupOldDrafts(30);
      localStorage.setItem(key, JSON.stringify(draft));
      if (isOnline) {
        syncDraftToServer(draft).catch(() => {});
      }
      return { success: true, key, isOnline };
    } catch (retryErr: any) {
      return { success: false, key, isOnline, error: retryErr?.message || 'Storage full' };
    }
  }
}

/**
 * Retrieve a specific draft by type, targetId, and subType
 */
export function getDraft<T = any>(
  type: DraftType,
  targetId: string = 'new',
  subType: string = 'default'
): AdminDraft<T> | null {
  if (typeof window === 'undefined') return null;
  const key = generateDraftKey(type, targetId, subType);
  
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed as AdminDraft<T>;
  } catch (e) {
    console.error(`[AutoSave] Error reading draft ${key}:`, e);
    return null;
  }
}

/**
 * Check if a draft exists
 */
export function hasDraft(
  type: DraftType,
  targetId: string = 'new',
  subType: string = 'default'
): boolean {
  return getDraft(type, targetId, subType) !== null;
}

/**
 * Clear a specific draft once published or discarded
 */
export function clearDraft(
  type: DraftType,
  targetId: string = 'new',
  subType: string = 'default'
): void {
  if (typeof window === 'undefined') return;
  const key = generateDraftKey(type, targetId, subType);
  bumpDraftVersion(key);
  try {
    localStorage.removeItem(key);
    deleteDraftFromServer(key).catch(() => {});
  } catch (e) {
    console.error(`[AutoSave] Error removing draft ${key}:`, e);
  }
}

/**
 * List all active drafts in storage (optionally filtered by type)
 */
export function listAllDrafts(typeFilter?: DraftType): AdminDraft[] {
  if (typeof window === 'undefined') return [];
  const drafts: AdminDraft[] = [];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        if (typeFilter && !key.startsWith(`${STORAGE_PREFIX}${typeFilter}_`)) {
          continue;
        }
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.key && parsed.savedAt) {
              drafts.push(parsed);
            }
          }
        } catch (itemErr) {
          // ignore corrupted single key
        }
      }
    }
  } catch (e) {
    console.error('[AutoSave] Error listing drafts:', e);
  }

  // Sort newest first
  return drafts.sort((a, b) => b.savedAtTimestamp - a.savedAtTimestamp);
}

/**
 * Clean up drafts older than X days
 */
export function cleanupOldDrafts(maxDays: number = 30): void {
  if (typeof window === 'undefined') return;
  const cutoff = Date.now() - (maxDays * 24 * 60 * 60 * 1000);
  
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed.savedAtTimestamp && parsed.savedAtTimestamp < cutoff) {
              keysToRemove.push(key);
            }
          } catch {
            keysToRemove.push(key);
          }
        }
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (e) {
    console.error('[AutoSave] Error cleaning up old drafts:', e);
  }
}

/**
 * Format relative or human timestamp for the draft
 */
export function formatDraftTime(isoStringOrTimestamp: string | number): string {
  try {
    const d = new Date(isoStringOrTimestamp);
    if (isNaN(d.getTime())) return '-';
    
    // Format: 08 Sep 2026, 14:32:05 WIB
    const timeStr = d.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    const dateStr = d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    return `${dateStr} pukul ${timeStr}`;
  } catch {
    return String(isoStringOrTimestamp);
  }
}
