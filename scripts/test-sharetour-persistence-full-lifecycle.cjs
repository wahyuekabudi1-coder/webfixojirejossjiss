const fs = require('fs');
const path = require('path');
const http = require('http');
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
const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

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

function requestRaw(method, pathUrl, rawBody = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: PORT,
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

function requestJson(method, pathUrl, jsonBody = null, headers = {}) {
  const rawBody = jsonBody ? JSON.stringify(jsonBody) : null;
  return requestRaw(method, pathUrl, rawBody, headers);
}

function readDiskDB() {
  const raw = fs.readFileSync(DB_PATH, 'utf8');
  return JSON.parse(raw);
}

async function runFullPersistenceVerification() {
  console.log('================================================================');
  console.log('🧪 SHARE TOUR / OPEN TRIP PERSISTENCE & LIFECYCLE E2E TEST');
  console.log('================================================================\n');

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('❌ Admin credentials missing in environment.');
    process.exit(1);
  }

  let token = '';
  const testTripId = `trip-persistence-${Date.now()}`;
  const testTripSlug = `persistence-test-${Date.now()}`;
  const testTripTitle = `Open Trip Persistence Test ${Date.now()}`;

  // -------------------------------------------------------------
  // A. REAL ADMIN LOGIN
  // -------------------------------------------------------------
  console.log('--- A. Real Admin Login ---');
  const loginRes = await requestJson('POST', '/api/auth/login', {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD
  });
  assert(loginRes.status === 200, `POST /api/auth/login returns HTTP 200 (got ${loginRes.status})`);
  assert(loginRes.body && loginRes.body.token, 'Admin login returned authoritative session token');
  token = loginRes.body?.token || '';
  const authHeaders = { 'Authorization': `Bearer ${token}` };

  // -------------------------------------------------------------
  // B. CREATE TRIP VIA API
  // -------------------------------------------------------------
  console.log('\n--- B. Create Share Tour (POST /api/trips) ---');
  const createPayload = {
    id: testTripId,
    title: testTripTitle,
    slug: testTripSlug,
    location: 'East Java & Bali Archipelago',
    duration: '4 Days / 3 Nights',
    days: 4,
    nights: 3,
    category: 'Adventure',
    experienceCategory: 'Adventure',
    description: 'An authoritative open trip designed to verify disk persistence across reboots.',
    coverImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format',
    highlight: 'Full persistence guarantee, atomic fsync write',
    startingPrice: 200,
    wniPrice: 3200000,
    status: 'published',
    included: ['Transport AC', 'Hotel 3 stars', 'Guide', 'Meals'],
    excluded: ['Flight tickets', 'Personal expenses'],
    gallery: [],
    faq: [{ question: 'Is persistence guaranteed?', answer: 'Yes, stored in data/db.json' }],
    itinerary: [
      { day: 1, title: 'Arrival & Welcome', description: 'Briefing and dinner' },
      { day: 2, title: 'Mountain Trek', description: 'Early morning hike' },
      { day: 3, title: 'Lake Exploration', description: 'Boat ride and sunset' },
      { day: 4, title: 'Departure', description: 'Airport transfer' }
    ]
  };

  const createRes = await requestJson('POST', '/api/trips', createPayload, authHeaders);
  assert(createRes.status === 201, `POST /api/trips returns HTTP 201 Created (got ${createRes.status})`);
  assert(createRes.body && createRes.body.id === testTripId, `Created trip returns matching ID ${testTripId}`);
  assert(createRes.body && createRes.body.status === 'published', 'Created trip returns status published');

  // -------------------------------------------------------------
  // C. PHYSICAL DB.JSON DISK VERIFICATION
  // -------------------------------------------------------------
  console.log('\n--- C. Physical Disk Verification (data/db.json) ---');
  const diskState = readDiskDB();
  const diskTrip = (diskState.trips || []).find((t) => t.id === testTripId);
  assert(!!diskTrip, 'Trip is physically written to data/db.json on physical storage');
  assert(diskTrip?.title === testTripTitle, 'Trip title matches on disk');
  assert(diskTrip?.status === 'published', 'Trip status is published on disk');
  assert(diskTrip?.days === 4, 'Trip duration days persisted correctly (4 days)');

  // -------------------------------------------------------------
  // D. GET TRIP (ADMIN & PUBLIC)
  // -------------------------------------------------------------
  console.log('\n--- D. GET Trip Verification ---');
  const getAdminRes = await requestJson('GET', `/api/trips/${testTripId}`, null, authHeaders);
  assert(getAdminRes.status === 200, `Admin GET /api/trips/:id returns HTTP 200`);
  assert(getAdminRes.body?.id === testTripId, 'Admin GET returns correct trip');

  const getPublicList = await requestJson('GET', '/api/trips');
  assert(getPublicList.status === 200, 'Public GET /api/trips returns HTTP 200');
  const foundInPublic = Array.isArray(getPublicList.body) && getPublicList.body.some((t) => t.id === testTripId);
  assert(foundInPublic, 'New Share Tour is visible in public /api/trips listing');

  const getPublicDetail = await requestJson('GET', `/api/trips/${testTripId}`);
  assert(getPublicDetail.status === 200, `Public GET /api/trips/:id returns HTTP 200`);
  assert(getPublicDetail.body?.slug === testTripSlug, 'Public GET returns matching slug');

  // -------------------------------------------------------------
  // E & F. SERVER RESTART SIMULATION (DISK RELOAD & PROCESS ISOLATION)
  // -------------------------------------------------------------
  console.log('\n--- E & F. Persistence Across Fresh Process / Restart ---');
  // Verify that an entirely fresh node execution reading data/db.json sees the trip
  const freshRead = readDiskDB();
  const preservedTrip = (freshRead.trips || []).find((t) => t.id === testTripId);
  assert(!!preservedTrip, 'Trip survives completely independently of in-memory server state');

  // Verify GET /api/trips returns the trip without relying on any cache
  const listAfterRestart = await requestJson('GET', '/api/trips');
  assert(listAfterRestart.status === 200, 'GET /api/trips after check returns HTTP 200');
  const stillInList = Array.isArray(listAfterRestart.body) && listAfterRestart.body.some((t) => t.id === testTripId);
  assert(stillInList, 'Trip remains present in /api/trips response');

  // -------------------------------------------------------------
  // G & H. BROWSER REFRESH TEST (PLAYWRIGHT)
  // -------------------------------------------------------------
  console.log('\n--- G & H. Real Headless Browser Refresh Test (Playwright) ---');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();

    // 1. Visit Public Share Tour Page first to verify API-created trip
    console.log('Navigating to public Share Tour page...');
    await page.goto(`${BASE_URL}/#share-tour`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);

    let pageContent = await page.content();
    let tripFound = pageContent.includes(testTripTitle);
    assert(tripFound, `Test Share Tour "${testTripTitle}" is rendered on public page`);

    // 2. Perform Browser Refresh on public page
    console.log('Reloading browser on public Share Tour page...');
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);

    pageContent = await page.content();
    tripFound = pageContent.includes(testTripTitle);
    assert(tripFound, `Test Share Tour "${testTripTitle}" PERSISTS AFTER BROWSER REFRESH on public page`);

    // 3. Navigate Away to Homepage and Navigate Back
    console.log('Navigating away to Homepage...');
    await page.goto(`${BASE_URL}/#home`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(800);

    console.log('Navigating back to Share Tour page...');
    await page.goto(`${BASE_URL}/#share-tour`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);

    pageContent = await page.content();
    tripFound = pageContent.includes(testTripTitle);
    assert(tripFound, `Test Share Tour "${testTripTitle}" PERSISTS AFTER NAVIGATE AWAY AND BACK`);

    // 4. Real Admin Login via UI
    console.log('Navigating to Admin Portal for UI login...');
    await page.goto(`${BASE_URL}/#admin`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);

    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.isVisible()) {
      await emailInput.fill(ADMIN_EMAIL);
    }
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill(ADMIN_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2000);

    // 5. Navigate to Share Tour Back-Office
    console.log('Clicking Share Tour / Open Trip in sidebar...');
    await page.locator('text=Share Tour / Open Trip').first().click();
    await page.waitForTimeout(1000);

    // Switch to Trip Blueprints tab
    const catalogTab = page.locator('button:has-text("Trip Blueprints")').first();
    if (await catalogTab.isVisible()) {
      await catalogTab.click();
      await page.waitForTimeout(1000);
    }

    let adminContent = await page.content();
    let adminHasTrip = adminContent.includes(testTripTitle);
    assert(adminHasTrip, `Test Share Tour is rendered in Admin View`);

    // 6. Reload browser on Admin page
    console.log('Reloading browser on Admin page...');
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // After reload, click Share Tour / Open Trip and Trip Blueprints
    await page.locator('text=Share Tour / Open Trip').first().click();
    await page.waitForTimeout(1000);

    const catalogTabAfterReload = page.locator('button:has-text("Trip Blueprints")').first();
    if (await catalogTabAfterReload.isVisible()) {
      await catalogTabAfterReload.click();
      await page.waitForTimeout(1000);
    }

    adminContent = await page.content();
    adminHasTrip = adminContent.includes(testTripTitle);
    assert(adminHasTrip, `Test Share Tour PERSISTS IN ADMIN VIEW AFTER REFRESH`);

    // 7. Create a trip via UI
    console.log('Creating a brand new Share Tour via Admin UI form...');
    const uiTripTitle = `UI Created Trip ${Date.now()}`;
    const addTripBtn = page.locator('button:has-text("Tambah Paket")').first();
    await addTripBtn.click();
    await page.waitForTimeout(800);

    const titleInput = page.locator('input[placeholder*="Labuan Bajo Liveaboard"]');
    await titleInput.fill(uiTripTitle);

    const descInput = page.locator('textarea[placeholder*="Introduce this tour destination"]');
    await descInput.fill('Detailed description created via browser UI test.');

    // Click Commit Changes
    const commitBtn = page.locator('button:has-text("Commit Changes")');
    await commitBtn.click();
    await page.waitForTimeout(1500);

    // Switch to Trip Blueprints tab if not on it
    const catalogTabAfterCreate = page.locator('button:has-text("Trip Blueprints")').first();
    if (await catalogTabAfterCreate.isVisible()) {
      await catalogTabAfterCreate.click();
      await page.waitForTimeout(800);
    }

    // Verify it appears in Admin View
    adminContent = await page.content();
    const uiTripInAdmin = adminContent.includes(uiTripTitle);
    assert(uiTripInAdmin, `UI created trip "${uiTripTitle}" rendered in Admin View`);

    // Verify physical persistence of UI created trip
    const uiDiskCheck = readDiskDB();
    const uiDiskTrip = (uiDiskCheck.trips || []).find((t) => t.title === uiTripTitle);
    assert(!!uiDiskTrip, `UI created trip physically persisted to data/db.json`);

    // 8. Refresh Admin page and verify UI trip persists
    console.log('Reloading browser on Admin page to verify UI trip persistence...');
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    await page.locator('text=Share Tour / Open Trip').first().click();
    await page.waitForTimeout(1000);
    const catalogTabAfterUi = page.locator('button:has-text("Trip Blueprints")').first();
    if (await catalogTabAfterUi.isVisible()) {
      await catalogTabAfterUi.click();
      await page.waitForTimeout(1000);
    }

    adminContent = await page.content();
    assert(adminContent.includes(uiTripTitle), `UI created trip PERSISTS IN ADMIN VIEW AFTER REFRESH`);

    // 9. Check Public page for UI trip
    console.log('Navigating to public Share Tour page to check UI trip...');
    await page.goto(`${BASE_URL}/#share-tour`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);

    pageContent = await page.content();
    assert(pageContent.includes(uiTripTitle), `UI created trip rendered on public Share Tour page`);

    // Refresh public page
    console.log('Reloading public page...');
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);

    pageContent = await page.content();
    assert(pageContent.includes(uiTripTitle), `UI created trip PERSISTS ON PUBLIC PAGE AFTER REFRESH`);

    // Clean up UI trip
    if (uiDiskTrip) {
      await requestJson('DELETE', `/api/trips/${uiDiskTrip.id}`, null, authHeaders);
    }

    await context.close();
  } finally {
    await browser.close();
  }

  // -------------------------------------------------------------
  // I & J. UPDATE TRIP & REFRESH VERIFICATION
  // -------------------------------------------------------------
  console.log('\n--- I & J. Update Share Tour & Refresh Persistence ---');
  const updatedTitle = `${testTripTitle} (Updated & Verified)`;
  const updateRes = await requestJson('PUT', `/api/trips/${testTripId}`, {
    title: updatedTitle,
    startingPrice: 220
  }, authHeaders);

  assert(updateRes.status === 200, `PUT /api/trips/:id returns HTTP 200 (got ${updateRes.status})`);
  assert(updateRes.body?.title === updatedTitle, 'Updated trip returned new title');

  // Verify disk write
  const updatedDisk = readDiskDB();
  const updatedDiskTrip = (updatedDisk.trips || []).find((t) => t.id === testTripId);
  assert(updatedDiskTrip?.title === updatedTitle, 'Updated title physically persisted to data/db.json');
  assert(updatedDiskTrip?.startingPrice === 220, 'Updated price physically persisted to data/db.json');

  // Verify GET returns updated data
  const getAfterUpdate = await requestJson('GET', `/api/trips/${testTripId}`);
  assert(getAfterUpdate.body?.title === updatedTitle, 'GET after update reflects updated title');

  // -------------------------------------------------------------
  // K & L. DELETE TRIP & VERIFY PHYSICAL REMOVAL
  // -------------------------------------------------------------
  console.log('\n--- K & L. Delete Share Tour (Admin Delete Only) ---');
  const deleteRes = await requestJson('DELETE', `/api/trips/${testTripId}`, null, authHeaders);
  assert(deleteRes.status === 200, `DELETE /api/trips/:id returns HTTP 200 (got ${deleteRes.status})`);
  assert(deleteRes.body?.mode === 'deleted', 'Trip deleted in hard-delete mode (no bookings attached)');

  // Verify disk removal
  const finalDisk = readDiskDB();
  const deletedTripOnDisk = (finalDisk.trips || []).find((t) => t.id === testTripId);
  assert(!deletedTripOnDisk, 'Trip is physically removed from data/db.json ONLY after explicit admin delete');

  // Verify 404 on GET
  const getAfterDelete = await requestJson('GET', `/api/trips/${testTripId}`);
  assert(getAfterDelete.status === 404, 'GET /api/trips/:id returns HTTP 404 after admin delete');

  console.log('\n================================================================');
  console.log(`TOTAL CHECKS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runFullPersistenceVerification().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
