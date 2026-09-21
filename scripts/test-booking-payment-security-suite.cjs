const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;
const DB_PATH = path.join(process.cwd(), 'data', 'db.json');

function request(method, pathUrl, data = null, headers = {}) {
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
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(body);
        } catch (e) {
          parsed = body;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });

    req.on('error', (err) => reject(err));
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

async function runSecuritySuite() {
  console.log('====================================================');
  console.log('🔒 RUNNING BOOKING & PAYMENT SECURITY TEST SUITE');
  console.log('====================================================\n');

  // Read DB to get active and archived tours, and active batches
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  const publishedTour = (db.mainTours || []).find(t => !t.isDeleted && !t.isArchived && (t.status === 'published' || t.status === 'Active'));
  assert(!!publishedTour, 'Fixture check: Must have at least 1 published tour in data/db.json');

  const tourPrice = Number(publishedTour.startingPriceIDR || publishedTour.price);
  assert(tourPrice > 0, `Fixture check: Published tour ${publishedTour.id} must have price > 0 (found ${tourPrice})`);

  console.log(`Using published tour: "${publishedTour.name}" (${publishedTour.id}) with authoritative price: IDR ${tourPrice.toLocaleString('id-ID')}\n`);

  // Ensure we have an archived/deleted tour fixture
  let archivedTour = (db.mainTours || []).find(t => t.isDeleted || t.isArchived || t.status === 'archived');
  if (!archivedTour) {
    archivedTour = {
      id: 'tour-archived-security-test',
      name: 'Archived Security Test Tour',
      status: 'archived',
      isArchived: true,
      startingPriceIDR: 1500000
    };
    db.mainTours.push(archivedTour);
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  }

  // Generate an admin session token for testing admin-only endpoints
  const adminToken = 'security-test-admin-token-' + Date.now();
  db.adminSessions = db.adminSessions || [];
  db.adminSessions.push({
    token: adminToken,
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + 3600000
  });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');

  // ----------------------------------------------------------------
  // TEST 1: Customer sends totalPriceIDR=1, paymentStatus=Paid, status=Confirmed
  // Expected: REJECTED/IGNORED (Backend determines authoritative price and initial Pending/Pending status)
  // ----------------------------------------------------------------
  console.log('--- TEST 1: Customer Tampered Price & Status Submission ---');
  const tamperedBookingRes = await request('POST', '/api/bookings', {
    tripId: publishedTour.id,
    fullName: 'Mr. Attacker',
    phone: '081299998888',
    email: 'attacker@example.com',
    departureDate: '2026-12-01',
    participantsCount: 1,
    totalPrice: 1,
    totalPriceIDR: 1,
    baseAmount: 1,
    paymentAmount: 1,
    uniqueCode: 0,
    status: 'Confirmed',
    paymentStatus: 'Paid',
    adminNotes: 'Attacker injected note'
  });

  assert(tamperedBookingRes.status === 201, `POST /api/bookings returns HTTP 201 (got ${tamperedBookingRes.status})`);
  const tBooking = tamperedBookingRes.body;
  assert(tBooking.baseAmount === tourPrice, `Authoritative baseAmount applied: IDR ${tBooking.baseAmount} === expected ${tourPrice} (Ignored client price: 1)`);
  assert(tBooking.totalPriceIDR === tourPrice, `Authoritative totalPriceIDR: IDR ${tBooking.totalPriceIDR}`);
  assert(tBooking.status === 'Pending', `Booking status forced to 'Pending' (Ignored client status: Confirmed)`);
  assert(tBooking.paymentStatus === 'Pending', `Payment status forced to 'Pending' (Ignored client paymentStatus: Paid)`);
  assert(tBooking.adminNotes === '', `Admin notes cleared (Ignored client adminNotes injection)`);
  console.log('TEST 1 PASSED: Server completely ignored tampered price, status, and adminNotes.\n');

  // ----------------------------------------------------------------
  // TEST 2: Customer sends forged uniqueCode=99, paymentAmount=1
  // Expected: Server-generated uniqueCode and paymentAmount = baseAmount + uniqueCode
  // ----------------------------------------------------------------
  console.log('--- TEST 2: Customer Forged Unique Code & Payment Amount ---');
  const forgedUniqueCodeRes = await request('POST', '/api/bookings', {
    tripId: publishedTour.id,
    fullName: 'Ms. Forger',
    phone: '081277776666',
    email: 'forger@example.com',
    departureDate: '2026-12-02',
    participantsCount: 1,
    uniqueCode: 99,
    paymentAmount: 1
  });

  assert(forgedUniqueCodeRes.status === 201, `POST /api/bookings returns HTTP 201`);
  const fBooking = forgedUniqueCodeRes.body;
  assert(fBooking.uniqueCode >= 1 && fBooking.uniqueCode <= 99, `Server-generated uniqueCode is within 1-99 (got ${fBooking.uniqueCode})`);
  assert(fBooking.paymentAmount === fBooking.baseAmount + fBooking.uniqueCode, `Server calculates paymentAmount (${fBooking.paymentAmount} === ${fBooking.baseAmount} + ${fBooking.uniqueCode})`);
  console.log('TEST 2 PASSED: Server generated genuine uniqueCode and calculated valid paymentAmount.\n');

  // ----------------------------------------------------------------
  // TEST 3: Customer accesses GET /api/bookings without admin credentials
  // Expected: 401 / 403 Unauthorized
  // ----------------------------------------------------------------
  console.log('--- TEST 3: Public Access to GET /api/bookings ---');
  const publicBookingsRes = await request('GET', '/api/bookings');
  assert(publicBookingsRes.status === 401 || publicBookingsRes.status === 403, `Unauthenticated request to GET /api/bookings returns 401/403 (got HTTP ${publicBookingsRes.status})`);

  // Admin access check:
  const adminBookingsRes = await request('GET', '/api/bookings', null, {
    'Authorization': `Bearer ${adminToken}`
  });
  assert(adminBookingsRes.status === 200, `Admin request with valid bearer token returns HTTP 200 (got ${adminBookingsRes.status})`);
  assert(Array.isArray(adminBookingsRes.body), `Admin receives bookings array`);
  console.log('TEST 3 PASSED: Public customer blocked with 401/403, admin allowed with 200.\n');

  // ----------------------------------------------------------------
  // TEST 4: Customer attempts to read another customer booking directly via GET /api/bookings/:id
  // Expected: 401 / 403 (or 404)
  // ----------------------------------------------------------------
  console.log('--- TEST 4: Customer Attempts Direct Read of Another Customer Booking ---');
  const directBookingReadRes = await request('GET', `/api/bookings/${tBooking.id}`);
  assert(directBookingReadRes.status === 401 || directBookingReadRes.status === 403, `Public read of /api/bookings/:id returns 401/403 (got HTTP ${directBookingReadRes.status})`);

  // Secure customer check endpoint check:
  const customerCheckRes = await request('GET', `/api/private-tour/check-booking/${tBooking.bookingCode}`);
  assert(customerCheckRes.status === 200, `Customer lookup via /api/private-tour/check-booking/:bookingCode returns 200`);
  assert(customerCheckRes.body.bookingCode === tBooking.bookingCode, `Customer sees their own booking`);
  assert(customerCheckRes.body.adminNotes === undefined, `Admin internal notes are NOT exposed in customer lookup`);
  console.log('TEST 4 PASSED: Direct booking read blocked, secure lookup functional without leaking metadata.\n');

  // ----------------------------------------------------------------
  // TEST 5: Customer attempts to create booking for archived/deleted tour
  // Expected: HTTP 404
  // ----------------------------------------------------------------
  console.log('--- TEST 5: Booking for Archived / Deleted Tour ---');
  const archivedBookingRes = await request('POST', '/api/bookings', {
    tripId: archivedTour.id,
    fullName: 'Test User',
    phone: '081233334444',
    email: 'test@example.com',
    departureDate: '2026-12-05',
    participantsCount: 1
  });
  assert(archivedBookingRes.status === 404, `Booking for archived tour returns HTTP 404 (got ${archivedBookingRes.status})`);
  console.log('TEST 5 PASSED: Archived / deleted tour cannot be booked.\n');

  // ----------------------------------------------------------------
  // TEST 6: Customer attempts booking with fake price on published tour
  // Expected: Server uses authoritative price from database
  // ----------------------------------------------------------------
  console.log('--- TEST 6: Booking with Fake Client Price ---');
  const fakePriceBookingRes = await request('POST', '/api/bookings', {
    tripId: publishedTour.id,
    fullName: 'Fake Price Tester',
    phone: '081255551111',
    email: 'fakeprice@example.com',
    departureDate: '2026-12-10',
    participantsCount: 1,
    totalPrice: 500,
    totalPriceIDR: 500
  });
  assert(fakePriceBookingRes.status === 201, `Booking created with HTTP 201`);
  assert(fakePriceBookingRes.body.baseAmount === tourPrice, `Authoritative price used: ${fakePriceBookingRes.body.baseAmount} === ${tourPrice}`);
  console.log('TEST 6 PASSED: Server used authoritative catalog price, ignoring fake client price.\n');

  // ----------------------------------------------------------------
  // TEST 7: Booking already Paid, customer attempts to create payment intent again
  // Expected: HTTP 400 (Rejected)
  // ----------------------------------------------------------------
  console.log('--- TEST 7: Double Payment Prevention for Already Paid Order ---');
  // Mark fakePriceBooking as Paid in DB
  const dbCurrent = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  const bIndex = dbCurrent.bookings.findIndex(b => b.id === fakePriceBookingRes.body.id);
  dbCurrent.bookings[bIndex].paymentStatus = 'Paid';
  dbCurrent.bookings[bIndex].status = 'Pending Confirmation'; // Payment success != confirmed
  fs.writeFileSync(DB_PATH, JSON.stringify(dbCurrent, null, 2), 'utf8');

  const doublePaymentIntentRes = await request('POST', '/api/artopay/payment-intent', {
    orderId: fakePriceBookingRes.body.bookingCode,
    amount: fakePriceBookingRes.body.paymentAmount
  });
  assert(doublePaymentIntentRes.status === 400, `Creating payment intent for Paid booking returns HTTP 400 (got ${doublePaymentIntentRes.status})`);
  assert(doublePaymentIntentRes.body.error && doublePaymentIntentRes.body.error.includes('sudah lunas'), `Rejection message indicates order already paid`);
  console.log('TEST 7 PASSED: Double payment prevented with HTTP 400.\n');

  console.log('====================================================');
  console.log('🎉 ALL 7 BOOKING & PAYMENT SECURITY TESTS PASSED!');
  console.log('====================================================');
}

runSecuritySuite().catch((err) => {
  console.error('Fatal error running security suite:', err);
  process.exit(1);
});
