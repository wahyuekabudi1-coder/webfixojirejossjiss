/**
 * SMART JOURNEY — ADMIN PRIVATE TOUR PAYLOAD LIMIT & 413 HANDLING TEST
 * 
 * Verifies:
 * 1. Admin login via POST /api/auth/login using real environment credentials
 * 2. POST /api/main-tours with realistic Private Tour payload (including base64 gallery) -> HTTP 201
 * 3. Physical persistence verification on data/db.json
 * 4. PUT /api/main-tours/:id with updated payload -> HTTP 200 & physical persistence verified
 * 5. Large payload within limit (~14MB base64) -> HTTP 200/201 without PayloadTooLargeError
 * 6. Oversized payload exceeding 20MB (~22MB) -> cleanly rejected with HTTP 413 and helpful JSON message
 * 7. Database integrity preserved (oversized payload does NOT touch data/db.json)
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const dotenv = require('dotenv');

dotenv.config();

if (fs.existsSync('/app/.dev.env.json')) {
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
const DB_PATH = path.join(PROJECT_ROOT, 'data', 'db.json');
const PORT = 3000;

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
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };
    if (rawBody) {
      defaultHeaders['Content-Length'] = Buffer.byteLength(rawBody);
    }
    const options = {
      hostname: '127.0.0.1',
      port: PORT,
      path: pathUrl,
      method: method,
      headers: defaultHeaders
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
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

async function runPayloadSuite() {
  console.log('================================================================');
  console.log('📦 SMART JOURNEY: PRIVATE TOUR PAYLOAD LIMIT & 413 TEST SUITE');
  console.log('================================================================\n');

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.log('STATUS = NOT RUN: Admin credentials missing in environment.');
    process.exit(0);
  }

  let realAdminToken = '';
  const testTourId = `tour-payload-test-${Date.now()}`;
  const largeTourId = `tour-large-test-${Date.now()}`;
  const oversizedTourId = `tour-oversized-test-${Date.now()}`;

  try {
    // ----------------------------------------------------
    // STEP 1: REAL ADMIN LOGIN
    // ----------------------------------------------------
    console.log('--- STEP 1: Real Admin Login via POST /api/auth/login ---');
    const loginRes = await requestJson('POST', '/api/auth/login', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    assert(loginRes.status === 200, 'POST /api/auth/login succeeded with HTTP 200');
    assert(Boolean(loginRes.body && loginRes.body.token), 'Received authoritative admin session token');
    realAdminToken = loginRes.body?.token;

    // ----------------------------------------------------
    // STEP 2: CREATE PRIVATE TOUR WITH REALISTIC PAYLOAD & GALLERY
    // ----------------------------------------------------
    console.log('\n--- STEP 2: Create Private Tour with Realistic Base64 Gallery ---');
    // Generate realistic base64 image strings (simulating user-uploaded photos)
    const mockPhotoBase64 = 'data:image/jpeg;base64,' + 'A'.repeat(500 * 1024); // ~500KB photo
    const mockGallery = [
      'data:image/jpeg;base64,' + 'B'.repeat(500 * 1024),
      'data:image/jpeg;base64,' + 'C'.repeat(500 * 1024),
      'data:image/jpeg;base64,' + 'D'.repeat(500 * 1024)
    ]; // ~1.5MB gallery

    const realisticTourPayload = {
      id: testTourId,
      name: 'Bromo & Madakaripura High-Res Photography Tour',
      description: 'Exclusive private photography adventure with high quality base64 imagery.',
      status: 'published',
      days: 3,
      nights: 2,
      startingPriceIDR: 4200000,
      image: mockPhotoBase64,
      gallery: mockGallery,
      highlights: ['Bromo Milky Way Stargazing', 'Sunrise Penanjakan 1', 'Madakaripura Canyon'],
      itinerary: [
        'Day 1: Malang / Surabaya pickup -> Bromo Lodge',
        'Day 2: 03:00 Jeep Sunrise Tour -> Whispering Sands -> Savanna',
        'Day 3: Madakaripura Waterfall -> Drop off Malang/Surabaya'
      ]
    };

    const createRes = await requestJson('POST', '/api/main-tours', realisticTourPayload, {
      'Authorization': `Bearer ${realAdminToken}`
    });

    assert(createRes.status === 201, `POST /api/main-tours returns HTTP 201 Created (got ${createRes.status})`);
    assert(createRes.body && createRes.body.id === testTourId, 'Response contains correct tour id');
    assert(createRes.body && createRes.body.name === realisticTourPayload.name, 'Response contains tour name');
    assert(createRes.body && Array.isArray(createRes.body.gallery) && createRes.body.gallery.length === 3, 'Response contains 3 gallery images');

    // ----------------------------------------------------
    // STEP 3: PHYSICAL PERSISTENCE VERIFICATION
    // ----------------------------------------------------
    console.log('\n--- STEP 3: Verify Physical Persistence on data/db.json ---');
    const diskDBAfterCreate = readDiskDB();
    const diskTour = (diskDBAfterCreate.mainTours || []).find((t) => t && t.id === testTourId);

    assert(Boolean(diskTour), 'New tour exists physically on disk in data/db.json');
    assert(diskTour && diskTour.name === realisticTourPayload.name, 'Tour name matches payload on disk');
    assert(diskTour && diskTour.startingPriceIDR === 4200000, 'Tour startingPriceIDR matches on disk');
    assert(diskTour && diskTour.image && diskTour.image.startsWith('data:image/jpeg;base64,'), 'Tour primary image base64 preserved on disk');
    assert(diskTour && Array.isArray(diskTour.gallery) && diskTour.gallery.length === 3, 'Tour gallery array preserved on disk');

    // ----------------------------------------------------
    // STEP 4: UPDATE PRIVATE TOUR (PUT /api/main-tours/:id)
    // ----------------------------------------------------
    console.log('\n--- STEP 4: Update Private Tour via PUT /api/main-tours/:id ---');
    const updatedGallery = [
      ...mockGallery,
      'data:image/jpeg;base64,' + 'E'.repeat(600 * 1024) // additional photo
    ];
    const updatePayload = {
      name: 'Bromo & Madakaripura High-Res Photography Tour (Updated)',
      startingPriceIDR: 4500000,
      gallery: updatedGallery
    };

    const updateRes = await requestJson('PUT', `/api/main-tours/${testTourId}`, updatePayload, {
      'Authorization': `Bearer ${realAdminToken}`
    });

    assert(updateRes.status === 200, `PUT /api/main-tours/:id returns HTTP 200 OK (got ${updateRes.status})`);
    assert(updateRes.body && updateRes.body.name === updatePayload.name, 'Update response contains updated name');
    assert(updateRes.body && updateRes.body.startingPriceIDR === 4500000, 'Update response contains updated price');

    const diskDBAfterUpdate = readDiskDB();
    const diskTourUpdated = (diskDBAfterUpdate.mainTours || []).find((t) => t && t.id === testTourId);
    assert(Boolean(diskTourUpdated), 'Updated tour physically found on disk');
    assert(diskTourUpdated && diskTourUpdated.name === updatePayload.name, 'Updated tour name physically persisted');
    assert(diskTourUpdated && diskTourUpdated.startingPriceIDR === 4500000, 'Updated tour price physically persisted');
    assert(diskTourUpdated && diskTourUpdated.gallery.length === 4, 'Updated tour gallery count (4) physically persisted');

    // ----------------------------------------------------
    // STEP 5: LARGE VALID PAYLOAD (APPROX 14MB)
    // ----------------------------------------------------
    console.log('\n--- STEP 5: Large Valid Payload Test (~14MB within 20MB limit) ---');
    // 14MB base64 string (which exceeded previous 10MB limit and caused PayloadTooLargeError)
    const largeBase64 = 'data:image/jpeg;base64,' + 'X'.repeat(14 * 1024 * 1024);
    const largeTourPayload = {
      id: largeTourId,
      name: 'High Capacity 14MB Tour Package',
      description: 'Tour package with large gallery within 20MB limit.',
      status: 'published',
      startingPriceIDR: 5000000,
      image: largeBase64
    };

    const largeRes = await requestJson('POST', '/api/main-tours', largeTourPayload, {
      'Authorization': `Bearer ${realAdminToken}`
    });

    assert(largeRes.status === 201, `Large 14MB payload accepted with HTTP 201 (got ${largeRes.status})`);
    assert(largeRes.body && largeRes.body.id === largeTourId, 'Large tour created and returned without PayloadTooLargeError');

    const diskDBAfterLarge = readDiskDB();
    const largeTourOnDisk = (diskDBAfterLarge.mainTours || []).find((t) => t && t.id === largeTourId);
    assert(Boolean(largeTourOnDisk), 'Large tour physically persisted on disk in data/db.json');

    // ----------------------------------------------------
    // STEP 6: OVERSIZED PAYLOAD TEST (>20MB) -> HTTP 413
    // ----------------------------------------------------
    console.log('\n--- STEP 6: Oversized Payload Test (>20MB, ~22MB) -> Controlled HTTP 413 ---');
    // 22MB payload to verify body-parser limit triggers clean 413
    const oversizedBase64 = 'data:image/jpeg;base64,' + 'Z'.repeat(22 * 1024 * 1024);
    const oversizedTourPayload = {
      id: oversizedTourId,
      name: 'Oversized Tour Exceeding 20MB',
      startingPriceIDR: 6000000,
      image: oversizedBase64
    };

    const oversizedRes = await requestJson('POST', '/api/main-tours', oversizedTourPayload, {
      'Authorization': `Bearer ${realAdminToken}`
    });

    assert(oversizedRes.status === 413, `Oversized request is rejected with HTTP 413 Payload Too Large (got ${oversizedRes.status})`);
    assert(Boolean(oversizedRes.body && typeof oversizedRes.body.error === 'string'), 'Rejection response contains clear error string');
    assert(oversizedRes.body.code === 'PAYLOAD_TOO_LARGE', 'Rejection code is PAYLOAD_TOO_LARGE');
    assert(oversizedRes.body.error.includes('20MB'), 'Error message informs admin of 20MB limit');

    // ----------------------------------------------------
    // STEP 7: DB INTEGRITY ON 413 REJECTION
    // ----------------------------------------------------
    console.log('\n--- STEP 7: Verify Database Integrity (Oversized Tour NOT Written) ---');
    const diskDBAfterOversized = readDiskDB();
    const oversizedExists = (diskDBAfterOversized.mainTours || []).some((t) => t && t.id === oversizedTourId);
    assert(!oversizedExists, 'Oversized rejected payload was NOT written to data/db.json');

  } finally {
    // Clean up test tours
    try {
      const db = readDiskDB();
      db.mainTours = (db.mainTours || []).filter(
        (t) => t && t.id !== testTourId && t.id !== largeTourId && t.id !== oversizedTourId
      );
      if (realAdminToken) {
        db.adminSessions = (db.adminSessions || []).filter((s) => s && s.token !== realAdminToken);
      }
      fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
      console.log('\n[Cleanup] Test tours and temporary test sessions removed from data/db.json');
    } catch (e) {
      console.error('[Cleanup Error]', e);
    }
  }

  console.log('\n================================================================');
  console.log(`TOTAL PAYLOAD CHECKS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPayloadSuite().catch((err) => {
  console.error('Fatal error in payload test suite:', err);
  process.exit(1);
});
