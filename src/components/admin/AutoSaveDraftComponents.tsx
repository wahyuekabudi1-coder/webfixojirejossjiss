import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  CheckCircle2, 
  Save, 
  AlertCircle, 
  Wifi, 
  WifiOff, 
  History, 
  RotateCcw, 
  Trash2, 
  Sparkles,
  Info
} from 'lucide-react';
import { 
  DraftType, 
  AdminDraft, 
  generateDraftKey,
  saveDraft, 
  getDraft, 
  clearDraft, 
  formatDraftTime, 
  getIsOnline,
  syncDraftToServer,
  syncAllLocalDraftsToServer,
  saveDraftAsync,
  fetchDraftFromServer
} from '../../utils/adminDraftStorage';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'offline_saved' | 'error';

export interface UseAutoSaveDraftOptions<T> {
  type: DraftType;
  subType: string;
  targetId?: string; // 'new' or specific id
  title: string;
  data: T;
  meta?: Record<string, any>;
  isEditing?: boolean;
  enabled?: boolean;
  debounceMs?: number;
  onRecover?: (draft: AdminDraft<T>) => void;
  // Deep comparison or baseline data to avoid saving completely empty initial forms
  hasUnsavedContent?: boolean;
}

export function useAutoSaveDraft<T>({
  type,
  subType,
  targetId = 'new',
  title,
  data,
  meta,
  isEditing = false,
  enabled = true,
  debounceMs = 800,
  onRecover,
  hasUnsavedContent = true
}: UseAutoSaveDraftOptions<T>) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(getIsOnline());
  const [detectedDraft, setDetectedDraft] = useState<AdminDraft<T> | null>(null);
  const [showRecoveryBanner, setShowRecoveryBanner] = useState<boolean>(false);
  const [hasRestoredOrDismissed, setHasRestoredOrDismissed] = useState<boolean>(false);

  // References to prevent re-render storms and race conditions
  const isMountedRef = useRef<boolean>(true);
  const timerRef = useRef<any>(null);
  const isServerSavingRef = useRef<boolean>(false);
  const isRestoringRef = useRef<boolean>(false);
  const activeVersionRef = useRef<number>(0);
  const lastSavedSerializedRef = useRef<string>('');
  const savingSafetyTimerRef = useRef<any>(null);

  // Store latest props/state in ref to avoid recreating callbacks
  const latestRef = useRef<{
    data: T;
    meta?: Record<string, any>;
    title: string;
    enabled: boolean;
    hasUnsavedContent: boolean;
  }>({ data, meta, title, enabled, hasUnsavedContent });
  latestRef.current = { data, meta, title, enabled, hasUnsavedContent };

  // Track mounted state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (savingSafetyTimerRef.current) clearTimeout(savingSafetyTimerRef.current);
    };
  }, []);

  // 1. Initial check for existing draft upon mounting or targetId change (checks local first, then server non-blocking)
  useEffect(() => {
    if (!enabled) {
      setDetectedDraft(null);
      setShowRecoveryBanner(false);
      return;
    }

    const existingLocal = getDraft<T>(type, targetId, subType);
    if (existingLocal && existingLocal.data) {
      setDetectedDraft(existingLocal);
      setShowRecoveryBanner(true);
    } else {
      setDetectedDraft(null);
      setShowRecoveryBanner(false);
    }

    // Attempt non-blocking server check with 3500ms timeout
    fetchDraftFromServer<T>(type, targetId, subType).then((serverDraft) => {
      if (!isMountedRef.current) return;
      if (serverDraft && serverDraft.data) {
        if (!existingLocal || (serverDraft.savedAtTimestamp || 0) >= (existingLocal.savedAtTimestamp || 0)) {
          setDetectedDraft(serverDraft);
          setShowRecoveryBanner(true);
        }
      }
    }).catch(() => {});

    setHasRestoredOrDismissed(false);
  }, [type, subType, targetId, enabled]);

  // 2. Perform lightweight local save (NO network requests, NO main-thread freeze)
  const performLocalSave = useCallback(() => {
    const cur = latestRef.current;
    if (!cur.enabled || !cur.hasUnsavedContent || isRestoringRef.current) {
      return;
    }

    // Serialize ONLY once inside the debounced callback, NEVER on every keystroke or render
    let currentSerialized = '';
    try {
      currentSerialized = JSON.stringify({ data: cur.data, meta: cur.meta, title: cur.title });
    } catch {
      return;
    }

    // Skip if unchanged since last save
    if (currentSerialized === lastSavedSerializedRef.current) {
      return;
    }

    // Instant synchronous local storage save
    const res = saveDraft<T>(
      type,
      targetId,
      subType,
      cur.title,
      cur.data,
      cur.meta,
      isEditing
    );

    if (res.success) {
      lastSavedSerializedRef.current = currentSerialized;
      if (isMountedRef.current) {
        setLastSaved(new Date());
        setSaveStatus('saved');
      }
    }
  }, [type, targetId, subType, isEditing]);

  // 3. Perform manual save (Triggered when Admin explicitly clicks "Simpan Draft")
  const performSave = useCallback(async () => {
    const cur = latestRef.current;
    if (!cur.enabled || isRestoringRef.current) {
      return;
    }

    // Clear any pending debounce timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // 1. Instant local save first
    performLocalSave();

    // 2. Single-flight server sync (Only if online and not already syncing to server)
    if (isServerSavingRef.current || !getIsOnline()) {
      return;
    }

    isServerSavingRef.current = true;
    setSaveStatus('saving');

    // Safety timeout: status "saving" MUST NEVER be permanent (max 4.5s)
    if (savingSafetyTimerRef.current) clearTimeout(savingSafetyTimerRef.current);
    savingSafetyTimerRef.current = setTimeout(() => {
      if (isMountedRef.current && isServerSavingRef.current) {
        isServerSavingRef.current = false;
        setSaveStatus('saved');
      }
    }, 4500);

    const thisVersion = activeVersionRef.current;
    const draftObj: AdminDraft<T> = {
      key: generateDraftKey(type, targetId, subType),
      type,
      subType,
      targetId: targetId || 'new',
      isEditing,
      title: cur.title || (type === 'tour' ? 'Draft Paket Tour' : 'Draft Layanan Service'),
      data: cur.data,
      meta: cur.meta,
      savedAt: new Date().toISOString(),
      savedAtTimestamp: Date.now(),
      isOnline: true
    };

    try {
      const serverConfirmed = await syncDraftToServer(draftObj);
      if (!isMountedRef.current || activeVersionRef.current !== thisVersion) return;
      
      setLastSaved(new Date());
      setSaveStatus(serverConfirmed ? 'saved' : 'saved');
    } catch {
      if (isMountedRef.current && activeVersionRef.current === thisVersion) {
        setSaveStatus('saved');
      }
    } finally {
      if (savingSafetyTimerRef.current) clearTimeout(savingSafetyTimerRef.current);
      isServerSavingRef.current = false;
    }
  }, [performLocalSave, type, targetId, subType, isEditing]);

  // 4. Debounced local auto-save on content change
  // Note: NO JSON.stringify in render body or useMemo!
  useEffect(() => {
    if (!enabled || !hasUnsavedContent || isRestoringRef.current) {
      return;
    }

    // Clear previous pending debounce timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Debounce timer (750ms - 1000ms): serialization runs ONLY after user stops typing
    timerRef.current = setTimeout(() => {
      performLocalSave();
    }, debounceMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [data, meta, title, enabled, hasUnsavedContent, debounceMs, performLocalSave]);

  // 5. Listen to network connectivity - lightweight status update, NO mass sync storms
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 6. Save immediately before tab close (beforeunload) - purely synchronous, never async
  useEffect(() => {
    const handleBeforeUnload = () => {
      const cur = latestRef.current;
      if (cur.enabled && cur.hasUnsavedContent && !isRestoringRef.current) {
        try {
          saveDraft<T>(
            type,
            targetId,
            subType,
            cur.title,
            cur.data,
            cur.meta,
            isEditing
          );
        } catch {}
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [type, targetId, subType, isEditing]);

  // Actions
  const handleRecover = useCallback(() => {
    if (detectedDraft && onRecover) {
      isRestoringRef.current = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      // Pre-populate lastSavedSerializedRef so restore hydration doesn't trigger an autosave loop
      try {
        lastSavedSerializedRef.current = JSON.stringify({
          data: detectedDraft.data,
          meta: detectedDraft.meta,
          title: detectedDraft.title
        });
      } catch {}

      onRecover(detectedDraft);
      setSaveStatus('saved');
      setLastSaved(new Date(detectedDraft.savedAtTimestamp || Date.now()));

      // Release restore flag after React state hydration completes safely
      setTimeout(() => {
        isRestoringRef.current = false;
      }, 800);
    }
    setShowRecoveryBanner(false);
    setHasRestoredOrDismissed(true);
  }, [detectedDraft, onRecover]);

  const handleDismiss = useCallback(() => {
    setShowRecoveryBanner(false);
    setHasRestoredOrDismissed(true);
  }, []);

  const handleDiscard = useCallback(() => {
    activeVersionRef.current += 1;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (savingSafetyTimerRef.current) clearTimeout(savingSafetyTimerRef.current);
    isServerSavingRef.current = false;
    clearDraft(type, targetId, subType);
    setDetectedDraft(null);
    setShowRecoveryBanner(false);
    setHasRestoredOrDismissed(true);
    setSaveStatus('idle');
    setLastSaved(null);
  }, [type, targetId, subType]);

  const clearCurrentDraft = useCallback(() => {
    activeVersionRef.current += 1;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (savingSafetyTimerRef.current) clearTimeout(savingSafetyTimerRef.current);
    isServerSavingRef.current = false;
    clearDraft(type, targetId, subType);
    setDetectedDraft(null);
    setShowRecoveryBanner(false);
    setSaveStatus('idle');
    setLastSaved(null);
  }, [type, targetId, subType]);

  return {
    saveStatus,
    lastSaved,
    isOnline,
    detectedDraft,
    showRecoveryBanner,
    hasRestoredOrDismissed,
    handleRecover,
    handleDismiss,
    handleDiscard,
    performSave,
    clearCurrentDraft
  };
}

/**
 * Status indicator badge for form headers / footers
 */
export function AutoSaveStatusBadge({
  status,
  lastSaved,
  isOnline,
  onManualSave,
  className = ''
}: {
  status: SaveStatus;
  lastSaved: Date | null;
  isOnline: boolean;
  onManualSave?: () => void;
  className?: string;
}) {
  const formatTime = (d: Date | null) => {
    if (!d) return '';
    return d.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  return (
    <div className={`inline-flex items-center gap-2 text-xs font-mono select-none ${className}`}>
      {status === 'saving' && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-500 font-bold animate-pulse">
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping shrink-0" />
          <span>● Menyimpan...</span>
        </span>
      )}

      {status === 'saved' && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 font-semibold">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          <span>✓ Tersimpan otomatis {lastSaved ? `(${formatTime(lastSaved)})` : ''}</span>
        </span>
      )}

      {status === 'offline_saved' && (
        <span 
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 font-semibold"
          title="Koneksi terputus. Data disimpan aman di memori lokal perangkat admin."
        >
          <WifiOff className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
          <span>💾 Tersimpan lokal (Offline {lastSaved ? `• ${formatTime(lastSaved)}` : ''})</span>
        </span>
      )}

      {status === 'error' && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/25 text-rose-400 font-bold">
          <AlertCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
          <span>⚠ Gagal menyimpan</span>
        </span>
      )}

      {status === 'idle' && lastSaved && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-800/60 border border-neutral-700 text-neutral-400 text-[11px]">
          <History className="h-3 w-3 text-neutral-400 shrink-0" />
          <span>Draft: {formatTime(lastSaved)}</span>
        </span>
      )}

      {onManualSave && (
        <button
          type="button"
          onClick={onManualSave}
          title="Simpan draft ke memori sekarang"
          className="p-1 px-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
        >
          <Save className="h-3 w-3" />
          <span className="hidden sm:inline">Simpan Draft</span>
        </button>
      )}
    </div>
  );
}

/**
 * Prominent, elegant recovery banner when admin returns with an uncommitted draft
 */
export function DraftRecoveryBanner({
  draft,
  onRecover,
  onDiscard,
  typeLabel = 'Paket Tour'
}: {
  draft: AdminDraft<any> | null;
  onRecover: () => void;
  onDiscard: () => void;
  typeLabel?: string;
}) {
  if (!draft) return null;

  return (
    <div 
      id="admin-draft-recovery-banner"
      className="bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-amber-600/15 border-2 border-amber-500/40 rounded-2xl p-4 sm:p-5 shadow-lg animate-fade-in text-left mb-6"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0 mt-0.5">
            <History className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider font-mono text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                Draft sebelumnya ditemukan
              </span>
              <span className="text-[11px] font-mono text-neutral-400">
                {formatDraftTime(draft.savedAtTimestamp || draft.savedAt)}
              </span>
            </div>
            <h4 className="text-sm font-bold text-neutral-100">
              Draft {typeLabel}: <span className="text-amber-300 font-mono">"{draft.title || draft.targetId}"</span>
            </h4>
            <p className="text-xs text-amber-250 font-medium">
              Anda memiliki draft yang belum selesai. Pulihkan draft ini?
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
          <button
            type="button"
            id="btn-discard-draft"
            onClick={onDiscard}
            className="px-3.5 py-2 rounded-xl border border-neutral-750 bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <Trash2 className="h-3.5 w-3.5 text-neutral-400" />
            <span>Mulai Baru</span>
          </button>
          <button
            type="button"
            id="btn-recover-draft"
            onClick={onRecover}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-neutral-950 text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-md font-mono"
          >
            <RotateCcw className="h-3.5 w-3.5 text-neutral-950" />
            <span>Pulihkan Draft</span>
          </button>
        </div>
      </div>
    </div>
  );
}
