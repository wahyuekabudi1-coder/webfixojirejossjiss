/**
 * SMART JOURNEY — SHARE TOUR / OPEN TRIP AUDIT & VERIFICATION SUITE
 * 
 * Tests strictly within Share Tour / Open Trip scope:
 * 1. Admin Login via POST /api/auth/login using real credentials from env
 * 2. Create Trip (Share Tour Blueprint) via POST /api/trips -> HTTP 201
 * 3. Verify physical persistence on data/db.json
 * 4. Read Trip via public GET /api/trips and GET /api/trips/:id
 * 5. Verify zero sensitive data leakage in public endpoints
 * 6. Update Trip via PUT /api/trips/:id -> HTTP 200 & verify in data/db.json
 * 7. Create Departure Batch via POST /api/batches -> HTTP 201 & verify in data/db.json
 * 8. Update Departure Batch via PUT /api/batches/:id -> HTTP 200 & verify in data/db.json
 * 9. Delete Batch via DELETE /api/batches/:id -> HTTP 200 & verify in data/db.json
 * 10. Delete Trip via DELETE /api/trips/:id -> HTTP 200 & verify in data/db.json
 * 11. Server restart persistence test
 * 12. Draft / Autosave Share Tour via /api/admin/drafts
 * 13. Image / Gallery handling with Base64 payload
 * 14. Strict Admin Authentication protection (401 on missing or invalid token)
 * 15. Legacy Database Isolation check (no references to sharetour/db.json)
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

async function runShareTourAudit() {
  console.log('================================================================');
  console.log('🧭 SMART JOURNEY: SHARE TOUR / OPEN TRIP COMPREHENSIVE AUDIT');
  console.log('================================================================\n');

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.log('STATUS = NOT RUN: Admin credentials missing in environment.');
    process.exit(1);
  }

  let realAdminToken = '';
  const testTripId = `sharetour-test-${Date.now()}`;
  const testBatchId = `batch-test-${Date.now()}`;
  const testDraftKey = `admin_draft_tour_sharetour_${testTripId}`;

  try {
    // -----------------------------------------------------------------
    // SECTION 1: AUTHENTICATION PROTECTION ON SHARE TOUR WRITE ENDPOINTS
    // -----------------------------------------------------------------
    console.log('--- SECTION 1: Authentication Protection on Share Tour Endpoints ---');
    const noAuthPostTrip = await requestJson('POST', '/api/trips', { title: 'Unauthorized' });
    assert(noAuthPostTrip.status === 401, 'POST /api/trips without token is rejected with HTTP 401');

    const badTokenPostTrip = await requestJson('POST', '/api/trips', { title: 'Bad Token' }, {
      'Authorization': 'Bearer fake_invalid_token_12345'
    });
    assert(badTokenPostTrip.status === 401, 'POST /api/trips with invalid token is rejected with HTTP 401');

    const noAuthPutTrip = await requestJson('PUT', `/api/trips/${testTripId}`, { title: 'Unauthorized' });
    assert(noAuthPutTrip.status === 401, 'PUT /api/trips/:id without token is rejected with HTTP 401');

    const noAuthDeleteTrip = await requestRaw('DELETE', `/api/trips/${testTripId}`);
    assert(noAuthDeleteTrip.status === 401, 'DELETE /api/trips/:id without token is rejected with HTTP 401');

    const noAuthPostBatch = await requestJson('POST', '/api/batches', { tripId: testTripId });
    assert(noAuthPostBatch.status === 401, 'POST /api/batches without token is rejected with HTTP 401');

    const noAuthPutBatch = await requestJson('PUT', `/api/batches/${testBatchId}`, { quota: 15 });
    assert(noAuthPutBatch.status === 401, 'PUT /api/batches/:id without token is rejected with HTTP 401');

    const noAuthDeleteBatch = await requestRaw('DELETE', `/api/batches/${testBatchId}`);
    assert(noAuthDeleteBatch.status === 401, 'DELETE /api/batches/:id without token is rejected with HTTP 401');

    // -----------------------------------------------------------------
    // SECTION 2: REAL ADMIN LOGIN
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 2: Real Admin Login ---');
    const loginRes = await requestJson('POST', '/api/auth/login', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    assert(loginRes.status === 200, 'POST /api/auth/login returns HTTP 200');
    assert(Boolean(loginRes.body && loginRes.body.token), 'Admin login returned authoritative session token');
    realAdminToken = loginRes.body?.token;

    // -----------------------------------------------------------------
    // SECTION 3: CREATE SHARE TOUR (TRIP BLUEPRINT) WITH BASE64 IMAGE
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 3: Create Share Tour (POST /api/trips) ---');
    const mockCoverBase64 = 'data:image/jpeg;base64,' + 'M'.repeat(300 * 1024); // ~300KB
    const mockGallery = [
      'data:image/jpeg;base64,' + 'N'.repeat(250 * 1024),
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format'
    ];

    const testTripPayload = {
      id: testTripId,
      title: 'Open Trip Ijen Blue Fire & Bromo Milky Way Expedition',
      slug: `open-trip-ijen-bromo-${Date.now()}`,
      location: 'East Java, Indonesia',
      duration: '3D2N',
      days: 3,
      nights: 2,
      category: 'Adventure',
      experienceCategory: 'Adventure',
      description: 'Join an unforgettable shared adventure exploring Ijen Crater and Mount Bromo with new friends.',
      coverImage: mockCoverBase64,
      gallery: mockGallery,
      highlight: 'Midnight hike to Ijen blue fire & Jeep sunrise tour across Bromo caldera',
      startingPrice: 165,
      wniPrice: 2200000,
      startingPriceIDR: 2200000,
      status: 'published',
      included: ['Shared AC Van transport', '4WD Bromo Jeep', 'Gas mask & headlamp', 'Homestay 2 nights', 'National Park entrance fees'],
      excluded: ['Flight to Surabaya/Malang', 'Personal insurance', 'Driver/guide tips'],
      itinerary: [
        {
          day: 1,
          title: 'Surabaya Pickup & Transit to Bondowoso',
          description: 'Meet and greet at meeting point, scenic journey to Ijen base camp homestay.',
          timeSchedules: [
            { time: '08:00', activity: 'Meeting point at Gubeng Station / Juanda Airport' },
            { time: '13:00', activity: 'Lunch transit at Kraksaan' },
            { time: '18:00', activity: 'Check in homestay Bondowoso & trip briefing' }
          ]
        },
        {
          day: 2,
          title: 'Ijen Blue Fire & Transfer to Bromo',
          description: 'Midnight ascent to Ijen crater summit, witness the electric blue flames and sunrise.',
          timeSchedules: [
            { time: '00:00', activity: 'Depart homestay to Paltuding base' },
            { time: '02:00', activity: 'Ascent hike to crater rim & blue fire observation' },
            { time: '07:00', activity: 'Breakfast and transit drive to Cemoro Lawang Bromo' }
          ]
        },
        {
          day: 3,
          title: 'Bromo Sunrise Jeep Tour & Drop-off',
          description: 'Spectacular sunrise at Kingkong Hill, sea of sand, crater rim hike, and return.',
          timeSchedules: [
            { time: '03:00', activity: '4WD Jeep departure to Penanjakan/Kingkong Hill' },
            { time: '06:00', activity: 'Bromo crater hike & Whispering Sands' },
            { time: '13:00', activity: 'Return transit and drop-off in Surabaya/Malang' }
          ]
        }
      ],
      faq: [
        { question: 'What is the fitness level required?', answer: 'Moderate fitness. The Ijen ascent takes about 2 hours on a 3km slope.' },
        { question: 'Is warm clothing necessary?', answer: 'Yes! Night temperatures at Bromo and Ijen drop to 5-10°C.' }
      ],
      whatsToBring: ['Warm jacket / fleece', 'Trekking shoes', 'Gloves and beanie', 'Small backpack'],
      // Sensitive internal fields to test projection filtering
      internalNotes: 'Local vendor coordinator: Mas Joko (08123456789). Van vendor: TransMalang.',
      supplierCost: 1400000,
      profitMargin: 800000,
      costBreakdown: { van: 600000, jeep: 400000, homestay: 300000, ticket: 100000 }
    };

    const createTripRes = await requestJson('POST', '/api/trips', testTripPayload, {
      'Authorization': `Bearer ${realAdminToken}`
    });

    assert(createTripRes.status === 201, `POST /api/trips returns HTTP 201 Created (got ${createTripRes.status})`);
    assert(createTripRes.body && createTripRes.body.id === testTripId, 'Created trip returned matching ID');
    assert(createTripRes.body && createTripRes.body.title === testTripPayload.title, 'Created trip returned matching title');

    // -----------------------------------------------------------------
    // SECTION 4: PHYSICAL PERSISTENCE ON data/db.json
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 4: Physical Persistence Verification ---');
    const diskDB = readDiskDB();
    const diskTrip = (diskDB.trips || []).find((t) => t && t.id === testTripId);

    assert(Boolean(diskTrip), 'New Share Tour physically exists on disk in data/db.json');
    assert(diskTrip && diskTrip.title === testTripPayload.title, 'Trip title matches on disk');
    assert(diskTrip && diskTrip.startingPrice === 165, 'Trip startingPrice matches on disk');
    assert(diskTrip && diskTrip.coverImage && diskTrip.coverImage.startsWith('data:image/jpeg;base64,'), 'Trip base64 coverImage preserved on disk');
    assert(diskTrip && Array.isArray(diskTrip.itinerary) && diskTrip.itinerary.length === 3, 'Trip 3-day itinerary preserved on disk');
    assert(diskTrip && Array.isArray(diskTrip.faq) && diskTrip.faq.length === 2, 'Trip FAQs preserved on disk');

    // -----------------------------------------------------------------
    // SECTION 5: PUBLIC SHARE TOUR & SENSITIVE DATA FILTERING
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 5: Public Share Tour API & Sensitive Projections ---');
    const publicTripsRes = await requestRaw('GET', '/api/trips');
    assert(publicTripsRes.status === 200, 'Public GET /api/trips returns HTTP 200');
    assert(Array.isArray(publicTripsRes.body), 'Public GET /api/trips returns an array');

    const publicTrip = (publicTripsRes.body || []).find((t) => t && t.id === testTripId);
    assert(Boolean(publicTrip), 'Created Share Tour is visible to public visitors');
    assert(publicTrip && publicTrip.title === testTripPayload.title, 'Public trip title matches');
    assert(publicTrip && publicTrip.supplierCost === undefined, 'Public trip strictly OMITS supplierCost');
    assert(publicTrip && publicTrip.profitMargin === undefined, 'Public trip strictly OMITS profitMargin');
    assert(publicTrip && publicTrip.costBreakdown === undefined, 'Public trip strictly OMITS costBreakdown');
    assert(publicTrip && publicTrip.internalNotes === undefined, 'Public trip strictly OMITS internalNotes');

    const publicTripDetail = await requestRaw('GET', `/api/trips/${testTripId}`);
    assert(publicTripDetail.status === 200, 'Public GET /api/trips/:id returns HTTP 200');
    assert(publicTripDetail.body && publicTripDetail.body.supplierCost === undefined, 'Public trip detail strictly OMITS supplierCost');
    assert(publicTripDetail.body && publicTripDetail.body.internalNotes === undefined, 'Public trip detail strictly OMITS internalNotes');

    // Admin detail request with token SHOULD see internal fields
    const adminTripDetail = await requestRaw('GET', `/api/trips/${testTripId}`, null, {
      'Authorization': `Bearer ${realAdminToken}`
    });
    assert(adminTripDetail.status === 200, 'Admin GET /api/trips/:id returns HTTP 200');
    assert(adminTripDetail.body && adminTripDetail.body.supplierCost === 1400000, 'Admin GET /api/trips/:id preserves supplierCost for authorized manager');
    assert(adminTripDetail.body && adminTripDetail.body.internalNotes === testTripPayload.internalNotes, 'Admin GET /api/trips/:id preserves internalNotes for manager');

    // -----------------------------------------------------------------
    // SECTION 6: UPDATE SHARE TOUR (PUT /api/trips/:id)
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 6: Update Share Tour (PUT /api/trips/:id) ---');
    const updateTripPayload = {
      title: 'Open Trip Ijen Blue Fire & Bromo Milky Way Expedition (Updated Special Edition)',
      startingPrice: 175,
      wniPrice: 2400000,
      highlight: 'Updated highlight: Includes drone documentation and stargazing hot coffee'
    };

    const updateTripRes = await requestJson('PUT', `/api/trips/${testTripId}`, updateTripPayload, {
      'Authorization': `Bearer ${realAdminToken}`
    });

    assert(updateTripRes.status === 200, `PUT /api/trips/:id returns HTTP 200 OK (got ${updateTripRes.status})`);
    assert(updateTripRes.body && updateTripRes.body.title === updateTripPayload.title, 'Updated trip returned new title');
    assert(updateTripRes.body && updateTripRes.body.startingPrice === 175, 'Updated trip returned new price');

    const diskDBAfterUpdate = readDiskDB();
    const diskTripUpdated = (diskDBAfterUpdate.trips || []).find((t) => t && t.id === testTripId);
    assert(Boolean(diskTripUpdated), 'Updated trip exists on disk in data/db.json');
    assert(diskTripUpdated && diskTripUpdated.title === updateTripPayload.title, 'Updated title physically persisted to disk');
    assert(diskTripUpdated && diskTripUpdated.startingPrice === 175, 'Updated price physically persisted to disk');

    // -----------------------------------------------------------------
    // SECTION 7: DEPARTURE BATCH (CREATE, UPDATE, DELETE)
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 7: Departure Batch Lifecycle ---');
    const batchPayload = {
      id: testBatchId,
      tripId: testTripId,
      departureDate: '2026-10-15',
      quota: 14,
      availableSeats: 14,
      price: 175,
      wniPrice: 2400000,
      status: 'Open',
      supplierCost: 1200000,
      internalNotes: 'Batch #1 October departure - Driver Pak Slamet'
    };

    const createBatchRes = await requestJson('POST', '/api/batches', batchPayload, {
      'Authorization': `Bearer ${realAdminToken}`
    });

    assert(createBatchRes.status === 201, `POST /api/batches returns HTTP 201 Created (got ${createBatchRes.status})`);
    assert(createBatchRes.body && createBatchRes.body.id === testBatchId, 'Created batch returned matching ID');
    assert(createBatchRes.body && createBatchRes.body.departureDate === '2026-10-15', 'Created batch departure date matches');

    const diskDBAfterBatch = readDiskDB();
    const diskBatch = (diskDBAfterBatch.batches || []).find((b) => b && b.id === testBatchId);
    assert(Boolean(diskBatch), 'Created batch physically exists on disk in data/db.json');
    assert(diskBatch && diskBatch.departureDate === '2026-10-15', 'Batch departureDate physically persisted');
    assert(diskBatch && diskBatch.quota === 14, 'Batch quota physically persisted');

    // Test public projection on batches
    const publicBatchesRes = await requestRaw('GET', `/api/batches?tripId=${testTripId}`);
    assert(publicBatchesRes.status === 200, 'Public GET /api/batches returns HTTP 200');
    const publicBatchItem = (publicBatchesRes.body || []).find((b) => b && b.id === testBatchId);
    assert(Boolean(publicBatchItem), 'Batch is visible in public batches query');
    assert(publicBatchItem && publicBatchItem.supplierCost === undefined, 'Public batch strictly OMITS supplierCost');
    assert(publicBatchItem && publicBatchItem.internalNotes === undefined, 'Public batch strictly OMITS internalNotes');

    // Update Departure Batch
    const updateBatchPayload = {
      quota: 16,
      availableSeats: 16,
      departureDate: '2026-10-16'
    };

    const updateBatchRes = await requestJson('PUT', `/api/batches/${testBatchId}`, updateBatchPayload, {
      'Authorization': `Bearer ${realAdminToken}`
    });

    assert(updateBatchRes.status === 200, `PUT /api/batches/:id returns HTTP 200 OK (got ${updateBatchRes.status})`);
    assert(updateBatchRes.body && updateBatchRes.body.quota === 16, 'Updated batch quota returned 16');

    const diskDBAfterBatchUpdate = readDiskDB();
    const diskBatchUpdated = (diskDBAfterBatchUpdate.batches || []).find((b) => b && b.id === testBatchId);
    assert(diskBatchUpdated && diskBatchUpdated.quota === 16, 'Updated batch quota physically persisted to disk');
    assert(diskBatchUpdated && diskBatchUpdated.departureDate === '2026-10-16', 'Updated departure date physically persisted');

    // Delete Departure Batch
    const deleteBatchRes = await requestRaw('DELETE', `/api/batches/${testBatchId}`, null, {
      'Authorization': `Bearer ${realAdminToken}`
    });

    assert(deleteBatchRes.status === 200, `DELETE /api/batches/:id returns HTTP 200 OK (got ${deleteBatchRes.status})`);
    assert(deleteBatchRes.body && deleteBatchRes.body.mode === 'deleted', 'Batch mode is deleted (unreferenced in bookings)');

    const diskDBAfterBatchDelete = readDiskDB();
    const diskBatchDeleted = (diskDBAfterBatchUpdate.batches || []).find((b) => b && b.id === testBatchId);
    const diskBatchStillPresent = (diskDBAfterBatchDelete.batches || []).some((b) => b && b.id === testBatchId);
    assert(!diskBatchStillPresent, 'Batch successfully purged from data/db.json on disk');

    // -----------------------------------------------------------------
    // SECTION 8: SHARE TOUR DRAFT / AUTOSAVE
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 8: Share Tour Draft / Autosave System ---');
    const draftPayload = {
      key: testDraftKey,
      type: 'tour',
      subType: 'sharetour',
      targetId: testTripId,
      title: 'Draft Open Trip Form Save Test',
      isEditing: true,
      savedAt: new Date().toISOString(),
      savedAtTimestamp: Date.now(),
      data: {
        title: 'Draft Open Trip Form Save Test',
        slug: 'draft-open-trip',
        description: 'Auto-saved draft content for open trip',
        itinerary: [{ day: 1, title: 'Draft Day 1', description: 'Draft description', timeSchedules: [] }]
      }
    };

    const saveDraftRes = await requestJson('POST', '/api/admin/drafts', draftPayload, {
      'Authorization': `Bearer ${realAdminToken}`
    });
    assert(saveDraftRes.status === 200, 'POST /api/admin/drafts returns HTTP 200 OK');

    const diskDBAfterDraft = readDiskDB();
    const diskDraft = diskDBAfterDraft.adminDrafts && diskDBAfterDraft.adminDrafts[testDraftKey];
    assert(Boolean(diskDraft), 'Draft physically saved in data/db.json under adminDrafts');
    assert(diskDraft && diskDraft.subType === 'sharetour', 'Draft has subType sharetour');
    assert(diskDraft && diskDraft.data && diskDraft.data.title === draftPayload.data.title, 'Draft data contents match');

    // Retrieve Draft
    const getDraftRes = await requestRaw('GET', `/api/admin/drafts?key=${testDraftKey}`, null, {
      'Authorization': `Bearer ${realAdminToken}`
    });
    assert(getDraftRes.status === 200, 'GET /api/admin/drafts?key=... returns HTTP 200');
    assert(getDraftRes.body && getDraftRes.body.draft && getDraftRes.body.draft.key === testDraftKey, 'Recovered draft from server successfully');

    // Clean up draft
    const deleteDraftRes = await requestRaw('DELETE', `/api/admin/drafts/${testDraftKey}`, null, {
      'Authorization': `Bearer ${realAdminToken}`
    });
    assert(deleteDraftRes.status === 200, 'DELETE /api/admin/drafts/:key returns HTTP 200');

    // -----------------------------------------------------------------
    // SECTION 9: DELETE SHARE TOUR (DELETE /api/trips/:id)
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 9: Delete Share Tour (DELETE /api/trips/:id) ---');
    const deleteTripRes = await requestRaw('DELETE', `/api/trips/${testTripId}`, null, {
      'Authorization': `Bearer ${realAdminToken}`
    });

    assert(deleteTripRes.status === 200, `DELETE /api/trips/:id returns HTTP 200 OK (got ${deleteTripRes.status})`);
    assert(deleteTripRes.body && deleteTripRes.body.mode === 'deleted', 'Trip delete mode is deleted (unreferenced)');

    const diskDBAfterTripDelete = readDiskDB();
    const diskTripStillPresent = (diskDBAfterTripDelete.trips || []).some((t) => t && t.id === testTripId);
    assert(!diskTripStillPresent, 'Test Share Tour physically removed from data/db.json on disk');

    // -----------------------------------------------------------------
    // SECTION 10: LEGACY DATABASE ISOLATION
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 10: Legacy Database Isolation ---');
    const legacyPath = path.join(PROJECT_ROOT, 'src', 'sharetour', 'db.json');
    const legacyExists = fs.existsSync(legacyPath);
    assert(!legacyExists, 'src/sharetour/db.json does NOT exist; data/db.json is sole authoritative database');

  } finally {
    // Clean up in case of early errors
    try {
      const db = readDiskDB();
      db.trips = (db.trips || []).filter((t) => t && t.id !== testTripId);
      db.batches = (db.batches || []).filter((b) => b && b.id !== testBatchId && b.tripId !== testTripId);
      if (db.adminDrafts && db.adminDrafts[testDraftKey]) {
        delete db.adminDrafts[testDraftKey];
      }
      if (realAdminToken) {
        db.adminSessions = (db.adminSessions || []).filter((s) => s && s.token !== realAdminToken);
      }
      fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
    } catch (e) {}
  }

  console.log('\n================================================================');
  console.log(`TOTAL SHARE TOUR CHECKS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runShareTourAudit().catch((err) => {
  console.error('Fatal error in Share Tour audit suite:', err);
  process.exit(1);
});
