/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

/**
 * Smart Journey - Vite Dynamic Chunk Preload Recovery & Anti-Loop Guard
 * 
 * Automatically recovers from stale JavaScript chunk 404s after new deployments
 * (e.g., when a visitor holds an existing browser tab referencing obsolete chunk hashes).
 * Guards against infinite reload loops using session-based cool-downs.
 */

const PRELOAD_RELOAD_KEY = 'sj_vite_preload_last_reload';
const COOLDOWN_MS = 15000; // 15 seconds cool-down prevents reload loops

// Safe in-memory fallback if sessionStorage is inaccessible (e.g. SecurityError in private browsing or disabled storage)
const inMemoryStorage = new Map<string, string>();

function getStoredValue(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage.getItem(key);
    }
  } catch (err) {
    // sessionStorage blocked or threw DOMException (SecurityError)
  }
  return inMemoryStorage.get(key) || null;
}

function setStoredValue(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(key, value);
      return;
    }
  } catch (err) {
    // sessionStorage blocked or threw DOMException (SecurityError / QuotaExceededError)
  }
  inMemoryStorage.set(key, value);
}

/**
 * Global listener for Vite's preloadError event
 */
export function initPreloadRecovery(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('vite:preloadError', (event: any) => {
    try {
      const lastReload = Number(getStoredValue(PRELOAD_RELOAD_KEY) || 0);
      const now = Date.now();

      if (!lastReload || now - lastReload > COOLDOWN_MS) {
        console.warn(
          '[Smart Journey] Vite chunk preload error detected (stale deployment chunk). Performing safe one-time reload...',
          event?.payload || event
        );
        setStoredValue(PRELOAD_RELOAD_KEY, String(now));

        // Prevent unhandled rejection if supported
        if (typeof event.preventDefault === 'function') {
          event.preventDefault();
        }

        window.location.reload();
      } else {
        console.error(
          '[Smart Journey] Repeated Vite chunk preload error detected within cool-down window. Suppressing auto-reload to prevent infinite loop.',
          event?.payload || event
        );
        // Let error bubble so React Error Boundary displays user recovery UI
      }
    } catch (listenerErr) {
      console.error('[Smart Journey] Error inside vite:preloadError handler:', listenerErr);
    }
  });
}

// Auto-register listener when loaded in client environment
initPreloadRecovery();

/**
 * Safe React.lazy wrapper with deployment recovery and loop-guard.
 * If dynamic import fails (due to stale chunk or temporary network drop),
 * it triggers a safe one-time page reload. If already reloaded recently, throws to Error Boundary.
 */
export function safeLazyImport<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  chunkName: string
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    try {
      return await factory();
    } catch (err: any) {
      console.warn(`[Smart Journey] Dynamic import failed for chunk "${chunkName}":`, err);

      try {
        const chunkKey = `sj_chunk_reload_${chunkName}`;
        const lastRetry = Number(getStoredValue(chunkKey) || 0);
        const now = Date.now();

        // Only attempt reload if cool-down period has elapsed
        if (!lastRetry || now - lastRetry > COOLDOWN_MS) {
          setStoredValue(chunkKey, String(now));
          setStoredValue(PRELOAD_RELOAD_KEY, String(now));

          console.warn(`[Smart Journey] Reloading page once to fetch latest chunk for "${chunkName}"...`);
          window.location.reload();

          // Return unresolved promise while browser is unregistering to prevent unhandled React render crashes
          return new Promise<{ default: T }>(() => {});
        }
      } catch (guardErr) {
        console.error(`[Smart Journey] Error evaluating reload cooldown for chunk "${chunkName}":`, guardErr);
      }

      // If already reloaded recently and still failing, throw to Error Boundary
      throw err;
    }
  });
}
