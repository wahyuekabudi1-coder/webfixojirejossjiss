const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
  try {
    const devEnv = JSON.parse(fs.readFileSync('/app/.dev.env.json', 'utf8'));
    for (const [key, value] of Object.entries(devEnv)) {
      if (!process.env[key] && typeof value === 'string') {
        process.env[key] = value;
      }
    }
  } catch (e) {}
}

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DB_PATH = path.resolve(PROJECT_ROOT, 'data', 'db.json');
const TEST_PORT = 3008;
const TEST_BASE_URL = `http://localhost:${TEST_PORT}`;
const APP_PORT = 3000;
const APP_BASE_URL = `http://localhost:${APP_PORT}`;

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim();
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || '').trim();

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${message}`);
    failed++;
  }
}

function requestRaw(port, method, pathUrl, rawBody = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: port,
      path: pathUrl,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', (err) => reject(err));
    if (rawBody) {
      req.write(rawBody);
    }
    req.end();
  });
}

function requestJson(port, method, pathUrl, jsonBody = null, headers = {}) {
  const rawBody = jsonBody ? JSON.stringify(jsonBody) : null;
  return requestRaw(port, method, pathUrl, rawBody, headers);
}

function readDiskDB() {
  const raw = fs.readFileSync(DB_PATH, 'utf8');
  return JSON.parse(raw);
}

async function waitForServerReady(port, maxWaitMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await requestJson(port, 'GET', '/api/trips');
      if (res.status === 200) {
        return true;
      }
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Server on port ${port} failed to become ready within ${maxWaitMs}ms`);
}

async function isPortDead(port) {
  try {
    await requestJson(port, 'GET', '/api/trips');
    return false;
  } catch (_) {
    return true;
  }
}

async function runTrueRestartPersistenceE2E() {
  console.log('================================================================');
  console.log('🚀 SHARE TOUR / OPEN TRIP: TRUE PROCESS RESTART PERSISTENCE E2E');
  console.log('================================================================\n');

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('❌ Admin credentials missing in environment.');
    process.exit(1);
  }

  // Diagnostic log check
  console.log(`[Diagnostic Info] PROJECT_ROOT: ${PROJECT_ROOT}`);
  console.log(`[Diagnostic Info] DB_PATH: ${DB_PATH}`);
  console.log(`[Diagnostic Info] Physical db.json exists: ${fs.existsSync(DB_PATH)}`);

  const initialDisk = readDiskDB();
  const initialTripsCount = (initialDisk.trips || []).length;
  console.log(`[Diagnostic Info] Initial trips in authoritative db.json: ${initialTripsCount}`);

  let childProcess1 = null;
  let childProcess2 = null;
  const testTripId = `trip-restart-${Date.now()}`;
  const testTripSlug = `restart-test-${Date.now()}`;
  const testTripTitle = `True Restart Test Tour ${Date.now()}`;

  const uiTripId = `trip-ui-${Date.now()}`;
  const uiTripSlug = `ui-test-${Date.now()}`;
  const uiTripTitle = `Admin UI Created Tour ${Date.now()}`;

  try {
    // -------------------------------------------------------------
    // STEP 1: SPAWN REAL NODE SERVER PROCESS #1
    // -------------------------------------------------------------
    console.log('\n--- Step 1: Starting Actual Server as Child Process #1 ---');
    childProcess1 = spawn('node', ['dist/server.cjs'], {
      env: { ...process.env, PORT: String(TEST_PORT), NODE_ENV: 'production' },
      cwd: PROJECT_ROOT,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const pid1 = childProcess1.pid;
    assert(!!pid1, `Child process #1 spawned with PID: ${pid1}`);

    childProcess1.stdout.on('data', (d) => {
      const line = d.toString().trim();
      if (line.includes('[Persistence]') || line.includes('[SmartJourney Fullstack Engine]')) {
        console.log(`  [Proc 1 stdout] ${line}`);
      }
    });

    await waitForServerReady(TEST_PORT);
    console.log(`✅ Server Process #1 is healthy and responding on port ${TEST_PORT}`);

    // -------------------------------------------------------------
    // STEP 2: REAL ADMIN LOGIN ON PROCESS #1
    // -------------------------------------------------------------
    console.log('\n--- Step 2: Real Admin Login via API on Process #1 ---');
    const loginRes = await requestJson(TEST_PORT, 'POST', '/api/auth/login', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    assert(loginRes.status === 200, `POST /api/auth/login returns HTTP 200 (got ${loginRes.status})`);
    const token = loginRes.body?.token;
    assert(!!token, 'Authoritative session token received from Process #1');

    // -------------------------------------------------------------
    // STEP 3: CREATE SHARE TOUR VIA POST /api/trips ON PROCESS #1
    // -------------------------------------------------------------
    console.log('\n--- Step 3: Create Share Tour (POST /api/trips) on Process #1 ---');
    const newTripPayload = {
      id: testTripId,
      title: testTripTitle,
      slug: testTripSlug,
      location: 'Bromo & Ijen Crater, East Java',
      duration: '4 Days / 3 Nights',
      days: 4,
      nights: 3,
      category: 'Adventure',
      experienceCategory: 'Adventure',
      description: 'Exclusive verification tour created to prove TRUE process termination resilience.',
      coverImage: 'https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?auto=format&fit=crop&w=1200&q=80',
      highlight: 'Sunrise jeep trekking, sulfur crater exploration, certified guides',
      startingPrice: 210,
      wniPrice: 3360000,
      status: 'published',
      included: ['Jeep 4x4', 'National Park Entrance Fees', 'Gas Mask', 'Local Guide'],
      excluded: ['Flight tickets', 'Personal insurance', 'Tipping'],
      gallery: [],
      faq: [],
      itinerary: [
        {
          day: 1,
          title: 'Arrival & Transit to Bromo Area',
          description: 'Pick up from meeting point and transfer to hotel.',
          timeSchedules: [{ time: '14:00', activity: 'Hotel Check-in & Briefing' }]
        },
        {
          day: 2,
          title: 'Bromo Sunrise & Sea of Sand Trek',
          description: 'Early morning 4WD Jeep exploration to Penanjakan.',
          timeSchedules: [{ time: '03:00', activity: '4WD Jeep Departure' }]
        }
      ]
    };

    const createRes = await requestJson(TEST_PORT, 'POST', '/api/trips', newTripPayload, {
      'Authorization': `Bearer ${token}`
    });

    assert(createRes.status === 201, `POST /api/trips returns HTTP 201 Created (got ${createRes.status})`);
    assert(createRes.body?.id === testTripId, `Created trip returns matching ID (${testTripId})`);
    assert(createRes.body?.status === 'published', `Created trip returns status: published`);

    // -------------------------------------------------------------
    // STEP 4: PHYSICAL DISK VERIFICATION (data/db.json)
    // -------------------------------------------------------------
    console.log('\n--- Step 4: Physical Disk Verification on Storage (data/db.json) ---');
    const diskDB = readDiskDB();
    const diskTrip = (diskDB.trips || []).find((t) => t.id === testTripId);
    assert(!!diskTrip, `Trip is physically written to authoritative storage (${DB_PATH})`);
    assert(diskTrip?.title === testTripTitle, `Trip title matches on physical disk`);
    assert(diskTrip?.status === 'published', `Trip status is 'published' on physical disk`);
    assert(diskTrip?.days === 4, `Trip duration days persisted correctly (4 days)`);

    // GET /api/trips verification on Process #1
    const getRes1 = await requestJson(TEST_PORT, 'GET', `/api/trips/${testTripId}`);
    assert(getRes1.status === 200, `GET /api/trips/${testTripId} returns HTTP 200 on Process #1`);
    assert(getRes1.body?.slug === testTripSlug, `Trip returns correct slug`);

    // -------------------------------------------------------------
    // STEP 5: TERMINATE PROCESS #1 COMPLETELY (TRUE KILL)
    // -------------------------------------------------------------
    console.log('\n--- Step 5: TERMINATING PROCESS #1 COMPLETELY ---');
    console.log(`Sending SIGTERM to Process #1 (PID: ${pid1})...`);
    childProcess1.kill('SIGTERM');

    // Wait for exit
    await new Promise((resolve) => {
      let resolved = false;
      childProcess1.on('exit', (code, sig) => {
        if (!resolved) {
          resolved = true;
          console.log(`Process #1 exited with code: ${code}, signal: ${sig}`);
          resolve();
        }
      });
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          try { childProcess1.kill('SIGKILL'); } catch (_) {}
          resolve();
        }
      }, 3000);
    });

    // Ensure process is dead
    let isPid1Dead = false;
    try {
      process.kill(pid1, 0);
    } catch (err) {
      if (err.code === 'ESRCH') isPid1Dead = true;
    }
    assert(isPid1Dead, `TRUE TERMINATION: Process #1 (PID ${pid1}) is completely dead and terminated by OS`);

    const portDead = await isPortDead(TEST_PORT);
    assert(portDead, `Port ${TEST_PORT} is verified closed (connection refused, no server running)`);

    // -------------------------------------------------------------
    // STEP 6: START A BRAND NEW SERVER PROCESS #2
    // -------------------------------------------------------------
    console.log('\n--- Step 6: Starting a BRAND NEW Server Process #2 ---');
    childProcess2 = spawn('node', ['dist/server.cjs'], {
      env: { ...process.env, PORT: String(TEST_PORT), NODE_ENV: 'production' },
      cwd: PROJECT_ROOT,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const pid2 = childProcess2.pid;
    assert(!!pid2 && pid2 !== pid1, `Brand new process #2 spawned with PID: ${pid2} (distinct from PID ${pid1})`);

    childProcess2.stdout.on('data', (d) => {
      const line = d.toString().trim();
      if (line.includes('[Persistence]') || line.includes('[SmartJourney Fullstack Engine]')) {
        console.log(`  [Proc 2 stdout] ${line}`);
      }
    });

    await waitForServerReady(TEST_PORT);
    console.log(`✅ Brand New Server Process #2 is ready on port ${TEST_PORT}`);

    // -------------------------------------------------------------
    // STEP 7: VERIFY PERSISTENCE AFTER RESTART
    // -------------------------------------------------------------
    console.log('\n--- Step 7: Verify Tour Survives on Process #2 (Post-Restart) ---');
    const getTripsAfterRestart = await requestJson(TEST_PORT, 'GET', '/api/trips');
    assert(getTripsAfterRestart.status === 200, `GET /api/trips on new process returns HTTP 200`);

    const tripAfterRestart = (getTripsAfterRestart.body || []).find((t) => t.id === testTripId);
    assert(!!tripAfterRestart, `Trip "${testTripTitle}" SURVIVES TRUE SERVER PROCESS RESTART`);
    assert(tripAfterRestart?.title === testTripTitle, `Trip title intact after restart: ${tripAfterRestart?.title}`);
    assert(tripAfterRestart?.duration === '4 Days / 3 Nights', `Trip duration intact after restart`);

    const getDetailAfterRestart = await requestJson(TEST_PORT, 'GET', `/api/trips/${testTripSlug}`);
    assert(getDetailAfterRestart.status === 200, `Public GET /api/trips/:slug returns HTTP 200 on new process`);
    assert(getDetailAfterRestart.body?.id === testTripId, `Public GET returns matching ID`);

    // -------------------------------------------------------------
    // STEP 8: PLAYWRIGHT BROWSER TEST (PUBLIC VIEW & REFRESH)
    // -------------------------------------------------------------
    console.log('\n--- Step 8: Playwright Real Browser Public Page & Reload Test ---');
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    });

    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await context.newPage();

      // 1. Visit Public Share Tour page on active application
      console.log('Navigating to public Share Tour page...');
      await page.goto(`${APP_BASE_URL}/#share-tour`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1000);

      let content = await page.content();
      assert(content.includes(testTripTitle), `Trip "${testTripTitle}" is rendered on public Share Tour page`);

      // 2. Perform Browser Refresh
      console.log('Performing browser refresh on public page...');
      await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1500);

      content = await page.content();
      assert(content.includes(testTripTitle), `Trip "${testTripTitle}" PERSISTS AFTER BROWSER REFRESH on public page`);

      // 3. Navigate away and back
      console.log('Navigating Home -> Share Tour...');
      await page.goto(`${APP_BASE_URL}/#home`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(800);
      await page.goto(`${APP_BASE_URL}/#share-tour`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1500);

      content = await page.content();
      assert(content.includes(testTripTitle), `Trip "${testTripTitle}" PERSISTS AFTER NAVIGATING AWAY AND BACK`);

      // -------------------------------------------------------------
      // STEP 9: PLAYWRIGHT REAL ADMIN UI CREATE TEST (SECTION 6)
      // -------------------------------------------------------------
      console.log('\n--- Step 9: Real Admin UI Create Test via Playwright ---');
      await page.goto(`${APP_BASE_URL}/#admin`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1200);

      // Check if login form is present
      const emailInput = page.locator('input[type="email"]');
      if (await emailInput.isVisible()) {
        console.log('Logging in via Admin Login UI...');
        await emailInput.fill(ADMIN_EMAIL);
        const passInput = page.locator('input[type="password"]');
        await passInput.fill(ADMIN_PASSWORD);
        await page.locator('button[type="submit"]').click();
        await page.waitForTimeout(2500);
      }

      // Navigate to Share Tour module
      console.log('Opening Share Tour / Open Trip module in sidebar...');
      await page.locator('text=Share Tour / Open Trip').first().click();
      await page.waitForTimeout(1200);

      // Open Trip Blueprints
      const blueprintsTab = page.locator('button:has-text("Trip Blueprints")').first();
      if (await blueprintsTab.isVisible()) {
        await blueprintsTab.click();
        await page.waitForTimeout(1000);
      }

      // Verify restart-tested trip is listed in Admin table
      content = await page.content();
      assert(content.includes(testTripTitle), `Test Tour "${testTripTitle}" is visible in Admin Blueprint catalog`);

      // Now create a NEW unique tour through the Admin UI!
      console.log('Clicking "Tambah Paket Baru" button in UI...');
      const createBtn = page.locator('button:has-text("Tambah Paket Baru")').first();
      await createBtn.click();
      await page.waitForTimeout(1000);

      // Fill in UI form fields
      console.log(`Filling form for "${uiTripTitle}"...`);
      const titleField = page.locator('input[placeholder*="Labuan Bajo"]').first();
      await titleField.fill(uiTripTitle);

      const locField = page.locator('input[placeholder*="Flores Island"]').first();
      await locField.fill('Dieng Plateau, Central Java');

      const descField = page.locator('textarea[placeholder*="Introduce this tour destination"]').first();
      await descField.fill('Spectacular mountain landscapes, volcanic craters, and cultural heritage sites.');

      // Click "Commit Changes"
      console.log('Clicking "Commit Changes" in UI...');
      const commitBtn = page.locator('button:has-text("Commit Changes")').first();
      await commitBtn.click();
      await page.waitForTimeout(2500);

      // Verify UI-created tour is visible in Admin table
      content = await page.content();
      assert(content.includes(uiTripTitle), `UI-Created Tour "${uiTripTitle}" appears in Admin Blueprint catalog`);

      // Verify it was physically persisted to data/db.json
      const diskAfterUIClick = readDiskDB();
      const uiTripOnDisk = (diskAfterUIClick.trips || []).find((t) => t.title === uiTripTitle);
      assert(!!uiTripOnDisk, `UI-Created Tour is physically saved to data/db.json on storage`);
      assert(uiTripOnDisk?.status === 'published', `UI-Created Tour status is published on disk`);

      // Reload browser in Admin view
      console.log('Reloading browser in Admin view...');
      await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Ensure blueprints tab is opened if needed
      const blueprintsTabAfterReload = page.locator('button:has-text("Trip Blueprints")').first();
      if (await blueprintsTabAfterReload.isVisible()) {
        await blueprintsTabAfterReload.click();
        await page.waitForTimeout(1000);
      }

      content = await page.content();
      assert(content.includes(uiTripTitle), `UI-Created Tour PERSISTS IN ADMIN VIEW AFTER BROWSER REFRESH`);

      // Navigate away to Home and back to Admin
      console.log('Navigating away to Home and returning to Admin...');
      await page.goto(`${APP_BASE_URL}/#home`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(800);
      await page.goto(`${APP_BASE_URL}/#admin`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1500);

      const shareTourNav = page.locator('text=Share Tour / Open Trip').first();
      if (await shareTourNav.isVisible()) {
        await shareTourNav.click();
        await page.waitForTimeout(1000);
      }
      content = await page.content();
      assert(content.includes(uiTripTitle), `UI-Created Tour PERSISTS IN ADMIN VIEW AFTER NAVIGATING AWAY AND BACK`);

      // Open public Share Tour page
      console.log('Navigating to public Share Tour page to verify UI-created tour...');
      await page.goto(`${APP_BASE_URL}/#share-tour`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1500);

      content = await page.content();
      assert(content.includes(uiTripTitle), `UI-Created Tour is rendered on public Share Tour page`);

      // Reload public page
      console.log('Reloading public Share Tour page...');
      await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1500);

      content = await page.content();
      assert(content.includes(uiTripTitle), `UI-Created Tour PERSISTS ON PUBLIC PAGE AFTER BROWSER REFRESH`);

      // -------------------------------------------------------------
      // STEP 10: DELETE-ONLY REMOVAL (AUTHENTICATED ADMIN OPERATION)
      // -------------------------------------------------------------
      console.log('\n--- Step 10: Explicit Admin Delete-Only Removal ---');
      // Login on Process #2 to get token for deletion
      const loginRes2 = await requestJson(TEST_PORT, 'POST', '/api/auth/login', {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD
      });
      const token2 = loginRes2.body?.token;

      // Delete test trip 1
      const delRes1 = await requestJson(TEST_PORT, 'DELETE', `/api/trips/${testTripId}`, null, {
        'Authorization': `Bearer ${token2}`
      });
      assert(delRes1.status === 200, `DELETE /api/trips/${testTripId} returns HTTP 200 (got ${delRes1.status})`);

      // Delete UI-created trip if found
      if (uiTripOnDisk?.id) {
        const delRes2 = await requestJson(TEST_PORT, 'DELETE', `/api/trips/${uiTripOnDisk.id}`, null, {
          'Authorization': `Bearer ${token2}`
        });
        assert(delRes2.status === 200, `DELETE /api/trips/${uiTripOnDisk.id} returns HTTP 200 (got ${delRes2.status})`);
      }

      // Verify physical removal from disk
      const finalDisk = readDiskDB();
      const trip1StillOnDisk = (finalDisk.trips || []).some((t) => t.id === testTripId);
      const trip2StillOnDisk = (finalDisk.trips || []).some((t) => t.title === uiTripTitle);
      assert(!trip1StillOnDisk, `Test Tour 1 physically removed from data/db.json ONLY after explicit admin delete`);
      assert(!trip2StillOnDisk, `UI-Created Tour physically removed from data/db.json ONLY after explicit admin delete`);

      // Verify GET returns 404
      const getDeletedRes = await requestJson(TEST_PORT, 'GET', `/api/trips/${testTripId}`);
      assert(getDeletedRes.status === 404, `GET /api/trips/:id returns HTTP 404 after deletion`);
    } finally {
      await browser.close();
    }
  } finally {
    // Clean up spawned child processes
    if (childProcess1) {
      try { childProcess1.kill('SIGKILL'); } catch (_) {}
    }
    if (childProcess2) {
      try { childProcess2.kill('SIGKILL'); } catch (_) {}
    }
  }

  console.log('\n================================================================');
  console.log(`TOTAL CHECKS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTrueRestartPersistenceE2E().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
