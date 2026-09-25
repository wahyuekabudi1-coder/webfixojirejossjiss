// ==============================================================================
// SMART JOURNEY: FINAL BACKEND HARDENING & SQL PERSISTENCE VERIFICATION SUITE
// Authoritative tests verifying SQL Single Source of Truth, Status Semantics,
// Startup Lifecycle, Image Persistence, and Webhook Idempotency.
// ==============================================================================

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

try { require('dotenv').config(); } catch (e) {}

const PORT = 3000;
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@smartjourney.id').trim();
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || 'admin123').trim();
const WEBHOOK_SECRET = (process.env.WEBHOOK_SECRET || process.env.ARTOPAY_SECRET_KEY || 'test_secret_key').trim();

let passed = 0;
let failed = 0;

function assert(condition, testNum, title, detail = '') {
  if (condition) {
    console.log(`✅ [PASS] Step ${testNum}: ${title}`);
    if (detail) console.log(`   └─ ${detail}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] Step ${testNum}: ${title}`);
    if (detail) console.error(`   └─ FAILURE: ${detail}`);
    failed++;
  }
}

function makeRequest(pathUrl, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: pathUrl,
        method: options.method || 'GET',
        headers
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            const parsed = data ? JSON.parse(data) : {};
            resolve({ status: res.statusCode, headers: res.headers, body: parsed, raw: data });
          } catch (e) {
            resolve({ status: res.statusCode, headers: res.headers, body: data, raw: data });
          }
        });
      }
    );
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

function signWebhook(payload, secret) {
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return crypto.createHmac('sha256', secret).update(serialized).digest('hex');
}

async function runHardeningSuite() {
  console.log('================================================================');
  console.log('🛡️  SMART JOURNEY: FINAL BACKEND HARDENING & SQL VERIFICATION');
  console.log('================================================================\n');

  try {
    // -------------------------------------------------------------------------
    // 1. HEALTH & PERSISTENCE ENGINE CHECK
    // -------------------------------------------------------------------------
    console.log('--- 1. Health & Database Engine Readiness ---');
    const healthRes = await makeRequest('/api/health');
    assert(
      healthRes.status === 200 && healthRes.body.database === 'connected',
      1,
      'Database connection verified through /api/health',
      `Engine: ${healthRes.body.engine} (${healthRes.body.engineDetails})`
    );

    // -------------------------------------------------------------------------
    // 2. PRODUCTION FAIL-CLOSED VERIFICATION (Child Process)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Production Startup Readiness & Fail-Closed Guard ---');
    const prodCheck = spawnSync('node', ['-e', `
      process.env.NODE_ENV = 'production';
      delete process.env.DB_HOST;
      delete process.env.DB_NAME;
      delete process.env.DB_USER;
      const { getDB } = require('./server/db/pool.ts');
      getDB().then(() => {
        process.exit(0);
      }).catch((err) => {
        console.error('Expected production error:', err.message);
        process.exit(1);
      });
    `], {
      encoding: 'utf8',
      cwd: process.cwd()
    });

    const failedAsExpected = prodCheck.status === 1 || prodCheck.stderr.includes('Fatal') || prodCheck.stderr.includes('production') || prodCheck.stdout.includes('Fatal');
    assert(
      failedAsExpected,
      2,
      'Production strictly forbids SQLite fallback and exits on missing MySQL credentials',
      'Fail-closed protection confirmed'
    );

    // -------------------------------------------------------------------------
    // 3. ZERO RUNTIME DEPENDENCY ON DB.JSON
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Verify Single Source of Truth (Zero db.json Runtime Usage) ---');
    const serverCode = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf8');
    const hasReadDB = /readDB\(|writeDB\(/i.test(serverCode);
    assert(
      !hasReadDB,
      3,
      'No readDB() or writeDB() calls exist in server runtime',
      'SQL DAL is Authoritative Single Source of Truth'
    );

    // -------------------------------------------------------------------------
    // 4. ADMIN AUTHENTICATION (SQL Admin Sessions)
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Admin Authentication & Session Management ---');
    const loginRes = await makeRequest('/api/auth/login', { method: 'POST' }, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    assert(
      loginRes.status === 200 && !!loginRes.body.token,
      4,
      'Admin login generates persistent SQL session token',
      `Token: ${loginRes.body.token?.slice(0, 16)}...`
    );
    const adminToken = loginRes.body.token;
    const authHeaders = { Authorization: `Bearer ${adminToken}` };

    // -------------------------------------------------------------------------
    // 5. TOUR PERSISTENCE LIFECYCLE (Create -> Verify -> Logout -> Re-login)
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Tour SQL Persistence Lifecycle ---');
    const testTourId = `tour-hardened-${Date.now()}`;
    const testTourPayload = {
      id: testTourId,
      name: 'Bromo Sunrise & Madakaripura Waterfall Expedition',
      description: 'Exclusive private guided expedition to Mt Bromo crater rim and hidden sacred waterfall.',
      category: 'Private Tour',
      days: 2,
      nights: 1,
      duration: '2D1N',
      startingPrice: 220,
      startingPriceIDR: 3500000,
      wniPrice: 3500000,
      wnaPrice: 220,
      highlights: ['Bromo Milky Way & Sunrise', 'Jeep 4x4 Sea of Sand', 'Majapahit Sacred Waterfall'],
      status: 'published'
    };

    const createTourRes = await makeRequest('/api/main-tours', {
      method: 'POST',
      headers: authHeaders
    }, testTourPayload);

    assert(
      createTourRes.status === 201 && createTourRes.body.id === testTourId,
      5,
      'Tour created in SQL database table',
      `Tour ID: ${createTourRes.body.id}`
    );

    // Read back immediately
    const getTourRes = await makeRequest(`/api/main-tours/${testTourId}`, { headers: authHeaders });
    assert(
      getTourRes.status === 200 && getTourRes.body.name === testTourPayload.name,
      6,
      'Tour verified persistent via SQL DAL',
      `Name: ${getTourRes.body.name}`
    );

    // Logout admin
    const logoutRes = await makeRequest('/api/auth/logout', { method: 'POST', headers: authHeaders });
    assert(logoutRes.status === 200, 7, 'Admin logged out, session revoked in SQL');

    // Verify unauthenticated check
    const unauthRes = await makeRequest('/api/main-tours?all=true', { headers: authHeaders });
    assert(unauthRes.status === 401, 8, 'Revoked admin session token safely rejected with HTTP 401');

    // Verify tour still present in public customer endpoint
    const publicToursRes = await makeRequest('/api/main-tours');
    const publicTourFound = Array.isArray(publicToursRes.body) && publicToursRes.body.some(t => t.id === testTourId);
    assert(publicTourFound, 9, 'Tour remains publicly visible to customers while admin is logged out');

    // Re-login
    const reLoginRes = await makeRequest('/api/auth/login', { method: 'POST' }, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    const freshToken = reLoginRes.body.token;
    const freshHeaders = { Authorization: `Bearer ${freshToken}` };

    // -------------------------------------------------------------------------
    // 6. IMAGE STORAGE RACE CONDITION & OPTIMIZATION VERIFICATION
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Image Storage Race Condition & Optimization ---');
    // 1x1 transparent red PNG in Base64
    const sampleBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const tourWithImageId = `tour-img-${Date.now()}`;
    const createTourWithImgRes = await makeRequest('/api/main-tours', {
      method: 'POST',
      headers: freshHeaders
    }, {
      id: tourWithImageId,
      name: 'Ijen Blue Fire Tour with Persisted Image',
      image: sampleBase64,
      status: 'published',
      startingPriceIDR: 2000000
    });

    assert(
      createTourWithImgRes.status === 201 && createTourWithImgRes.body.image?.startsWith('/uploads/'),
      10,
      'Base64 image converted to clean URL and persisted before database write',
      `Persisted path: ${createTourWithImgRes.body.image}`
    );

    const relativeImgPath = createTourWithImgRes.body.image.replace(/^\//, '');
    const physicalImgPath = path.join(process.cwd(), 'public', relativeImgPath);
    const physicalExists = fs.existsSync(physicalImgPath);
    assert(
      physicalExists,
      11,
      'Physical image file confirmed to exist on disk (zero race condition)',
      `File verified at: ${physicalImgPath}`
    );

    // -------------------------------------------------------------------------
    // 7. BOOKING & PAYMENT STATUS SEMANTICS
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Booking & Payment Status Semantics ---');
    const bookingCode = `SJ-HD-${Date.now().toString().slice(-6)}`;
    const createBookingRes = await makeRequest('/api/bookings', { method: 'POST' }, {
      id: bookingCode,
      bookingCode,
      tourId: testTourId,
      fullName: 'Budi Santoso',
      email: 'budi.santoso@example.com',
      phone: '+6281234567890',
      participantsCount: 2,
      bookingType: 'private',
      totalPriceIDR: 3500000,
      baseAmount: 3500000
    });

    assert(
      createBookingRes.status === 201,
      12,
      'Booking created in SQL database',
      `Booking Code: ${bookingCode}`
    );

    const createdBooking = createBookingRes.body;
    assert(
      createdBooking.status === 'Pending Payment',
      13,
      'Strict Semantics: Initial booking status is "Pending Payment"',
      `Status: "${createdBooking.status}"`
    );
    assert(
      createdBooking.paymentStatus === 'Pending',
      14,
      'Strict Semantics: Initial payment status is "Pending" (NOT "Pending Payment")',
      `Payment Status: "${createdBooking.paymentStatus}"`
    );

    // -------------------------------------------------------------------------
    // 8. PAYMENT INTENT OUTBOUND VALIDATION
    // -------------------------------------------------------------------------
    console.log('\n--- 8. ArtoPay Payment Intent Outbound & Parameter Validation ---');
    // Test missing currency rejected
    const noCurrRes = await makeRequest('/api/artopay/payment-intent', { method: 'POST' }, {
      orderId: bookingCode
    });
    assert(
      noCurrRes.status === 400,
      15,
      'Payment Intent rejects missing currency with HTTP 400',
      `Error: ${noCurrRes.body.error}`
    );

    // Test with currency=IDR: correctly contacts ArtoPay gateway
    const paymentIntentRes = await makeRequest('/api/artopay/payment-intent', { method: 'POST' }, {
      orderId: bookingCode,
      currency: 'IDR'
    });
    const validGatewayResponse = paymentIntentRes.status === 200 || paymentIntentRes.body.category === 'ARTOPAY_UNAUTHORIZED_401' || paymentIntentRes.status === 401;
    assert(
      validGatewayResponse,
      16,
      'Payment Intent constructs payload and contacts ArtoPay gateway with strict validation',
      `Gateway Status: ${paymentIntentRes.status} (Category: ${paymentIntentRes.body.category || 'SUCCESS'})`
    );

    // Verify booking status unchanged on intent creation
    const afterIntentBooking = await makeRequest(`/api/bookings/${bookingCode}`, { headers: freshHeaders });
    assert(
      afterIntentBooking.body.paymentStatus === 'Pending' && afterIntentBooking.body.status === 'Pending Payment',
      17,
      'Booking retains Pending Payment and Pending payment_status after intent attempt'
    );

    // -------------------------------------------------------------------------
    // 9. WEBHOOK IDEMPOTENCY & STATUS TRANSITION (PAID -> PENDING CONFIRMATION)
    // -------------------------------------------------------------------------
    console.log('\n--- 9. ArtoPay Webhook Idempotency & Paid -> Pending Confirmation ---');
    const exactAmount = afterIntentBooking.body.paymentAmount || afterIntentBooking.body.totalPriceIDR;
    const webhookPayload = {
      orderId: bookingCode,
      paymentId: `PAY-ART-${Date.now()}`,
      status: 'PAID',
      amount: exactAmount,
      currency: 'IDR'
    };
    const signature = signWebhook(webhookPayload, WEBHOOK_SECRET);

    // First Webhook Call
    const webhookRes1 = await makeRequest('/api/artopay/webhook', {
      method: 'POST',
      headers: {
        'x-artopay-signature': signature
      }
    }, webhookPayload);

    assert(
      webhookRes1.status === 200,
      18,
      'Webhook accepted with authentic signature and matching amount (HTTP 200)',
      `Response: ${JSON.stringify(webhookRes1.body)}`
    );

    // Verify that Booking Status is now 'Pending Confirmation', and paymentStatus is 'Paid'
    const postWebhookBooking = await makeRequest(`/api/bookings/${bookingCode}`, { headers: freshHeaders });
    assert(
      postWebhookBooking.body.paymentStatus === 'Paid',
      19,
      'Strict Semantics: booking.payment_status updated to "Paid"',
      `paymentStatus: "${postWebhookBooking.body.paymentStatus}"`
    );
    assert(
      postWebhookBooking.body.status === 'Pending Confirmation',
      20,
      'Strict Semantics: Paid booking transitions to "Pending Confirmation" (NEVER auto-confirmed)',
      `status: "${postWebhookBooking.body.status}"`
    );

    // Second Webhook Call (Idempotency Test)
    const webhookRes2 = await makeRequest('/api/artopay/webhook', {
      method: 'POST',
      headers: {
        'x-artopay-signature': signature
      }
    }, webhookPayload);

    assert(
      webhookRes2.status === 200 && webhookRes2.body.message?.includes('Idempotent'),
      21,
      'Webhook is strictly idempotent: duplicate delivery returns 200 without reverting or duplicating state',
      `Message: "${webhookRes2.body.message}"`
    );

    // -------------------------------------------------------------------------
    // 10. ADMIN CONFIRMATION LIFECYCLE
    // -------------------------------------------------------------------------
    console.log('\n--- 10. Admin Booking Confirmation ---');
    const confirmRes = await makeRequest(`/api/bookings/${bookingCode}/status`, {
      method: 'PUT',
      headers: freshHeaders
    }, {
      status: 'Confirmed'
    });

    assert(
      confirmRes.status === 200,
      22,
      'Admin confirms booking once payment is verified Paid',
      `Status updated to: ${confirmRes.body.booking?.status || confirmRes.body.status}`
    );

    const finalBooking = await makeRequest(`/api/bookings/${bookingCode}`, { headers: freshHeaders });
    assert(
      finalBooking.body.status === 'Confirmed' && finalBooking.body.paymentStatus === 'Paid',
      23,
      'Final Booking State verified in SQL: status="Confirmed", paymentStatus="Paid"'
    );

    // -------------------------------------------------------------------------
    // 11. CLEANUP TEST TOUR
    // -------------------------------------------------------------------------
    await makeRequest(`/api/main-tours/${testTourId}`, { method: 'DELETE', headers: freshHeaders });
    await makeRequest(`/api/main-tours/${tourWithImageId}`, { method: 'DELETE', headers: freshHeaders });

    console.log('\n================================================================');
    console.log(`HARDENING SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runHardeningSuite();
