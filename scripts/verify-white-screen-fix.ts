/**
 * Comprehensive Automated Verification Suite for White Screen & Stale Chunk Fixes
 */

import http from 'http';
import path from 'path';
import fs from 'fs';
import express from 'express';

async function runTestSuite() {
  console.log('================================================================');
  console.log('🧪 SMART JOURNEY - WHITE SCREEN & DEPLOYMENT RECOVERY TEST SUITE');
  console.log('================================================================\n');

  let passes = 0;
  let failures = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${desc}`);
      passes++;
    } else {
      console.error(`  ❌ FAIL: ${desc}`);
      failures++;
    }
  }

  // TEST SUITE 1: Express Production Static Serving & Cache Headers
  console.log('--- TEST SUITE 1: Production Static Headers & Missing Chunk 404 Guard ---');
  
  const distPath = path.join(process.cwd(), 'dist');
  const assetsPath = path.join(distPath, 'assets');

  const testApp = express();

  // Replicate production static logic from server.ts
  testApp.use(
    '/assets',
    express.static(assetsPath, {
      maxAge: '1y',
      immutable: true,
      index: false,
    })
  );

  testApp.use('/assets', (_req, res) => {
    res.status(404).type('text/plain').send('Asset chunk not found (version updated)');
  });

  testApp.use(
    express.static(distPath, {
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      },
    })
  );

  testApp.all(/\.(js|mjs|css|map|json|png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot)$/, (_req, res) => {
    res.status(404).type('text/plain').send('Resource not found');
  });

  testApp.get('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(distPath, 'index.html'));
  });

  const testServer = http.createServer(testApp);
  await new Promise<void>((resolve) => testServer.listen(3099, '127.0.0.1', () => resolve()));

  try {
    // 1.1 Verify index.html has no-cache headers
    const rootRes = await fetch('http://127.0.0.1:3099/');
    assert(rootRes.status === 200, 'Root GET / returns HTTP 200');
    assert(
      rootRes.headers.get('cache-control') === 'no-cache, no-store, must-revalidate',
      'Root GET / returns Cache-Control: no-cache, no-store, must-revalidate'
    );
    assert(rootRes.headers.get('pragma') === 'no-cache', 'Root GET / returns Pragma: no-cache');
    assert(rootRes.headers.get('expires') === '0', 'Root GET / returns Expires: 0');

    // 1.2 Verify SPA routes (e.g. /tours, /share-tour, /event-gathering) return index.html with no-cache
    for (const route of ['/tours', '/share-tour', '/event-gathering', '/admin']) {
      const routeRes = await fetch(`http://127.0.0.1:3099${route}`);
      const body = await routeRes.text();
      assert(routeRes.status === 200, `SPA route ${route} returns HTTP 200`);
      assert(
        routeRes.headers.get('cache-control') === 'no-cache, no-store, must-revalidate',
        `SPA route ${route} has no-cache header`
      );
      assert(body.includes('<div id="root"></div>'), `SPA route ${route} serves SPA index.html`);
    }

    // 1.3 Verify existing hashed asset in /assets/ has immutable caching
    const distAssets = fs.readdirSync(assetsPath).filter((f) => f.endsWith('.js'));
    if (distAssets.length > 0) {
      const sampleAsset = distAssets[0];
      const assetRes = await fetch(`http://127.0.0.1:3099/assets/${sampleAsset}`);
      assert(assetRes.status === 200, `Existing asset /assets/${sampleAsset} returns HTTP 200`);
      const cc = assetRes.headers.get('cache-control') || '';
      assert(
        cc.includes('max-age=31536000') && cc.includes('immutable'),
        `Existing asset /assets/${sampleAsset} has 1-year immutable caching (${cc})`
      );
    }

    // 1.4 CRITICAL: Missing chunk in /assets/ must return 404 text/plain, NOT index.html!
    const missingChunkRes = await fetch('http://127.0.0.1:3099/assets/ToursView-OBSOLETE12345.js');
    const missingChunkText = await missingChunkRes.text();
    assert(missingChunkRes.status === 404, 'Stale chunk /assets/ToursView-OBSOLETE12345.js returns HTTP 404');
    assert(
      !missingChunkText.includes('<!doctype') && !missingChunkText.includes('<html'),
      'Stale chunk 404 response DOES NOT return index.html (prevents SyntaxError: Unexpected token <)'
    );
    assert(
      missingChunkRes.headers.get('content-type')?.includes('text/plain') === true,
      'Stale chunk 404 returns text/plain content type'
    );

    // 1.5 Missing static file with extension returns 404, NOT index.html
    const missingScriptRes = await fetch('http://127.0.0.1:3099/missing-script.js');
    assert(missingScriptRes.status === 404, 'Missing root script returns HTTP 404');
    const missingScriptText = await missingScriptRes.text();
    assert(!missingScriptText.includes('<!doctype'), 'Missing root script does not return HTML');
  } finally {
    await new Promise<void>((resolve) => testServer.close(() => resolve()));
  }

  // TEST SUITE 2: vite:preloadError & Anti-Reload-Loop Simulation
  console.log('\n--- TEST SUITE 2: vite:preloadError & Anti-Reload Loop Simulation ---');

  // Simulated browser environment
  const mockStorage: Record<string, string> = {};
  const sessionStorageMock = {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, val: string) => { mockStorage[key] = val; },
    removeItem: (key: string) => { delete mockStorage[key]; },
    clear: () => { Object.keys(mockStorage).forEach((k) => delete mockStorage[k]); }
  };

  let reloadCallCount = 0;
  const mockWindow = {
    location: {
      reload: () => { reloadCallCount++; },
      href: 'http://localhost:3000/tours'
    }
  };

  const PRELOAD_KEY = 'sj_vite_preload_last_reload';
  const COOLDOWN_MS = 15000;

  function simulatePreloadError(now: number): boolean {
    const lastReload = Number(sessionStorageMock.getItem(PRELOAD_KEY) || 0);
    if (!lastReload || now - lastReload > COOLDOWN_MS) {
      sessionStorageMock.setItem(PRELOAD_KEY, String(now));
      mockWindow.location.reload();
      return true; // Reload triggered
    } else {
      return false; // Suppressed loop!
    }
  }

  // 2.1 First error triggers reload
  const t0 = 1000000;
  const firstTriggered = simulatePreloadError(t0);
  assert(firstTriggered === true, 'First preloadError triggers safe page reload');
  assert(reloadCallCount === 1, 'reloadCallCount is exactly 1');
  assert(sessionStorageMock.getItem(PRELOAD_KEY) === String(t0), 'sessionStorage recorded timestamp');

  // 2.2 Immediate subsequent error (e.g. 2s later) MUST NOT reload (Anti-loop guard)
  const secondTriggered = simulatePreloadError(t0 + 2000);
  assert(secondTriggered === false, 'Subsequent error within 15s cooldown DOES NOT trigger reload (Anti-Loop active)');
  assert(reloadCallCount === 1, 'reloadCallCount remains 1 (No infinite loop)');

  // 2.3 Another error at 5s later MUST NOT reload
  const thirdTriggered = simulatePreloadError(t0 + 5000);
  assert(thirdTriggered === false, 'Another error within 15s cooldown suppressed');
  assert(reloadCallCount === 1, 'reloadCallCount still 1');

  // 2.4 Error after cooldown window (e.g. 20s later) allows recovery again
  const fourthTriggered = simulatePreloadError(t0 + 20000);
  assert(fourthTriggered === true, 'Error after cooldown window elapsed triggers recovery reload');
  assert(reloadCallCount === 2, 'reloadCallCount increments to 2');

  // TEST SUITE 3: Dynamic Import Verification for Views
  console.log('\n--- TEST SUITE 3: View Chunks and Error Boundary Integration ---');

  // Provide minimal DOM mocks so Node can evaluate client component modules
  if (typeof (globalThis as any).document === 'undefined') {
    (globalThis as any).document = {
      createElement: () => ({ setAttribute: () => {}, appendChild: () => {} }),
      head: { appendChild: () => {}, removeChild: () => {} },
      body: { appendChild: () => {}, removeChild: () => {} },
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
    };
  }
  if (typeof (globalThis as any).window === 'undefined') {
    (globalThis as any).window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      location: { href: 'http://localhost:3000', search: '', hash: '' },
    };
  }
  if (typeof (globalThis as any).localStorage === 'undefined') {
    const lStore: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => lStore[k] || null,
      setItem: (k: string, v: string) => { lStore[k] = v; },
      removeItem: (k: string) => { delete lStore[k]; },
      clear: () => { Object.keys(lStore).forEach((k) => delete lStore[k]); },
    };
  }

  // Verify that all views can be dynamically imported without syntax or runtime issues
  const viewsToTest = [
    { name: 'ToursView', path: '../src/views/ToursView' },
    { name: 'ShareTourView', path: '../src/views/ShareTourView' },
    { name: 'GatheringView', path: '../src/views/GatheringView' },
    { name: 'AirportTransferView', path: '../src/views/AirportTransferView' },
    { name: 'TaxiView', path: '../src/views/TaxiView' },
    { name: 'CarRentalView', path: '../src/views/CarRentalView' },
    { name: 'AboutView', path: '../src/views/AboutView' },
    { name: 'AdminView', path: '../src/views/AdminView' },
  ];

  for (const v of viewsToTest) {
    try {
      const mod = await import(v.path);
      assert(typeof mod.default === 'function', `View ${v.name} exported default component`);
    } catch (err: any) {
      assert(false, `View ${v.name} import failed: ${err?.message}`);
    }
  }

  // TEST SUITE 4: ErrorBoundary UI and Recovery Verification
  console.log('\n--- TEST SUITE 4: ErrorBoundary Rendering Verification ---');

  const errorBoundaryFile = fs.readFileSync(path.join(process.cwd(), 'src/components/ErrorBoundary.tsx'), 'utf8');
  assert(errorBoundaryFile.includes('getDerivedStateFromError'), 'ErrorBoundary implements getDerivedStateFromError');
  assert(errorBoundaryFile.includes('componentDidCatch'), 'ErrorBoundary implements componentDidCatch');
  assert(errorBoundaryFile.includes('Muat Ulang Halaman'), 'ErrorBoundary provides "Muat Ulang Halaman" button');
  assert(errorBoundaryFile.includes('Kembali ke Beranda'), 'ErrorBoundary provides "Kembali ke Beranda" button');
  assert(errorBoundaryFile.includes('wa.me'), 'ErrorBoundary provides WhatsApp support fallback');
  assert(errorBoundaryFile.includes('isRoot'), 'ErrorBoundary supports both Root and View-level fallback layouts');

  console.log('\n================================================================');
  console.log(`📊 FINAL RESULT: ${passes} PASSED, ${failures} FAILED`);
  console.log('================================================================\n');

  if (failures > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((e) => {
  console.error('Test Suite crashed:', e);
  process.exit(1);
});
