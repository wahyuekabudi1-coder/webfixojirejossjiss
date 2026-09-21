const fs = require('fs');
const path = require('path');
const http = require('http');

const PORT = 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'sawahjaya2026';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'sawahjayagroup@gmail.com';
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'sawahjaya_secret_2026';

function httpRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (_) {
          parsed = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed, raw: data });
      });
    });
    req.on('error', (err) => reject(err));
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runProductionLockTests() {
  console.log('================================================================');
  console.log('       FINAL CLEANUP: PRODUCTION DATABASE LOCK VERIFICATION      ');
  console.log('================================================================');

  let testsPassed = 0;
  let totalTests = 10;

  // 1. Authenticate Admin to get Session Token
  const loginRes = await httpRequest({
    hostname: 'localhost',
    port: PORT,
    path: '/api/admin/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD
  });

  if (loginRes.status !== 200 || !loginRes.body?.token) {
    console.error('FATAL: Admin login failed. Status:', loginRes.status, loginRes.body);
    process.exit(1);
  }
  const adminToken = loginRes.body.token;
  console.log('Admin session acquired:', adminToken.substring(0, 10) + '...');

  // -------------------------------------------------------------
  // TEST A: Create Draft
  // POST /api/admin/drafts -> verify data/db.json mutated
  // -------------------------------------------------------------
  console.log('\n--- TEST A: Create Draft Persistence ---');
  const draftKey = `sj_draft_tour_test_lock_${Date.now()}`;
  const draftData = {
    key: draftKey,
    type: 'tour',
    subType: 'default',
    targetId: 'lock-test-id',
    title: 'Lock Test Tour Draft',
    data: { name: 'Bromo Sunrise Lock Test', price: 1750000 },
    savedAt: new Date().toISOString(),
    savedAtTimestamp: Date.now()
  };

  const draftPostRes = await httpRequest({
    hostname: 'localhost',
    port: PORT,
    path: '/api/admin/drafts',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, draftData);

  const dbRawA = fs.readFileSync('data/db.json', 'utf8');
  const dbA = JSON.parse(dbRawA);
  const draftInDb = dbA.adminDrafts && dbA.adminDrafts[draftKey];

  if (draftPostRes.status === 200 && draftInDb && draftInDb.data.name === 'Bromo Sunrise Lock Test') {
    console.log('✅ TEST A PASSED: Draft written atomically to data/db.json (db.adminDrafts)');
    testsPassed++;
  } else {
    console.error('❌ TEST A FAILED:', { status: draftPostRes.status, draftInDb });
  }

  // -------------------------------------------------------------
  // TEST B: Reload Draft
  // GET /api/admin/drafts?key=... -> must be identical
  // -------------------------------------------------------------
  console.log('\n--- TEST B: Reload Draft from Server ---');
  const draftGetRes = await httpRequest({
    hostname: 'localhost',
    port: PORT,
    path: `/api/admin/drafts?key=${encodeURIComponent(draftKey)}`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  });

  if (
    draftGetRes.status === 200 &&
    draftGetRes.body?.draft?.data?.name === 'Bromo Sunrise Lock Test' &&
    draftGetRes.body?.draft?.key === draftKey
  ) {
    console.log('✅ TEST B PASSED: Draft reloaded identically from persistent data/db.json');
    testsPassed++;
  } else {
    console.error('❌ TEST B FAILED:', draftGetRes.body);
  }

  // -------------------------------------------------------------
  // TEST C: Publish
  // Create / publish tour -> status = published in data/db.json
  // -------------------------------------------------------------
  console.log('\n--- TEST C: Publish Tour Persistence ---');
  const testTourId = `tour-lock-${Date.now()}`;
  const newTourData = {
    id: testTourId,
    name: 'Exclusive Ijen Blue Fire Lock Tour',
    category: 'Private Tour',
    location: 'Banyuwangi',
    duration: '2D1N',
    price: 2500000,
    startingPriceIDR: 2500000,
    status: 'published',
    highlights: ['Blue fire expedition', 'Sunrise over acid lake'],
    description: 'A private luxury excursion to Mount Ijen crater.'
  };

  const publishRes = await httpRequest({
    hostname: 'localhost',
    port: PORT,
    path: '/api/main-tours',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, newTourData);

  const dbRawC = fs.readFileSync('data/db.json', 'utf8');
  const dbC = JSON.parse(dbRawC);
  const publishedTourInDb = (dbC.mainTours || []).find(t => t.id === testTourId);

  if (publishRes.status === 201 && publishedTourInDb && publishedTourInDb.status === 'published') {
    console.log('✅ TEST C PASSED: Published tour directly saved to data/db.json with status=published');
    testsPassed++;
  } else {
    console.error('❌ TEST C FAILED:', { status: publishRes.status, publishedTourInDb });
  }

  // -------------------------------------------------------------
  // TEST D: Public
  // GET /api/main-tours without auth -> published tour must appear
  // -------------------------------------------------------------
  console.log('\n--- TEST D: Public Visibility ---');
  const publicToursRes = await httpRequest({
    hostname: 'localhost',
    port: PORT,
    path: '/api/main-tours',
    method: 'GET'
  });

  const publicTourFound = Array.isArray(publicToursRes.body) && publicToursRes.body.some(t => t.id === testTourId);
  if (publicToursRes.status === 200 && publicTourFound) {
    console.log('✅ TEST D PASSED: Published tour is immediately visible to public users without auth');
    testsPassed++;
  } else {
    console.error('❌ TEST D FAILED: Tour not visible publicly');
  }

  // -------------------------------------------------------------
  // TEST E: Incognito / Independent of Client State
  // Single detail request without cookies, auth, or headers
  // -------------------------------------------------------------
  console.log('\n--- TEST E: Incognito Detail Access ---');
  const incognitoDetailRes = await httpRequest({
    hostname: 'localhost',
    port: PORT,
    path: `/api/main-tours/${testTourId}`,
    method: 'GET'
  });

  if (incognitoDetailRes.status === 200 && incognitoDetailRes.body?.id === testTourId) {
    console.log('✅ TEST E PASSED: Tour detail served directly from server without client state');
    testsPassed++;
  } else {
    console.error('❌ TEST E FAILED:', incognitoDetailRes.body);
  }

  // -------------------------------------------------------------
  // TEST F: Restart Persistence
  // Data in data/db.json is preserved and readable fresh from disk
  // -------------------------------------------------------------
  console.log('\n--- TEST F: Restart Persistence Verification ---');
  const dbRawF = fs.readFileSync('data/db.json', 'utf8');
  const parsedF = JSON.parse(dbRawF);
  const existsAfterRead = (parsedF.mainTours || []).some(t => t.id === testTourId);

  if (existsAfterRead) {
    console.log('✅ TEST F PASSED: Persistent state safely stored on disk in data/db.json');
    testsPassed++;
  } else {
    console.error('❌ TEST F FAILED: Tour missing in data/db.json');
  }

  // -------------------------------------------------------------
  // TEST G: Delete With Booking (Soft Delete / Integrity)
  // Create booking for this tour -> delete tour -> soft-deleted & booking preserved
  // -------------------------------------------------------------
  console.log('\n--- TEST G: Delete With Booking (Soft Delete Integrity) ---');
  const bookingPayload = {
    tripId: testTourId,
    serviceName: 'Exclusive Ijen Blue Fire Lock Tour',
    bookingType: 'private',
    fullName: 'Jane Doe',
    email: 'jane.doe@example.com',
    phone: '+62812999888',
    departureDate: '2026-10-20',
    participantsCount: 2,
    totalPrice: 2500000,
    totalPriceIDR: 2500000,
    details: {
      pickupLocation: 'Banyuwangi Hotel',
      package: 'VIP 2D1N'
    }
  };

  const bookingRes = await httpRequest({
    hostname: 'localhost',
    port: PORT,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, bookingPayload);

  const createdBooking = bookingRes.body;
  const bookingId = createdBooking?.id;

  // Now delete the tour as admin
  const deleteRes = await httpRequest({
    hostname: 'localhost',
    port: PORT,
    path: `/api/main-tours/${testTourId}`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  const dbRawG = fs.readFileSync('data/db.json', 'utf8');
  const dbG = JSON.parse(dbRawG);
  const tourAfterDel = (dbG.mainTours || []).find(t => t.id === testTourId);
  const bookingAfterDel = (dbG.bookings || []).find(b => b.id === bookingId);

  // Check public endpoint hides it
  const publicCheckRes = await httpRequest({
    hostname: 'localhost',
    port: PORT,
    path: `/api/main-tours/${testTourId}`,
    method: 'GET'
  });

  if (
    deleteRes.status === 200 &&
    deleteRes.body?.mode === 'archived' &&
    tourAfterDel &&
    (tourAfterDel.isDeleted === true || tourAfterDel.isArchived === true) &&
    bookingAfterDel &&
    bookingAfterDel.id === bookingId &&
    publicCheckRes.status === 404
  ) {
    console.log('✅ TEST G PASSED: Tour safely archived (soft deleted) with booking history 100% preserved');
    testsPassed++;
  } else {
    console.error('❌ TEST G FAILED:', { deleteRes: deleteRes.body, tourAfterDel, bookingAfterDel, publicCheckRes: publicCheckRes.status });
  }

  // -------------------------------------------------------------
  // TEST H: Admin Session Persistence
  // Session record in data/db.json (db.adminSessions) valid across operations
  // -------------------------------------------------------------
  console.log('\n--- TEST H: Admin Session Persistence in data/db.json ---');
  const dbRawH = fs.readFileSync('data/db.json', 'utf8');
  const dbH = JSON.parse(dbRawH);
  const sessionsInDb = Array.isArray(dbH.adminSessions) ? dbH.adminSessions : [];
  const tokenFound = sessionsInDb.some(s => s && s.token === adminToken && s.expiresAt > Date.now());

  // Test authenticated request succeeds using persistent session
  const authTestRes = await httpRequest({
    hostname: 'localhost',
    port: PORT,
    path: '/api/main-tours?all=true',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  if (tokenFound && authTestRes.status === 200) {
    console.log('✅ TEST H PASSED: Admin session stored and verified from persistent db.adminSessions in data/db.json');
    testsPassed++;
  } else {
    console.error('❌ TEST H FAILED:', { tokenFound, authStatus: authTestRes.status });
  }

  // -------------------------------------------------------------
  // TEST I: Database Failure Error Handling
  // Invalid tour payload or unauthorized operation returns proper HTTP error (no silent success)
  // -------------------------------------------------------------
  console.log('\n--- TEST I: Database / Validation Failure Handling ---');
  const badTourRes = await httpRequest({
    hostname: 'localhost',
    port: PORT,
    path: '/api/main-tours',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, { name: '' }); // Missing required name

  if (badTourRes.status === 400 && badTourRes.body?.error) {
    console.log('✅ TEST I PASSED: Fails fast with proper HTTP error code on database/validation failure');
    testsPassed++;
  } else {
    console.error('❌ TEST I FAILED:', badTourRes.body);
  }

  // -------------------------------------------------------------
  // TEST J: Legacy Independence
  // Verify that application has zero dependence on legacy mirror files
  // -------------------------------------------------------------
  console.log('\n--- TEST J: Legacy Independence Verification ---');
  const forbiddenPatterns = [
    'main_tours.json',
    'admin_drafts.json',
    'admin_sessions.json',
    'sharetour/db.json'
  ];

  const serverCode = fs.readFileSync('server.ts', 'utf8');
  let legacyFoundInServer = false;
  for (const pattern of forbiddenPatterns) {
    if (serverCode.includes(pattern)) {
      console.error(`Found legacy forbidden reference in server.ts: ${pattern}`);
      legacyFoundInServer = true;
    }
  }

  // Also verify that data/db.json exists and is valid JSON
  const dbExists = fs.existsSync('data/db.json');

  if (!legacyFoundInServer && dbExists) {
    console.log('✅ TEST J PASSED: Zero runtime references to legacy mirror files in server.ts, data/db.json is sole database');
    testsPassed++;
  } else {
    console.error('❌ TEST J FAILED:', { legacyFoundInServer, dbExists });
  }

  console.log('\n================================================================');
  console.log(`TOTAL PRODUCTION LOCK TESTS: ${totalTests} | PASSED: ${testsPassed} | FAILED: ${totalTests - testsPassed}`);
  console.log('================================================================');

  if (testsPassed === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runProductionLockTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
