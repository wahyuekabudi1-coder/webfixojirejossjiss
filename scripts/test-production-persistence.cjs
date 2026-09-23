const http = require('http');
const fs = require('fs');
const path = require('path');

try { require('dotenv').config(); } catch (_) {}

const PORT = 3000;
const DB_PATH = path.join(process.cwd(), 'data', 'db.json');

const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || '').trim();
if (!ADMIN_PASSWORD) {
  console.error('\n❌ ERROR: Required test environment variable ADMIN_PASSWORD is not configured. Test cannot run safely.\n');
  process.exit(1);
}
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim();
if (!ADMIN_EMAIL) {
  console.error('\n❌ ERROR: Required test environment variable ADMIN_EMAIL is not configured. Test cannot run safely.\n');
  process.exit(1);
}

function request(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(body);
        } catch (_) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json,
          rawBody: body
        });
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run10PointTestSuite() {
  console.log('===========================================================');
  console.log('STARTING SMART JOURNEY 10-POINT PRODUCTION TEST SUITE');
  console.log('Authoritative DB Target: ' + DB_PATH);
  console.log('===========================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, detail = '') {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      if (detail) console.log(`       -> ${detail}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      if (detail) console.error(`       -> ${detail}`);
      failed++;
    }
  }

  // Wait for server ready
  let ready = false;
  for (let i = 0; i < 15; i++) {
    try {
      const res = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/health',
        method: 'GET'
      });
      if (res.status === 200) {
        ready = true;
        break;
      }
    } catch (_) {}
    await sleep(1000);
  }

  if (!ready) {
    console.error('Server did not become ready in time.');
    process.exit(1);
  }

  // --- Step 0: Admin Login using Environment Credentials ---
  console.log('\n--- AUTHENTICATION ---');
  const loginRes = await request(
    {
      hostname: 'localhost',
      port: PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    },
    {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    }
  );

  assert(loginRes.status === 200 && !!loginRes.body?.token, 'Admin Login with Configured Env Credentials', `Token acquired: ${loginRes.body?.token?.substring(0, 10)}...`);
  const adminToken = loginRes.body?.token;

  // --- TEST 1: DRAFT PERSISTENCE ---
  console.log('\n--- TEST 1: DRAFT PERSISTENCE ---');
  const testDraftKey = `test_draft_${Date.now()}`;
  const draftData = {
    key: testDraftKey,
    tourName: 'Bromo Sunrise Exclusive Test',
    destination: 'Mount Bromo',
    price: 1250000,
    itinerary: ['02:00 Hotel Pickup', '04:00 King Kong Hill Sunrise', '07:00 Crater Walk']
  };

  const draftRes = await request(
    {
      hostname: 'localhost',
      port: PORT,
      path: '/api/admin/drafts',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      }
    },
    draftData
  );

  assert(draftRes.status === 200 && draftRes.body?.success, 'POST /api/admin/drafts succeeds');

  // Verify directly in data/db.json on disk
  const dbDiskRaw = fs.readFileSync(DB_PATH, 'utf8');
  const dbDisk = JSON.parse(dbDiskRaw);
  const diskDraft = dbDisk.adminDrafts?.[testDraftKey];

  assert(
    !!diskDraft && diskDraft.tourName === 'Bromo Sunrise Exclusive Test',
    'Draft physically persisted in data/db.json (single source of truth)',
    `Draft on disk: ${diskDraft?.tourName}`
  );

  // --- TEST 2: ADMIN LOGOUT / RELOAD DRAFT ---
  console.log('\n--- TEST 2: ADMIN RELOAD DRAFT ---');
  const getDraftRes = await request({
    hostname: 'localhost',
    port: PORT,
    path: `/api/admin/drafts?key=${testDraftKey}`,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${adminToken}`
    }
  });

  assert(
    getDraftRes.status === 200 && getDraftRes.body?.draft?.tourName === 'Bromo Sunrise Exclusive Test',
    'Draft reloaded accurately from authoritative backend',
    `Fetched draft key: ${getDraftRes.body?.draft?.key}`
  );

  // --- TEST 3: PUBLISH TOUR ---
  console.log('\n--- TEST 3: PUBLISH TOUR ---');
  const testTourId = `tour-prod-${Date.now()}`;
  const newTourData = {
    id: testTourId,
    name: 'Bromo & Ijen Midnight Expedition',
    slug: 'bromo-ijen-midnight-expedition',
    status: 'published',
    category: 'Private Tour',
    duration: '3D2N',
    price: 2500000,
    description: 'Exclusive 3D2N overland tour from Malang to Bromo and Ijen Crater with Blue Fire experience.',
    destination: 'East Java',
    included: ['Transport', 'Jeep 4x4', 'Hotel', 'Entrance Tickets', 'Tour Guide'],
    excluded: ['Personal Expenses', 'Tips']
  };

  const publishRes = await request(
    {
      hostname: 'localhost',
      port: PORT,
      path: '/api/main-tours',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      }
    },
    newTourData
  );

  assert(publishRes.status === 201 && publishRes.body?.id === testTourId, 'POST /api/main-tours creates published tour');

  // Verify on physical disk in data/db.json
  const dbDiskAfterPublish = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  const foundInDisk = (dbDiskAfterPublish.mainTours || []).find((t) => t.id === testTourId);

  assert(
    !!foundInDisk && foundInDisk.name === 'Bromo & Ijen Midnight Expedition' && foundInDisk.status === 'published',
    'Published tour physically persisted in data/db.json',
    `Found in data/db.json: ${foundInDisk?.name} (${foundInDisk?.id})`
  );

  // --- TEST 4: PUBLIC VISIBILITY ---
  console.log('\n--- TEST 4: PUBLIC VISIBILITY ---');
  // Request WITHOUT any auth headers
  const publicToursRes = await request({
    hostname: 'localhost',
    port: PORT,
    path: '/api/main-tours',
    method: 'GET'
  });

  const isPubliclyVisible = Array.isArray(publicToursRes.body) && publicToursRes.body.some((t) => t.id === testTourId);
  assert(
    publicToursRes.status === 200 && isPubliclyVisible,
    'Public GET /api/main-tours shows newly published tour without authentication',
    `Total public tours returned: ${publicToursRes.body?.length}`
  );

  // --- TEST 5: SERVER RESTART PERSISTENCE ---
  console.log('\n--- TEST 5: PERSISTENCE VERIFICATION IN DATA/DB.JSON ---');
  // Check disk directly
  const dbDiskVerify = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  const tourStillOnDisk = (dbDiskVerify.mainTours || []).find((t) => t.id === testTourId);
  const sessionStillOnDisk = (dbDiskVerify.adminSessions || []).some((s) => s.token === adminToken);

  assert(
    !!tourStillOnDisk && !!sessionStillOnDisk,
    'Tours and admin sessions survive in data/db.json across lifecycle',
    `Tour on disk: ${!!tourStillOnDisk}, Session on disk: ${!!sessionStillOnDisk}`
  );

  // --- TEST 6: PUBLIC DETAIL ACCESS ---
  console.log('\n--- TEST 6: PUBLIC DETAIL ACCESS ---');
  const publicDetailRes = await request({
    hostname: 'localhost',
    port: PORT,
    path: `/api/main-tours/${testTourId}`,
    method: 'GET'
  });

  assert(
    publicDetailRes.status === 200 && publicDetailRes.body?.name === 'Bromo & Ijen Midnight Expedition',
    'Public GET /api/main-tours/:id returns tour details without authentication',
    `Detail: ${publicDetailRes.body?.name}`
  );

  // --- TEST 7: CUSTOMER BOOKING REAL ---
  console.log('\n--- TEST 7: CUSTOMER BOOKING REAL ---');
  const bookingPayload = {
    tripId: testTourId,
    customerName: 'Budi Santoso',
    customerEmail: 'budi.santoso@example.com',
    customerPhone: '081234567890',
    participantsCount: 2,
    totalPrice: 5000000,
    startDate: '2026-10-15',
    notes: 'Please provide vegetarian meals.',
    serviceType: 'main_tour',
    details: {
      tourId: testTourId,
      tourName: 'Bromo & Ijen Midnight Expedition',
      guests: 2
    }
  };

  const bookingRes = await request(
    {
      hostname: 'localhost',
      port: PORT,
      path: '/api/bookings',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    },
    bookingPayload
  );

  const createdBooking = bookingRes.body?.booking || bookingRes.body;
  const bookingId = createdBooking?.id;
  const bookingCode = createdBooking?.bookingCode;

  assert(
    (bookingRes.status === 201 || bookingRes.status === 200) && !!bookingId,
    'Customer booking created via POST /api/bookings',
    `Booking ID: ${bookingId}, Code: ${bookingCode}`
  );

  // Verify booking on disk in data/db.json
  const dbDiskWithBooking = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  const foundBookingOnDisk = (dbDiskWithBooking.bookings || []).find((b) => b.id === bookingId);

  assert(
    !!foundBookingOnDisk && foundBookingOnDisk.customerName === 'Budi Santoso',
    'Customer booking persisted in data/db.json',
    `Booking customer: ${foundBookingOnDisk?.customerName}`
  );

  // --- TEST 8: ADMIN VERIFICATION & STATUS UPDATE ---
  console.log('\n--- TEST 8: ADMIN VERIFICATION & STATUS UPDATE ---');
  const updateStatusRes = await request(
    {
      hostname: 'localhost',
      port: PORT,
      path: `/api/bookings/${bookingId}/status`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      }
    },
    {
      status: 'Confirmed',
      paymentStatus: 'Paid',
      adminNotes: 'Payment verified via bank transfer.'
    }
  );

  assert(
    updateStatusRes.status === 200 && updateStatusRes.body?.status === 'Confirmed',
    'Admin updates booking status to Confirmed & Paid',
    `Booking status: ${updateStatusRes.body?.status}, Payment: ${updateStatusRes.body?.paymentStatus}`
  );

  // Verify status on disk in data/db.json
  const dbDiskAfterStatus = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  const updatedBookingOnDisk = (dbDiskAfterStatus.bookings || []).find((b) => b.id === bookingId);

  assert(
    updatedBookingOnDisk?.status === 'Confirmed' && updatedBookingOnDisk?.paymentStatus === 'Paid',
    'Booking status update persisted in data/db.json',
    `Status on disk: ${updatedBookingOnDisk?.status}`
  );

  // --- TEST 9: SOFT DELETE / ARCHIVE TEST ---
  console.log('\n--- TEST 9: SOFT DELETE / ARCHIVE TEST ---');
  // Attempt to delete tour with active booking
  const deleteTourRes = await request({
    hostname: 'localhost',
    port: PORT,
    path: `/api/main-tours/${testTourId}`,
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${adminToken}`
    }
  });

  assert(
    deleteTourRes.status === 200 && deleteTourRes.body?.mode === 'archived',
    'Tour with bookings is protected: SOFT DELETED (archived) instead of hard-deleted',
    `Mode: ${deleteTourRes.body?.mode}`
  );

  // Verify public endpoint does NOT show archived tour
  const publicToursAfterDelete = await request({
    hostname: 'localhost',
    port: PORT,
    path: '/api/main-tours',
    method: 'GET'
  });

  const isArchivedTourInPublic = (publicToursAfterDelete.body || []).some((t) => t.id === testTourId);
  assert(!isArchivedTourInPublic, 'Public GET /api/main-tours excludes archived/deleted tour');

  // Verify single detail public endpoint returns 404
  const publicDetailAfterDelete = await request({
    hostname: 'localhost',
    port: PORT,
    path: `/api/main-tours/${testTourId}`,
    method: 'GET'
  });

  assert(publicDetailAfterDelete.status === 404, 'Public GET /api/main-tours/:id returns 404 for archived tour');

  // --- TEST 10: INVOICE & BOOKING INTEGRITY ---
  console.log('\n--- TEST 10: INVOICE & BOOKING INTEGRITY ---');
  const dbDiskFinal = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  const finalBooking = (dbDiskFinal.bookings || []).find((b) => b.id === bookingId);

  assert(
    !!finalBooking && finalBooking.status === 'Confirmed' && finalBooking.tripId === testTourId,
    'Historical booking remains completely intact in data/db.json despite tour being archived',
    `Customer: ${finalBooking?.customerName}, BookingCode: ${finalBooking?.bookingCode}`
  );

  // Clean up test data from db.json safely
  console.log('\n--- CLEANING UP TEST ARTIFACTS ---');
  try {
    delete dbDiskFinal.adminDrafts[testDraftKey];
    dbDiskFinal.mainTours = dbDiskFinal.mainTours.filter((t) => t.id !== testTourId);
    dbDiskFinal.bookings = dbDiskFinal.bookings.filter((b) => b.id !== bookingId);
    fs.writeFileSync(DB_PATH, JSON.stringify(dbDiskFinal, null, 2), 'utf8');
    console.log('[Cleanup] Test artifacts cleaned up from data/db.json successfully.');
  } catch (err) {
    console.warn('Cleanup warning:', err);
  }

  console.log('\n===========================================================');
  console.log(`TEST SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('===========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run10PointTestSuite().catch((err) => {
  console.error('Fatal Test Suite Error:', err);
  process.exit(1);
});
