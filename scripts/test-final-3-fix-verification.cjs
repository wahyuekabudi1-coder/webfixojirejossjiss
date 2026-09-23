/**
 * SMART JOURNEY — FINAL 3-FIX VERIFICATION TEST SUITE
 * Test 1: No Vercel Runtime / Wrapper Leftovers
 * Test 2: Database Read Does Not Mutate Persistent Storage
 * Test 3: Historical Trip Deletion Protection (Soft Delete/Archive vs Hard Delete)
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DB_PATH = path.join(PROJECT_ROOT, 'data', 'db.json');
const PORT = 3000;

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${message}`);
    failedTests++;
  }
}

function request(method, pathUrl, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: PORT,
      path: pathUrl,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
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
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING FINAL 3-FIX VERIFICATION SUITE');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // TEST 1: NO VERCEL RUNTIME / LEFTOVERS
  // ----------------------------------------------------
  console.log('--- TEST 1: Vercel Deployment Cleanup ---');
  const vercelJsonExists = fs.existsSync(path.join(PROJECT_ROOT, 'vercel.json'));
  const apiIndexExists = fs.existsSync(path.join(PROJECT_ROOT, 'api', 'index.ts'));
  const apiDirExists = fs.existsSync(path.join(PROJECT_ROOT, 'api'));
  const distServerExists = fs.existsSync(path.join(PROJECT_ROOT, 'dist', 'server.cjs'));

  assert(!vercelJsonExists, 'vercel.json is completely absent from repository');
  assert(!apiIndexExists, 'api/index.ts (Vercel serverless entry) is absent');
  assert(!apiDirExists, 'api/ directory is completely absent');
  assert(distServerExists, 'dist/server.cjs exists and is built for Niagahoster Node.js runtime');

  // ----------------------------------------------------
  // TEST 2: READ DOES NOT MUTATE PERSISTENT DATABASE
  // ----------------------------------------------------
  console.log('\n--- TEST 2: Database Read Does Not Mutate ---');
  const initialContent = fs.readFileSync(DB_PATH, 'utf8');
  const initialHash = crypto.createHash('sha256').update(initialContent).digest('hex');

  // Simulate multiple read requests (GET /api/trips, GET /api/batches, GET /api/db)
  for (let i = 0; i < 5; i++) {
    await request('GET', '/api/trips');
    await request('GET', '/api/batches');
    await request('GET', '/api/db');
  }

  const postReadContent = fs.readFileSync(DB_PATH, 'utf8');
  const postReadHash = crypto.createHash('sha256').update(postReadContent).digest('hex');

  assert(
    initialHash === postReadHash,
    'Calling GET endpoints / readDB() causes ZERO mutations to persistent data/db.json'
  );

  // ----------------------------------------------------
  // TEST 3: HISTORICAL TRIP DELETION PROTECTION
  // ----------------------------------------------------
  console.log('\n--- TEST 3: Historical Trip Deletion Protection ---');

  // Seed an admin session for authorized calls
  const token = 'test-token-' + Date.now();
  const rawDB = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  rawDB.adminSessions = rawDB.adminSessions || [];
  rawDB.adminSessions.push({
    token,
    email: 'admin@smartjourney.id',
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + 3600000
  });
  fs.writeFileSync(DB_PATH, JSON.stringify(rawDB, null, 2), 'utf8');

  const adminHeaders = {
    'Authorization': `Bearer ${token}`
  };

  // 3A: Trip WITHOUT historical booking -> Hard Delete
  const unbookedTripId = 'trip-temp-unbooked-' + Date.now();
  const unbookedBatchId = 'batch-temp-unbooked-' + Date.now();
  const dbBefore = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  dbBefore.trips = dbBefore.trips || [];
  dbBefore.trips.push({
    id: unbookedTripId,
    title: 'Unbooked Ephemeral Trip',
    slug: 'unbooked-ephemeral-trip',
    location: 'Bromo',
    duration: '1 Hari',
    description: 'Test unbooked trip',
    coverImage: '/test.jpg',
    included: [],
    excluded: [],
    itinerary: [],
    startingPrice: 500000,
    status: 'published'
  });
  dbBefore.batches = dbBefore.batches || [];
  dbBefore.batches.push({
    id: unbookedBatchId,
    tripId: unbookedTripId,
    departureDate: '2026-10-01',
    quota: 10,
    availableSeats: 10,
    price: 500000,
    status: 'Open'
  });
  fs.writeFileSync(DB_PATH, JSON.stringify(dbBefore, null, 2), 'utf8');

  const delUnbookedRes = await request('DELETE', `/api/trips/${unbookedTripId}`, null, adminHeaders);
  assert(delUnbookedRes.status === 200, 'DELETE /api/trips/:id for unbooked trip returns HTTP 200');
  assert(delUnbookedRes.body.mode === 'deleted', 'Unbooked trip mode is "deleted" (hard delete)');

  const dbAfterUnbooked = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  const unbookedStillInDb = (dbAfterUnbooked.trips || []).some((t) => t.id === unbookedTripId);
  const unbookedBatchStillInDb = (dbAfterUnbooked.batches || []).some((b) => b.id === unbookedBatchId);
  assert(!unbookedStillInDb, 'Unbooked trip is completely removed from database');
  assert(!unbookedBatchStillInDb, 'Associated unused batch is completely removed from database');

  // 3B: Trip WITH historical booking -> Soft Delete (Archive)
  const bookedTripId = 'trip-temp-booked-' + Date.now();
  const bookedBatchId = 'batch-temp-booked-' + Date.now();
  const testBookingId = 'book-temp-' + Date.now();

  const dbBeforeBooked = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  dbBeforeBooked.trips.push({
    id: bookedTripId,
    title: 'Historical Booked Trip',
    slug: 'historical-booked-trip',
    location: 'Ijen',
    duration: '2 Hari 1 Malam',
    description: 'Test booked trip',
    coverImage: '/test.jpg',
    included: ['Transport'],
    excluded: ['Personal'],
    itinerary: [],
    startingPrice: 1500000,
    status: 'published'
  });
  dbBeforeBooked.batches.push({
    id: bookedBatchId,
    tripId: bookedTripId,
    departureDate: '2026-11-15',
    quota: 10,
    availableSeats: 8,
    price: 1500000,
    status: 'Open'
  });
  dbBeforeBooked.bookings = dbBeforeBooked.bookings || [];
  dbBeforeBooked.bookings.push({
    id: testBookingId,
    bookingCode: 'HIST-999',
    tripId: bookedTripId,
    tripTitle: 'Historical Booked Trip',
    batchId: bookedBatchId,
    status: 'Confirmed',
    paymentStatus: 'Paid',
    fullName: 'Historical Traveler',
    email: 'traveler@historical.test',
    phone: '08123456789',
    participantsCount: 2,
    participantsNames: ['Historical Traveler'],
    proofOfPayment: 'CONFIRMED',
    totalPrice: 3000000,
    totalPriceIDR: 3000000,
    createdAt: new Date().toISOString()
  });
  fs.writeFileSync(DB_PATH, JSON.stringify(dbBeforeBooked, null, 2), 'utf8');

  const delBookedRes = await request('DELETE', `/api/trips/${bookedTripId}`, null, adminHeaders);
  assert(delBookedRes.status === 200, 'DELETE /api/trips/:id for booked trip returns HTTP 200');
  assert(delBookedRes.body.mode === 'archived', 'Booked trip mode is "archived" (soft delete)');

  const dbAfterBooked = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  const archivedTrip = (dbAfterBooked.trips || []).find((t) => t.id === bookedTripId);
  assert(Boolean(archivedTrip), 'Trip with historical bookings remains in database');
  assert(archivedTrip && archivedTrip.status === 'archived', 'Trip status is updated to "archived"');
  assert(archivedTrip && archivedTrip.isArchived === true, 'Trip is marked with isArchived: true');

  // Verify Public API excludes archived trip
  const publicTripsRes = await request('GET', '/api/trips');
  const publicCanSeeArchived = (publicTripsRes.body || []).some((t) => t.id === bookedTripId);
  assert(!publicCanSeeArchived, 'Public GET /api/trips does NOT expose the archived trip');

  // Verify Public single trip returns 404 for archived trip
  const publicSingleRes = await request('GET', `/api/trips/${bookedTripId}`);
  assert(publicSingleRes.status === 404, 'Public GET /api/trips/:id returns HTTP 404 for archived trip');

  // Verify Admin CAN still see the archived trip in catalog
  const adminTripsRes = await request('GET', '/api/trips', null, adminHeaders);
  const adminCanSeeArchived = (adminTripsRes.body || []).some((t) => t.id === bookedTripId);
  assert(adminCanSeeArchived, 'Admin GET /api/trips can access the archived trip');

  // Verify historical booking retains complete integrity
  const retainedBooking = (dbAfterBooked.bookings || []).find((b) => b.id === testBookingId);
  assert(Boolean(retainedBooking), 'Historical booking record is fully intact');
  assert(
    retainedBooking && retainedBooking.tripTitle === 'Historical Booked Trip',
    'Historical booking preserves trip title'
  );

  // Clean up and reset DB to release state
  const cleanDB = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  cleanDB.trips = (cleanDB.trips || []).filter((t) => t.id !== bookedTripId && t.id !== unbookedTripId);
  cleanDB.batches = (cleanDB.batches || []).filter((b) => b.id !== bookedBatchId && b.id !== unbookedBatchId);
  cleanDB.bookings = [];
  cleanDB.adminSessions = [];
  cleanDB.adminDrafts = {};
  fs.writeFileSync(DB_PATH, JSON.stringify(cleanDB, null, 2), 'utf8');

  console.log('\n====================================================');
  console.log(`TOTAL 3-FIX CHECKS: ${passedTests + failedTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
  console.log('====================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
