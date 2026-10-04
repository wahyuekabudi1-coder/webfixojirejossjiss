/**
 * SMART JOURNEY — OPEN TRIP PAYMENT PARITY AUDIT
 * "Cek Open Trip saja: pastikan Payment Summary dan ArtoPay memakai total final yang sama. Jika berbeda, perbaiki."
 *
 * Verifies that for Open Trip (Share Tour):
 * 1. Booking creation stores authoritative Base Amount, Discount, Unique Code, and Payment Amount.
 * 2. Payment Summary displays exact Base Fare, Discount, Unique Code, and Total Final.
 * 3. Payment Summary button and ArtoPay trigger use the exact same final total.
 * 4. ArtoPay gateway receives the exact same final total in IDR string and metadata.
 * 5. Values remain locked and identical across retries and reopens.
 */

const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const MOCK_GATEWAY_PORT = 9977;
const TEST_SERVER_PORT = 3192;
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@smartjourney.id').trim();
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || 'admin123').trim();

let passed = 0;
let failed = 0;

function assert(condition, stepName, detail = '') {
  if (condition) {
    console.log(`✅ [PASS] ${stepName}`);
    if (detail) console.log(`   └─ ${detail}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${stepName}`);
    if (detail) console.error(`   └─ ${detail}`);
    failed++;
  }
}

function httpRequest(port, pathUrl, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: port,
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

function waitForServer(port, timeoutMs = 20000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: '/api/health',
        method: 'GET',
        timeout: 1000
      }, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          setTimeout(check, 300);
        }
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Server on port ${port} did not start within ${timeoutMs}ms`));
        } else {
          setTimeout(check, 300);
        }
      });
      req.end();
    };
    check();
  });
}

async function run() {
  console.log('================================================================');
  console.log('🧭 AUDIT KHUSUS OPEN TRIP: PAYMENT SUMMARY = ARTOPAY FINAL TOTAL');
  console.log('   Invarian: Base Amount - Discount + Unique Code === Total Final');
  console.log('================================================================');

  let mockGateway = null;
  let serverProc = null;
  const outboundArtoPayRequests = [];

  const cleanup = () => {
    if (serverProc) {
      try { serverProc.kill('SIGTERM'); } catch(e) {}
    }
    if (mockGateway) {
      try { mockGateway.close(); } catch(e) {}
    }
  };

  try {
    // -------------------------------------------------------------------------
    // 1. Inisialisasi Mock ArtoPay Gateway
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Inisialisasi Mock ArtoPay Gateway ---');
    mockGateway = http.createServer((req, res) => {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(body); } catch(e) {}
        outboundArtoPayRequests.push({
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: parsed,
          rawBody: body
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          code: '200',
          message: 'Success',
          id: 'pi_opentrip_' + Date.now(),
          paymentId: 'pi_opentrip_' + Date.now(),
          clientSecret: 'cs_test_mock',
          customerToken: 'ct_test_mock',
          url: 'https://checkout.arto-pay.com/pay/opentrip_' + Date.now(),
          orderId: parsed?.orderId || 'SJ-OPENTRIP-TEST',
          status: 'PENDING'
        }));
      });
    });

    await new Promise(resolve => mockGateway.listen(MOCK_GATEWAY_PORT, '127.0.0.1', resolve));
    assert(true, 'Mock ArtoPay Gateway Aktif', `http://127.0.0.1:${MOCK_GATEWAY_PORT}`);

    // -------------------------------------------------------------------------
    // 2. Boot Backend Server Uji (Production Mode TSX / Build)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Jalankan Backend Server Uji ---');
    const env = {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(TEST_SERVER_PORT),
      ARTOPAY_SECRET_KEY: 'sk_test_opentrip_secret_key',
      ARTOPAY_PUBLIC_KEY: 'pk_test_opentrip_public_key',
      ARTOPAY_API_BASE_URL: `http://127.0.0.1:${MOCK_GATEWAY_PORT}`,
      ARTOPAY_ENV: 'sandbox'
    };

    serverProc = spawn('node', ['dist/server.cjs'], {
      env,
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe']
    });

    serverProc.stdout.on('data', (d) => {
      const s = d.toString().trim();
      if (s) console.log('[Server Out]', s);
    });
    serverProc.stderr.on('data', (d) => {
      const s = d.toString().trim();
      if (s) console.error('[Server Err]', s);
    });
    serverProc.on('exit', (code, sig) => {
      console.log(`[Server Process Exited] code=${code} signal=${sig}`);
    });

    await waitForServer(TEST_SERVER_PORT);
    assert(true, 'Backend Server Berhasil Boot & Healthy', `http://127.0.0.1:${TEST_SERVER_PORT}`);

    // -------------------------------------------------------------------------
    // 3. Autentikasi Admin & Setup Master Data Promo Code
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Autentikasi Admin ---');
    const loginRes = await httpRequest(TEST_SERVER_PORT, '/api/auth/login', { method: 'POST' }, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    assert(loginRes.status === 200 && Boolean(loginRes.body.token), 'Admin Login Berhasil');
    const adminToken = loginRes.body.token;
    const authHeaders = { 'Authorization': `Bearer ${adminToken}` };

    const promoCode = 'OPENTRIP50K';
    const promoRes = await httpRequest(TEST_SERVER_PORT, '/api/admin/promos', {
      method: 'POST',
      headers: authHeaders
    }, {
      code: promoCode,
      description: 'Diskon 50 Ribu Open Trip',
      discountType: 'fixed',
      discountValue: 50000,
      minSpendIDR: 10000,
      validUntil: '2027-12-31',
      maxUsage: 9999,
      isActive: true
    });
    assert(promoRes.status === 201 || promoRes.status === 409, `Promo Code "${promoCode}" terdaftar di backend`);

    // -------------------------------------------------------------------------
    // 4. Resolve Active Open Trip and Batch
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Dapatkan Paket Open Trip & Batch Keberangkatan ---');
    const batchesRes = await httpRequest(TEST_SERVER_PORT, '/api/batches');
    const batches = Array.isArray(batchesRes.body) ? batchesRes.body : [];
    let activeBatch = batches.find(b => b.availableSeats >= 2 && !b.isArchived && b.status !== 'Closed');

    if (!activeBatch) {
      const tripsRes = await httpRequest(TEST_SERVER_PORT, '/api/trips');
      const trips = Array.isArray(tripsRes.body) ? tripsRes.body : [];
      const activeTrip = trips[0] || { id: 'trip-1' };
      const newBatchRes = await httpRequest(TEST_SERVER_PORT, '/api/batches', {
        method: 'POST',
        headers: authHeaders
      }, {
        tripId: activeTrip.id,
        departureDate: new Date(Date.now() + 86400000 * 35).toISOString().split('T')[0],
        totalSeats: 12,
        availableSeats: 12,
        status: 'Open',
        priceIDR: 450000
      });
      activeBatch = newBatchRes.body?.batch || newBatchRes.body;
    }
    assert(Boolean(activeBatch && activeBatch.id), 'Active Open Trip Batch ditemukan', `Batch ID: ${activeBatch.id}`);

    // =========================================================================
    // SKENARIO A: OPEN TRIP DENGAN DISKON PROMO
    // =========================================================================
    console.log('\n============================================================');
    console.log('📌 SKENARIO A: OPEN TRIP DENGAN DISKON PROMO');
    console.log('============================================================');

    const openTripOrderIdA = `SJ-OPEN-A-${Date.now().toString().slice(-6)}`;
    const openTripPayloadA = {
      id: openTripOrderIdA,
      bookingCode: openTripOrderIdA,
      bookingType: 'shared',
      tourBookingType: 'shared',
      serviceType: 'shared',
      batchId: activeBatch.id,
      tripId: activeBatch.tripId,
      participantsCount: 2,
      fullName: 'Budi Open Trip Explorer',
      customerName: 'Budi Open Trip Explorer',
      email: 'budi.opentrip@example.com',
      customerEmail: 'budi.opentrip@example.com',
      phone: '+6281298765432',
      customerPhone: '+6281298765432',
      nationalityType: 'WNI',
      promoCode: promoCode,
      pickupLocation: 'Meeting Point Stasiun Malang Kota Baru'
    };

    const createResA = await httpRequest(TEST_SERVER_PORT, '/api/bookings', { method: 'POST' }, openTripPayloadA);
    assert(createResA.status === 201, 'Open Trip A: Booking created successfully', `Order Code: ${openTripOrderIdA}`);
    const bookingA = createResA.body;

    const baseA = Number(bookingA.baseAmount);
    const discountA = Number(bookingA.discount || 0);
    const uniqueA = Number(bookingA.uniqueCode);
    const paymentAmountA = Number(bookingA.paymentAmount);

    assert(baseA > 0, `Open Trip A: Base Amount valid (Rp ${baseA.toLocaleString('id-ID')})`);
    assert(discountA === 50000, `Open Trip A: Promo Discount valid (Rp ${discountA.toLocaleString('id-ID')})`);
    assert(uniqueA >= 1 && uniqueA <= 99, `Open Trip A: Unique Code valid (Rp ${uniqueA})`);
    assert(baseA - discountA + uniqueA === paymentAmountA, `Open Trip A Formula: Base - Discount + Unique === Final Payment (${baseA} - ${discountA} + ${uniqueA} = ${paymentAmountA})`);

    // Verify Payment Summary
    console.log('\n--- Verifikasi Payment Summary Skenario A ---');
    const summaryResA = await httpRequest(TEST_SERVER_PORT, `/api/private-tour/check-booking/${openTripOrderIdA}`);
    assert(summaryResA.status === 200, 'Open Trip A: Payment Summary loaded HTTP 200');
    assert(Number(summaryResA.body.baseAmount) === baseA, 'Open Trip A: Summary baseAmount matches stored value');
    assert(Number(summaryResA.body.discount) === discountA, 'Open Trip A: Summary discount matches stored value');
    assert(Number(summaryResA.body.uniqueCode) === uniqueA, 'Open Trip A: Summary uniqueCode matches stored value');
    assert(Number(summaryResA.body.paymentAmount) === paymentAmountA, `Open Trip A: Summary paymentAmount matches stored value (Rp ${paymentAmountA.toLocaleString('id-ID')})`);
    assert(Number(summaryResA.body.finalPaymentAmount) === paymentAmountA, 'Open Trip A: Summary finalPaymentAmount is strictly equal');

    // Simulate Pay Button Click -> ArtoPay Intent
    console.log('\n--- Verifikasi ArtoPay Gateway Skenario A ---');
    outboundArtoPayRequests.length = 0;
    const payResA = await httpRequest(TEST_SERVER_PORT, '/api/artopay/payment-intent', { method: 'POST' }, {
      orderId: openTripOrderIdA,
      amount: paymentAmountA,
      currency: 'IDR'
    });
    assert(payResA.status === 200, 'Open Trip A: Payment Intent created HTTP 200');
    assert(outboundArtoPayRequests.length === 1, 'Open Trip A: ArtoPay Gateway received exactly 1 outbound request');

    const outboundA = outboundArtoPayRequests[0];
    assert(typeof outboundA.body.amount === 'string', 'Open Trip A: Outbound amount is string type');
    assert(outboundA.body.amount === String(paymentAmountA), `Open Trip A: Outbound amount is strictly "${paymentAmountA}"`);
    assert(outboundA.body.currency === 'IDR', 'Open Trip A: Outbound currency is IDR');
    assert(Number(outboundA.body.metadata?.paymentAmount) === paymentAmountA, `Open Trip A: Outbound metadata.paymentAmount is ${paymentAmountA}`);
    assert(Number(outboundA.body.metadata?.uniqueCode) === uniqueA, `Open Trip A: Outbound metadata.uniqueCode is ${uniqueA}`);

    // PARITY CHECK A: Summary === ArtoPay
    assert(
      Number(summaryResA.body.paymentAmount) === Number(outboundA.body.amount) &&
      Number(outboundA.body.amount) === paymentAmountA,
      '🎯 PARITAS 100% SKENARIO A: Payment Summary (Rp ' + summaryResA.body.paymentAmount + ') === ArtoPay (Rp ' + outboundA.body.amount + ')'
    );

    // =========================================================================
    // SKENARIO B: OPEN TRIP TANPA DISKON (BASE + UNIQUE CODE)
    // =========================================================================
    console.log('\n============================================================');
    console.log('📌 SKENARIO B: OPEN TRIP REGULER (TANPA DISKON)');
    console.log('============================================================');

    const openTripOrderIdB = `SJ-OPEN-B-${Date.now().toString().slice(-6)}`;
    const openTripPayloadB = {
      id: openTripOrderIdB,
      bookingCode: openTripOrderIdB,
      bookingType: 'shared',
      tourBookingType: 'shared',
      serviceType: 'shared',
      batchId: activeBatch.id,
      tripId: activeBatch.tripId,
      participantsCount: 1,
      fullName: 'Siti Open Trip Solo',
      customerName: 'Siti Open Trip Solo',
      email: 'siti.opentrip@example.com',
      customerEmail: 'siti.opentrip@example.com',
      phone: '+6281211112222',
      customerPhone: '+6281211112222',
      nationalityType: 'WNI',
      pickupLocation: 'Meeting Point Stasiun Surabaya Gubeng'
    };

    const createResB = await httpRequest(TEST_SERVER_PORT, '/api/bookings', { method: 'POST' }, openTripPayloadB);
    assert(createResB.status === 201, 'Open Trip B: Booking created successfully', `Order Code: ${openTripOrderIdB}`);
    const bookingB = createResB.body;

    const baseB = Number(bookingB.baseAmount);
    const discountB = Number(bookingB.discount || 0);
    const uniqueB = Number(bookingB.uniqueCode);
    const paymentAmountB = Number(bookingB.paymentAmount);

    assert(baseB > 0, `Open Trip B: Base Amount valid (Rp ${baseB.toLocaleString('id-ID')})`);
    assert(discountB === 0, 'Open Trip B: Discount is 0 (No promo applied)');
    assert(uniqueB >= 1 && uniqueB <= 99, `Open Trip B: Unique Code valid (Rp ${uniqueB})`);
    assert(baseB + uniqueB === paymentAmountB, `Open Trip B Formula: Base + Unique === Final Payment (${baseB} + ${uniqueB} = ${paymentAmountB})`);

    // Verify Payment Summary
    console.log('\n--- Verifikasi Payment Summary Skenario B ---');
    const summaryResB = await httpRequest(TEST_SERVER_PORT, `/api/private-tour/check-booking/${openTripOrderIdB}`);
    assert(summaryResB.status === 200, 'Open Trip B: Payment Summary loaded HTTP 200');
    assert(Number(summaryResB.body.baseAmount) === baseB, 'Open Trip B: Summary baseAmount matches stored value');
    assert(Number(summaryResB.body.uniqueCode) === uniqueB, 'Open Trip B: Summary uniqueCode matches stored value');
    assert(Number(summaryResB.body.paymentAmount) === paymentAmountB, `Open Trip B: Summary paymentAmount matches stored value (Rp ${paymentAmountB.toLocaleString('id-ID')})`);

    // Simulate Pay Button Click -> ArtoPay Intent
    console.log('\n--- Verifikasi ArtoPay Gateway Skenario B ---');
    outboundArtoPayRequests.length = 0;
    const payResB = await httpRequest(TEST_SERVER_PORT, '/api/artopay/payment-intent', { method: 'POST' }, {
      orderId: openTripOrderIdB,
      amount: paymentAmountB,
      currency: 'IDR'
    });
    assert(payResB.status === 200, 'Open Trip B: Payment Intent created HTTP 200');
    assert(outboundArtoPayRequests.length === 1, 'Open Trip B: ArtoPay Gateway received exactly 1 outbound request');

    const outboundB = outboundArtoPayRequests[0];
    assert(outboundB.body.amount === String(paymentAmountB), `Open Trip B: Outbound amount is strictly "${paymentAmountB}"`);
    assert(outboundB.body.currency === 'IDR', 'Open Trip B: Outbound currency is IDR');
    assert(Number(outboundB.body.metadata?.paymentAmount) === paymentAmountB, `Open Trip B: Outbound metadata.paymentAmount is ${paymentAmountB}`);

    // PARITY CHECK B: Summary === ArtoPay
    assert(
      Number(summaryResB.body.paymentAmount) === Number(outboundB.body.amount) &&
      Number(outboundB.body.amount) === paymentAmountB,
      '🎯 PARITAS 100% SKENARIO B: Payment Summary (Rp ' + summaryResB.body.paymentAmount + ') === ArtoPay (Rp ' + outboundB.body.amount + ')'
    );

    // =========================================================================
    // SKENARIO C: IMMUTABILITY & RE-OPEN LOCKING TEST
    // =========================================================================
    console.log('\n============================================================');
    console.log('📌 SKENARIO C: KONSISTENSI SAAT SUMMARY DIBUKA ULANG / RETRY');
    console.log('============================================================');

    const reopenRes = await httpRequest(TEST_SERVER_PORT, `/api/private-tour/check-booking/${openTripOrderIdA}`);
    assert(reopenRes.status === 200, 'Open Trip A: Re-check summary returned HTTP 200');
    assert(Number(reopenRes.body.uniqueCode) === uniqueA, `Open Trip A: Unique code is locked and not changed (${uniqueA})`);
    assert(Number(reopenRes.body.paymentAmount) === paymentAmountA, `Open Trip A: Payment amount is locked and not changed (${paymentAmountA})`);

    // Retry payment intent
    outboundArtoPayRequests.length = 0;
    const retryPayRes = await httpRequest(TEST_SERVER_PORT, '/api/artopay/payment-intent', { method: 'POST' }, {
      orderId: openTripOrderIdA,
      amount: paymentAmountA,
      currency: 'IDR'
    });
    assert(retryPayRes.status === 200, 'Open Trip A: Retry payment intent HTTP 200');
    const retryOutbound = outboundArtoPayRequests[0];
    assert(retryOutbound && retryOutbound.body.amount === String(paymentAmountA), `Open Trip A: Retry ArtoPay amount is identical ("${paymentAmountA}")`);

    console.log('\n================================================================');
    console.log(`🎉 HASIL AUDIT OPEN TRIP: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal error during open trip parity audit:', err);
    process.exit(1);
  } finally {
    cleanup();
  }
}

run();
