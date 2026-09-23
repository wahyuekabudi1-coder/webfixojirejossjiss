// =============================================================================
// SMART JOURNEY — FINAL ZERO-REGRESSION PRODUCTION LOCK TEST SUITE
// =============================================================================
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
try { require('dotenv').config(); } catch (_) {}

const PORT = 3000;
const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

let totalPassed = 0;
let totalFailed = 0;

function assert(condition, testName, detail = '') {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    if (detail) console.log(`   └─ ${detail}`);
    totalPassed++;
  } else {
    console.error(`❌ [FAIL] ${testName}`);
    if (detail) console.error(`   └─ FAILURE: ${detail}`);
    totalFailed++;
  }
}

// -----------------------------------------------------------------------------
// STATIC PRODUCTION SECURITY & SOURCE CODE INTEGRITY CHECKS (ZERO CREDENTIAL REQ)
// -----------------------------------------------------------------------------
function runStaticSecurityChecks() {
  console.log('================================================================');
  console.log('🔍  SMART JOURNEY: STATIC PRODUCTION SECURITY & LOCK VERIFICATION');
  console.log('================================================================\n');

  // Static Check 1: Real .env absent from repository root
  const realEnvPath = path.join(__dirname, '..', '.env');
  assert(!fs.existsSync(realEnvPath), 'Static Check 1: Real .env file absent from workspace root');

  // Static Check 2: .env.example exists and contains no production secrets
  const envExamplePath = path.join(__dirname, '..', '.env.example');
  const envExampleExists = fs.existsSync(envExamplePath);
  assert(envExampleExists, 'Static Check 2a: .env.example exists on disk');
  if (envExampleExists) {
    const envExampleContent = fs.readFileSync(envExamplePath, 'utf8');
    const lines = envExampleContent.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    const nonPlaceholderLines = lines.filter(l => {
      const parts = l.split('=');
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      if (key === 'PORT') return false; // PORT=3000 is allowed default
      return val.length > 0 && !val.startsWith('your-');
    });
    assert(nonPlaceholderLines.length === 0, 'Static Check 2b: .env.example contains only blank/placeholder entries', nonPlaceholderLines.join(', '));
  }

  // Static Check 3: data/db.json sanitized of all PII and active sessions
  const dbSnap = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  assert(
    Array.isArray(dbSnap.adminSessions) && dbSnap.adminSessions.length === 0,
    'Static Check 3a: db.adminSessions is strictly [] (Zero active session tokens in source DB)'
  );
  assert(
    Array.isArray(dbSnap.bookings) && dbSnap.bookings.length === 0,
    'Static Check 3b: db.bookings is strictly [] (Zero customer PII records in source DB)'
  );

  // Static Check 4: Zero hardcoded secret assignments across codebase
  let hardcodedMatches = [];
  const assignmentPattern = /(ADMIN_PASSWORD|ADMIN_SECRET_KEY|ARTOPAY_SECRET_KEY|WEBHOOK_SECRET)\s*=\s*['"`][^'"`\n]{4,}['"`]/;
  const dirsToScan = ['server.ts', 'src', 'scripts'];
  
  function scanTarget(targetPath) {
    const fullTarget = path.join(__dirname, '..', targetPath);
    if (!fs.existsSync(fullTarget)) return;
    const stat = fs.statSync(fullTarget);
    if (stat.isFile()) {
      try {
        const text = fs.readFileSync(fullTarget, 'utf8');
        text.split('\n').forEach((line, idx) => {
          if (assignmentPattern.test(line)) {
            hardcodedMatches.push(`${targetPath}:${idx + 1}: ${line.trim()}`);
          }
        });
      } catch (_) {}
    } else if (stat.isDirectory()) {
      const items = fs.readdirSync(fullTarget);
      for (const item of items) {
        if (item === 'node_modules' || item === '.git' || item === 'dist') continue;
        scanTarget(path.join(targetPath, item));
      }
    }
  }
  dirsToScan.forEach(scanTarget);

  if (process.env.FORBIDDEN_TEST_SECRET_PATTERN) {
    try {
      const forbiddenRe = new RegExp(process.env.FORBIDDEN_TEST_SECRET_PATTERN);
      function scanForbidden(targetPath) {
        const fullTarget = path.join(__dirname, '..', targetPath);
        if (!fs.existsSync(fullTarget)) return;
        const stat = fs.statSync(fullTarget);
        if (stat.isFile()) {
          const text = fs.readFileSync(fullTarget, 'utf8');
          text.split('\n').forEach((line, idx) => {
            if (forbiddenRe.test(line)) {
              hardcodedMatches.push(`FORBIDDEN_PATTERN at ${targetPath}:${idx + 1}`);
            }
          });
        } else if (stat.isDirectory()) {
          const items = fs.readdirSync(fullTarget);
          for (const item of items) {
            if (item === 'node_modules' || item === '.git' || item === 'dist') continue;
            scanForbidden(path.join(targetPath, item));
          }
        }
      }
      dirsToScan.forEach(scanForbidden);
    } catch (_) {}
  }

  assert(hardcodedMatches.length === 0, 'Static Check 4: Zero hardcoded secret assignments in server.ts, src/, and scripts/');
  if (hardcodedMatches.length > 0) {
    console.error('Violations found:', hardcodedMatches);
  }
}

function request(options, body) {
  return new Promise((resolve, reject) => {
    const postData = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : '';
    const headers = { ...(options.headers || {}) };
    if (postData) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      headers['Content-Length'] = Buffer.byteLength(postData);
    }
    const req = http.request({ ...options, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) { json = data; }
        resolve({ statusCode: res.statusCode, headers: res.headers, json, raw: data });
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || '').trim();
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim();
const WEBHOOK_SECRET = (process.env.WEBHOOK_SECRET || process.env.ARTOPAY_SECRET_KEY || '').trim();

function signPayload(payload, secret = WEBHOOK_SECRET) {
  const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');
}

async function runZeroRegressionSuite() {
  console.log('================================================================');
  console.log('🛡️  SMART JOURNEY: FINAL ZERO-REGRESSION PRODUCTION LOCK SUITE');
  console.log('================================================================\n');

  // Backup original DB state to safely restore after testing
  const originalDbState = fs.readFileSync(DB_PATH, 'utf8');

  try {
    // -----------------------------------------------------------------
    // SECTION 1: ADMIN SESSIONS & SOURCE SNAPSHOT INTEGRITY
    // -----------------------------------------------------------------
    console.log('--- SECTION 1: Admin Sessions & Source Snapshot Integrity ---');
    
    // Test 1.1: Verify DB structure supports adminSessions as an array
    const dbSnap = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    assert(Array.isArray(dbSnap.adminSessions), 'db.adminSessions is initialized as an array');

    // Test 1.2: Invalid Token -> 401
    const invalidAuthRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/main-tours?all=true',
      method: 'GET',
      headers: { 'Authorization': 'Bearer invalid_garbage_token_99999' }
    });
    assert(invalidAuthRes.statusCode === 401, 'Request with invalid token rejected with HTTP 401');

    // Test 1.3: Expired Token -> 401
    const testExpiredToken = 'token_expired_' + Date.now();
    const dbWithExpired = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    dbWithExpired.adminSessions = dbWithExpired.adminSessions || [];
    dbWithExpired.adminSessions.push({
      token: testExpiredToken,
      createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
      expiresAt: Date.now() - 1000 // already expired
    });
    fs.writeFileSync(DB_PATH, JSON.stringify(dbWithExpired, null, 2));

    const expiredAuthRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/main-tours?all=true',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${testExpiredToken}` }
    });
    assert(expiredAuthRes.statusCode === 401, 'Request with expired token rejected with HTTP 401');

    // Test 1.4: Valid Admin Login -> 200 & Token Acquired
    const loginRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/auth/login',
      method: 'POST'
    }, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    assert(loginRes.statusCode === 200 && Boolean(loginRes.json?.token), 'Valid admin login succeeds with 200 and issues session token');
    const validToken = loginRes.json?.token;

    // Test 1.5: Valid Session Token -> Authorized Access
    const validAuthRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/main-tours?all=true',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${validToken}` }
    });
    assert(validAuthRes.statusCode === 200 && Array.isArray(validAuthRes.json), 'Request with valid token authorized with HTTP 200');

    // Test 1.6: Admin Logout cleans up session
    const logoutRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/auth/logout',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${validToken}` }
    });
    assert(logoutRes.statusCode === 200, 'Admin logout succeeds with HTTP 200');

    // Re-verify token is invalidated after logout
    const postLogoutRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/main-tours?all=true',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${validToken}` }
    });
    assert(postLogoutRes.statusCode === 401, 'Logged out session token immediately rejected with HTTP 401');

    // -----------------------------------------------------------------
    // SECTION 2: PAYMENT VERIFICATION — ABSOLUTE STRICT MODE & ZERO MUTATION
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 2: Payment Verification Strict Mode & Zero Mutation ---');

    // Setup fresh booking for strict payment tests
    const freshDb = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const testTour = (freshDb.mainTours && freshDb.mainTours.find(t => !t.isDeleted)) || {
      id: 'tour-bromo-private',
      startingPriceIDR: 2500000
    };

    const bookRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/bookings',
      method: 'POST'
    }, {
      tourId: testTour.id,
      fullName: 'Ahmad Fauzi',
      email: 'ahmad.fauzi@example.com',
      phone: '+6281122334455',
      participantsCount: 2,
      bookingType: 'private'
    });
    assert(bookRes.statusCode === 201, 'Test booking created successfully (HTTP 201)');
    const testBooking = bookRes.json;
    const expectedAmount = testBooking.paymentAmount;
    const bookingCode = testBooking.bookingCode;
    const bookingId = testBooking.id;

    // Helper to get booking state directly from disk
    const getDiskBooking = () => {
      const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
      return db.bookings.find(b => b.id === bookingId || b.bookingCode === bookingCode);
    };

    // Test 2.1: Missing Currency -> REJECT (400) + ZERO MUTATION
    const noCurrencyPayload = {
      orderId: bookingCode,
      paymentId: 'PAY-NOCURR-' + Date.now(),
      status: 'success',
      amount: expectedAmount
    };
    const noCurrRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/artopay/webhook',
      method: 'POST',
      headers: { 'x-artopay-signature': signPayload(noCurrencyPayload) }
    }, noCurrencyPayload);
    assert(noCurrRes.statusCode === 400, 'Webhook missing currency rejected with HTTP 400');
    assert(getDiskBooking().paymentStatus === 'Pending', 'Zero DB mutation: paymentStatus remains Pending after missing currency rejection');

    // Test 2.2: Currency USD -> REJECT (400) + ZERO MUTATION
    const usdPayload = {
      orderId: bookingCode,
      paymentId: 'PAY-USD-' + Date.now(),
      status: 'success',
      amount: expectedAmount,
      currency: 'USD'
    };
    const usdRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/artopay/webhook',
      method: 'POST',
      headers: { 'x-artopay-signature': signPayload(usdPayload) }
    }, usdPayload);
    assert(usdRes.statusCode === 400, 'Webhook with non-IDR currency (USD) rejected with HTTP 400');
    assert(getDiskBooking().paymentStatus === 'Pending', 'Zero DB mutation: paymentStatus remains Pending after USD rejection');

    // Test 2.3: Missing Amount -> REJECT (400) + ZERO MUTATION
    const noAmountPayload = {
      orderId: bookingCode,
      paymentId: 'PAY-NOAMT-' + Date.now(),
      status: 'success',
      currency: 'IDR'
    };
    const noAmtRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/artopay/webhook',
      method: 'POST',
      headers: { 'x-artopay-signature': signPayload(noAmountPayload) }
    }, noAmountPayload);
    assert(noAmtRes.statusCode === 400, 'Webhook with missing amount rejected with HTTP 400');
    assert(getDiskBooking().paymentStatus === 'Pending', 'Zero DB mutation: paymentStatus remains Pending after missing amount');

    // Test 2.4: Fractional Amount (e.g. 100000.7) -> REJECT (400) + ZERO MUTATION (No Math.round bypass)
    const fracPayload = {
      orderId: bookingCode,
      paymentId: 'PAY-FRAC-' + Date.now(),
      status: 'success',
      amount: expectedAmount + 0.7,
      currency: 'IDR'
    };
    const fracRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/artopay/webhook',
      method: 'POST',
      headers: { 'x-artopay-signature': signPayload(fracPayload) }
    }, fracPayload);
    assert(fracRes.statusCode === 400, 'Webhook with fractional amount rejected with HTTP 400 (No Math.round)');
    assert(getDiskBooking().paymentStatus === 'Pending', 'Zero DB mutation: paymentStatus remains Pending after fractional amount');

    // Test 2.5: Wrong Amount (Rp 1 difference) -> REJECT (400) + ZERO MUTATION
    const wrongAmtPayload = {
      orderId: bookingCode,
      paymentId: 'PAY-WRONGAMT-' + Date.now(),
      status: 'success',
      amount: expectedAmount + 1,
      currency: 'IDR'
    };
    const wrongAmtRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/artopay/webhook',
      method: 'POST',
      headers: { 'x-artopay-signature': signPayload(wrongAmtPayload) }
    }, wrongAmtPayload);
    assert(wrongAmtRes.statusCode === 400, 'Webhook with mismatched amount (+Rp 1) rejected with HTTP 400');
    assert(getDiskBooking().paymentStatus === 'Pending', 'Zero DB mutation: paymentStatus remains Pending after wrong amount');

    // Test 2.6: Missing Transaction Identity (no orderId, no paymentId, no paymentIntentId) -> REJECT (400)
    const noIdentPayload = {
      status: 'success',
      amount: expectedAmount,
      currency: 'IDR'
    };
    const noIdentRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/artopay/webhook',
      method: 'POST',
      headers: { 'x-artopay-signature': signPayload(noIdentPayload) }
    }, noIdentPayload);
    assert(noIdentRes.statusCode === 400, 'Webhook missing all transaction identifiers rejected with HTTP 400');

    // Test 2.7: Wrong Transaction Identity (orderId does not exist) -> REJECT (404 / 400)
    const wrongIdentPayload = {
      orderId: 'SJ-NONEXISTENT-999',
      paymentId: 'PAY-WRONGID-' + Date.now(),
      status: 'success',
      amount: expectedAmount,
      currency: 'IDR'
    };
    const wrongIdentRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/artopay/webhook',
      method: 'POST',
      headers: { 'x-artopay-signature': signPayload(wrongIdentPayload) }
    }, wrongIdentPayload);
    assert(wrongIdentRes.statusCode === 404 || wrongIdentRes.statusCode === 400, 'Webhook with nonexistent orderId rejected');

    // Test 2.8: Valid Payment -> PASS (200) + State Machine Check
    const validPayPayload = {
      orderId: bookingCode,
      paymentId: 'PAY-VALID-' + Date.now(),
      status: 'success',
      amount: expectedAmount,
      grossAmount: expectedAmount,
      currency: 'IDR'
    };
    const validPayRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/artopay/webhook',
      method: 'POST',
      headers: { 'x-artopay-signature': signPayload(validPayPayload) }
    }, validPayPayload);
    assert(validPayRes.statusCode === 200, 'Valid webhook accepted with HTTP 200');
    
    // Check State Machine: paymentStatus="Paid" BUT bookingStatus="Pending Confirmation" (PAID !== CONFIRMED)
    const paidBooking = getDiskBooking();
    assert(paidBooking.paymentStatus === 'Paid', 'Booking paymentStatus updated to "Paid"');
    assert(paidBooking.status === 'Pending Confirmation', 'Booking status is "Pending Confirmation" (NOT Confirmed yet)');

    // -----------------------------------------------------------------
    // SECTION 3: PUBLIC API PROJECTIONS & PII SANITIZATION
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 3: Public API Projections & PII Protection ---');

    // Test 3.1: GET /api/db Projection
    const dbProjRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/db',
      method: 'GET'
    });
    assert(dbProjRes.statusCode === 200, 'GET /api/db returns 200 for public client');
    const pubDb = dbProjRes.json;
    assert(pubDb.adminSessions === undefined, 'GET /api/db does NOT expose adminSessions');
    assert(pubDb.adminDrafts === undefined, 'GET /api/db does NOT expose adminDrafts');
    assert(pubDb.vehicles && pubDb.vehicles.length === 0, 'GET /api/db returns empty array for vehicles on public requests');
    
    // Check internal margins are stripped in public /api/db trips
    if (pubDb.trips && pubDb.trips.length > 0) {
      assert(pubDb.trips[0].internalNotes === undefined, 'GET /api/db trips do NOT leak internalNotes');
      assert(pubDb.trips[0].profitMargin === undefined, 'GET /api/db trips do NOT leak profitMargin');
      assert(pubDb.trips[0].costBreakdown === undefined, 'GET /api/db trips do NOT leak costBreakdown');
    }

    // Test 3.2: GET /api/trips Projection
    const tripsRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/trips',
      method: 'GET'
    });
    assert(tripsRes.statusCode === 200, 'GET /api/trips returns 200');
    if (tripsRes.json.length > 0) {
      assert(tripsRes.json[0].costBreakdown === undefined, 'GET /api/trips does NOT expose costBreakdown');
      assert(tripsRes.json[0].supplierCost === undefined, 'GET /api/trips does NOT expose supplierCost');
    }

    // Test 3.3: GET /api/batches Projection
    const batchesRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/batches',
      method: 'GET'
    });
    assert(batchesRes.statusCode === 200, 'GET /api/batches returns 200');
    if (batchesRes.json.length > 0) {
      assert(batchesRes.json[0].costBreakdown === undefined, 'GET /api/batches does NOT expose costBreakdown');
      assert(batchesRes.json[0].supplierCost === undefined, 'GET /api/batches does NOT expose supplierCost');
    }

    // Test 3.4: GET /api/reviews Public Filtering
    // Insert a pending review and an approved review
    const revDb = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    revDb.reviews = revDb.reviews || [];
    const pendingRevId = 'rev-pend-' + Date.now();
    const approvedRevId = 'rev-appr-' + Date.now();
    revDb.reviews.push({ id: pendingRevId, name: 'Secret Reviewer', comment: 'Pending Review', status: 'pending' });
    revDb.reviews.push({ id: approvedRevId, name: 'Happy Traveler', comment: 'Approved Review', status: 'approved' });
    fs.writeFileSync(DB_PATH, JSON.stringify(revDb, null, 2));

    const pubReviewsRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/reviews',
      method: 'GET'
    });
    assert(pubReviewsRes.statusCode === 200, 'GET /api/reviews returns 200');
    const pubRevIds = pubReviewsRes.json.map(r => r.id);
    assert(pubRevIds.includes(approvedRevId), 'Public reviews include approved review');
    assert(!pubRevIds.includes(pendingRevId), 'Public reviews strictly EXCLUDE pending review');

    // Test 3.5: GET /api/private-tour/check-booking/:bookingCode PII Masking
    const checkBookRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/private-tour/check-booking/${bookingCode}`,
      method: 'GET'
    });
    assert(checkBookRes.statusCode === 200, 'GET /api/private-tour/check-booking returns 200');
    assert(checkBookRes.json.customerEmail === undefined, 'Customer email is NOT exposed in check-booking');
    assert(checkBookRes.json.customerPhone === undefined, 'Customer phone is NOT exposed in check-booking');
    assert(checkBookRes.json.participantsNames === undefined, 'Participants names are NOT exposed in check-booking');
    assert(checkBookRes.json.customerName.includes('*'), `Customer name is masked: "${checkBookRes.json.customerName}"`);

    // -----------------------------------------------------------------
    // SECTION 4: CONCURRENCY & OVERBOOKING PREVENTION
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 4: Concurrency & Overbooking Prevention ---');

    // Create a batch with exactly 2 seats
    const concDb = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const testBatchId = 'batch-conc-lock-' + Date.now();
    concDb.batches = concDb.batches || [];
    concDb.batches.push({
      id: testBatchId,
      tripId: (concDb.trips && concDb.trips[0]?.id) || 'trip-1',
      departureDate: '2026-12-25',
      totalSeats: 2,
      quota: 2,
      availableSeats: 2,
      price: 600000,
      status: 'Open'
    });
    fs.writeFileSync(DB_PATH, JSON.stringify(concDb, null, 2));

    // Send 6 simultaneous booking requests for 1 seat each
    const bookingReqs = [];
    for (let i = 0; i < 6; i++) {
      bookingReqs.push(
        request({
          hostname: 'localhost',
          port: PORT,
          path: '/api/bookings',
          method: 'POST'
        }, {
          batchId: testBatchId,
          bookingType: 'shared',
          fullName: `Concurrent Pax ${i + 1}`,
          participantsCount: 1,
          email: `concurrent${i + 1}@example.com`
        })
      );
    }

    const bookingResList = await Promise.all(bookingReqs);
    const concSuccesses = bookingResList.filter(r => r.statusCode === 201).length;
    const concRejections = bookingResList.filter(r => r.statusCode === 409 || r.statusCode === 400).length;

    assert(concSuccesses === 2, `Booking concurrency: Exactly 2 requests succeeded (got ${concSuccesses})`);
    assert(concRejections === 4, `Booking concurrency: Remaining 4 requests safely rejected (got ${concRejections})`);

    const postConcDb = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const finalBatch = postConcDb.batches.find(b => b.id === testBatchId);
    assert(finalBatch.availableSeats === 0, 'Batch availableSeats equals exactly 0 (no overbooking occurred)');

    // -----------------------------------------------------------------
    // SECTION 5: HTML / INVOICE XSS ESCAPING
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 5: HTML / Invoice XSS Escaping ---');

    // Admin confirms paid booking
    const adminLogRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/auth/login',
      method: 'POST'
    }, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    const admToken = adminLogRes.json?.token;

    await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/private-tour/bookings/${bookingId}/confirm`,
      method: 'POST',
      headers: { 'Authorization': `Bearer ${admToken}` }
    }, { adminNotes: '<script>alert("adminXSS")</script>' });

    // Fetch invoice HTML
    const htmlRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/private-tour/invoice-html/${bookingCode}`,
      method: 'GET'
    });
    assert(htmlRes.statusCode === 200, 'GET /api/private-tour/invoice-html returns 200 for confirmed paid booking');
    assert(!htmlRes.raw.includes('<script>alert("adminXSS")</script>'), 'Invoice HTML does NOT contain raw executable script tag');
    assert(htmlRes.raw.includes('&lt;script&gt;alert'), 'Invoice HTML properly escaped script tag to &lt;script&gt;');

    // -----------------------------------------------------------------
    // SECTION 6: RELEASE CANDIDATE 3 REGRESSION TESTS
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 6: Release Candidate 3 Regression Tests ---');

    // TEST A: Strict Currency Validation on /api/artopay/payment-intent
    console.log('--- Test A: Missing / Invalid Currency on /api/artopay/payment-intent ---');
    // A.1 Missing currency
    const noCurrencyRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/artopay/payment-intent',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      orderId: bookingCode,
      amount: 100000
    });
    assert(noCurrencyRes.statusCode === 400, 'Test A.1: Missing currency rejected with HTTP 400');
    assert(noCurrencyRes.json?.error?.includes('IDR'), 'Test A.1: Error message explicitly specifies currency must be IDR');

    // A.2 Empty currency
    const emptyCurrencyRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/artopay/payment-intent',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      orderId: bookingCode,
      amount: 100000,
      currency: ''
    });
    assert(emptyCurrencyRes.statusCode === 400, 'Test A.2: Empty currency "" rejected with HTTP 400');

    // A.3 Null currency
    const nullCurrencyRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/artopay/payment-intent',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      orderId: bookingCode,
      amount: 100000,
      currency: null
    });
    assert(nullCurrencyRes.statusCode === 400, 'Test A.3: Null currency rejected with HTTP 400');

    // A.4 Non-IDR currency
    const usdCurrencyRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/artopay/payment-intent',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      orderId: bookingCode,
      amount: 100000,
      currency: 'USD'
    });
    assert(usdCurrencyRes.statusCode === 400, 'Test A.4: Foreign currency USD rejected with HTTP 400');

    // TEST B: Builder Authentication Protection
    console.log('--- Test B: Builder Authentication Protection ---');
    // B.1 Taxi routes unauthenticated
    const unauthTaxiRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/builder/taxi-routes',
      method: 'GET'
    });
    assert(unauthTaxiRes.statusCode === 401, 'Test B.1: GET /api/builder/taxi-routes without auth rejected with HTTP 401');

    // B.2 Airport transfers unauthenticated
    const unauthAirportRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/builder/airport-transfers',
      method: 'GET'
    });
    assert(unauthAirportRes.statusCode === 401, 'Test B.2: GET /api/builder/airport-transfers without auth rejected with HTTP 401');

    // B.3 Taxi routes with valid admin token
    const authTaxiRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/builder/taxi-routes',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${admToken}` }
    });
    assert(authTaxiRes.statusCode === 200 && Array.isArray(authTaxiRes.json), 'Test B.3: GET /api/builder/taxi-routes with valid admin token returns HTTP 200 array');

    // B.4 Airport transfers with valid admin token
    const authAirportRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/builder/airport-transfers',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${admToken}` }
    });
    assert(authAirportRes.statusCode === 200 && Array.isArray(authAirportRes.json), 'Test B.4: GET /api/builder/airport-transfers with valid admin token returns HTTP 200 array');

    // TEST C: Static Search for Hardcoded Credentials in Codebase
    console.log('--- Test C: Generic Verification of Zero Hardcoded Credentials ---');
    const assignmentPattern = /(ADMIN_PASSWORD|ADMIN_SECRET_KEY|ARTOPAY_SECRET_KEY|WEBHOOK_SECRET)\s*=\s*['"`][^'"`\n]{4,}['"`]/;
    let hardcodedCount = 0;
    try {
      const checkFiles = ['server.ts'];
      for (const file of checkFiles) {
        const full = path.join(__dirname, '..', file);
        if (fs.existsSync(full)) {
          const content = fs.readFileSync(full, 'utf8');
          content.split('\n').forEach(line => {
            if (assignmentPattern.test(line)) hardcodedCount++;
          });
        }
      }
    } catch (_) {}
    assert(hardcodedCount === 0, 'Test C: Zero hardcoded credentials in server.ts (0 instances)');

  } finally {
    // -----------------------------------------------------------------
    // SECTION 7: FINAL SOURCE SANITIZATION (adminSessions === [] & bookings === [])
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 7: Final Production Database Sanitization ---');
    const finalCleanDb = JSON.parse(originalDbState);
    finalCleanDb.adminSessions = []; // MUST BE EMPTY ARRAY FOR PRODUCTION DEPLOYMENT
    finalCleanDb.bookings = [];      // MUST BE EMPTY ARRAY FOR PRODUCTION DEPLOYMENT
    fs.writeFileSync(DB_PATH, JSON.stringify(finalCleanDb, null, 2));

    const verifiedDiskDb = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    assert(
      Array.isArray(verifiedDiskDb.adminSessions) && verifiedDiskDb.adminSessions.length === 0,
      'Final Sanitization: data/db.json adminSessions is strictly [] (Zero active session tokens in source DB)'
    );
    assert(
      Array.isArray(verifiedDiskDb.bookings) && verifiedDiskDb.bookings.length === 0,
      'Final Sanitization: data/db.json bookings is strictly [] (Zero customer PII in source DB)'
    );
  }

  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${totalPassed + totalFailed} | PASSED: ${totalPassed} | FAILED: ${totalFailed}`);
  console.log('================================================================');

  if (totalFailed > 0) {
    process.exit(1);
  }
}

async function main() {
  // Step 1: Execute static security checks (Zero credential required)
  runStaticSecurityChecks();

  // Step 2: Check if required environment variables exist for live integration testing
  const hasCredentials = Boolean(ADMIN_PASSWORD && ADMIN_EMAIL && WEBHOOK_SECRET);
  if (!hasCredentials) {
    console.log('\n================================================================');
    console.log('ℹ️  LIVE INTEGRATION SUITE: NOT RUN — production credentials intentionally absent from release package.');
    console.log(`STATIC CHECKS SUMMARY: ${totalPassed} PASSED | ${totalFailed} FAILED`);
    console.log('================================================================\n');
    if (totalFailed > 0) {
      process.exit(1);
    }
    return;
  }

  // Step 3: Run full regression suite if live test credentials are configured
  await runZeroRegressionSuite();
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
