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

function getAdminAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' 
    ? (localStorage.getItem('smart_journey_admin_token') || localStorage.getItem('smartjourney_admin_token') || '')
    : '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-secret-key': 'sawahjaya_secret_2026'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
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
  if (typeof window === 'undefined') return null;
  const key = generateDraftKey(type, targetId, subType);
  try {
    const res = await fetch(`/api/admin/drafts?key=${encodeURIComponent(key)}`, {
      headers: getAdminAuthHeaders()
    });
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
    console.debug('[AutoSave] Could not fetch server draft:', err);
  }
  return null;
}

/**
 * Sync draft directly to backend database endpoint
 */
export async function syncDraftToServer(draft: AdminDraft): Promise<boolean> {
  if (typeof window === 'undefined' || !getIsOnline()) return false;
  try {
    const res = await fetch('/api/admin/drafts', {
      method: 'POST',
      headers: getAdminAuthHeaders(),
      body: JSON.stringify(draft)
    });
    return res.ok;
  } catch (err) {
    console.debug('[AutoSave] Backend sync skipped or offline:', err);
    return false;
  }
}

/**
 * Delete draft directly from backend database endpoint
 */
export async function deleteDraftFromServer(key: string): Promise<boolean> {
  if (typeof window === 'undefined' || !getIsOnline()) return false;
  try {
    const res = await fetch(`/api/admin/drafts/${encodeURIComponent(key)}`, {
      method: 'DELETE',
      headers: getAdminAuthHeaders()
    });
    return res.ok;
  } catch (err) {
    console.debug('[AutoSave] Backend draft deletion skipped:', err);
    return false;
  }
}

/**
 * Sync all local drafts to backend when connection is restored
 */
export async function syncAllLocalDraftsToServer(): Promise<void> {
  if (typeof window === 'undefined' || !getIsOnline()) return;
  const drafts = listAllDrafts();
  for (const draft of drafts) {
    try {
      await syncDraftToServer(draft);
    } catch {
      // Continue with others
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
  if (isOnline) {
    serverConfirmed = await syncDraftToServer(draft);
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
