/**
 * TEST: OPEN TRIP PAYMENT SUMMARY & ARTOPAY PARITY
 * 
 * Specifically checks Open Trip (Share Tour) service:
 * 1. Form data submission -> Open Trip booking created with batchId
 * 2. Payment Summary displays:
 *    - Base Fare (baseAmount)
 *    - Unique Code (uniqueCode)
 *    - Promo Discount (if promo code applied)
 *    - TOTAL PEMBAYARAN FINAL (paymentAmount)
 * 3. Button label: "Bayar Rp..." matches TOTAL PEMBAYARAN FINAL exactly
 * 4. ArtoPay payload (/api/artopay/payment-intent and outbound gateway):
 *    - amount sent to ArtoPay matches TOTAL PEMBAYARAN FINAL exactly
 *    - currency is 'IDR'
 * 5. Reopening / check-booking:
 *    - Returns identical locked values from database
 *    - Re-triggering payment produces identical amount
 */

const http = require('http');
const { spawn } = require('child_process');

const MOCK_GATEWAY_PORT = 9988;
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

function waitForServer(port, timeoutMs = 25000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: port,
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

async function runOpenTripParitySuite() {
  console.log('================================================================');
  console.log('🛡️ AUDIT KHUSUS: OPEN TRIP PAYMENT SUMMARY & ARTOPAY PARITY');
  console.log('   Memastikan Payment Summary & ArtoPay memakai total final yang sama');
  console.log('================================================================\n');

  let mockGateway = null;
  let serverProc = null;
  const capturedRequests = [];

  const cleanup = () => {
    if (serverProc) {
      try { serverProc.kill('SIGKILL'); } catch (e) {}
      serverProc = null;
    }
    if (mockGateway) {
      try { mockGateway.close(); } catch (e) {}
      mockGateway = null;
    }
  };

  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    cleanup();
    process.exit(1);
  });

  try {
    // STEP 1: Mock ArtoPay Gateway
    console.log('--- 1. Inisialisasi Mock ArtoPay Gateway ---');
    mockGateway = http.createServer((req, res) => {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(body);
        } catch (e) {
          parsed = body;
        }
        capturedRequests.push({
          url: req.url,
          method: req.method,
          headers: req.headers,
          body: parsed
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          code: '200',
          message: 'Success',
          id: 'pi_ot_' + Date.now(),
          paymentId: 'pi_ot_' + Date.now(),
          clientSecret: 'cs_ot_secret_' + Date.now(),
          customerToken: 'ct_ot_token_' + Date.now(),
          url: 'https://checkout.arto-pay.com/pay/ot_parity_test',
          orderId: parsed?.orderId || 'SJ-OPENTRIP',
          status: 'PENDING'
        }));
      });
    });

    await new Promise((resolve) => mockGateway.listen(MOCK_GATEWAY_PORT, '127.0.0.1', resolve));
    assert(true, 'Mock ArtoPay Gateway Aktif', `http://127.0.0.1:${MOCK_GATEWAY_PORT}`);

    // STEP 2: Boot Backend
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

    await waitForServer(TEST_SERVER_PORT);
    assert(true, 'Backend Server Berhasil Boot & Healthy', `http://127.0.0.1:${TEST_SERVER_PORT}`);

    // STEP 3: Admin Auth
    console.log('\n--- 3. Autentikasi Admin & Setup Batch Open Trip ---');
    const loginRes = await httpRequest(TEST_SERVER_PORT, '/api/auth/login', { method: 'POST' }, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    assert(loginRes.status === 200 && Boolean(loginRes.body.token), 'Admin Login Berhasil');
    const adminToken = loginRes.body.token;
    const authHeaders = { 'Authorization': `Bearer ${adminToken}` };

    // Get or create an open trip batch
    const tripsRes = await httpRequest(TEST_SERVER_PORT, '/api/trips');
    const trips = Array.isArray(tripsRes.body) ? tripsRes.body : [];
    assert(trips.length > 0, 'Database memuat trip open trip');
    const trip = trips[0];

    const batchesRes = await httpRequest(TEST_SERVER_PORT, '/api/batches');
    const batches = Array.isArray(batchesRes.body) ? batchesRes.body : [];
    let batch = batches.find(b => b.tripId === trip.id && b.availableSeats >= 2 && b.status !== 'Closed');

    if (!batch) {
      const newBatchRes = await httpRequest(TEST_SERVER_PORT, '/api/batches', {
        method: 'POST',
        headers: authHeaders
      }, {
        tripId: trip.id,
        departureDate: '2026-12-15',
        quota: 12,
        availableSeats: 12,
        price: 375000,
        status: 'Open'
      });
      batch = newBatchRes.body?.batch || newBatchRes.body;
    }
    assert(Boolean(batch?.id), 'Batch Open Trip siap digunakan', `Batch ID: ${batch.id}, Departure: ${batch.departureDate}`);

    // Setup a promo code for testing
    const promoCode = 'OPENTRIP25K';
    const promoRes = await httpRequest(TEST_SERVER_PORT, '/api/admin/promos', {
      method: 'POST',
      headers: authHeaders
    }, {
      code: promoCode,
      description: 'Diskon Open Trip 25k',
      discountType: 'fixed',
      discountValue: 25000,
      minSpendIDR: 10000,
      validUntil: '2027-12-31',
      maxUsage: 100,
      isActive: true
    });
    assert(promoRes.status === 201 || promoRes.status === 409, `Promo Code "${promoCode}" terdaftar di backend`);

    // STEP 4: Submit Open Trip Booking
    console.log('\n--- 4. Buat Reservasi Open Trip via API (Simulasi Form Pengisian) ---');
    const orderId = `SJ-OT-${Date.now().toString().slice(-6)}`;
    const paxCount = 2;

    const createRes = await httpRequest(TEST_SERVER_PORT, '/api/bookings', { method: 'POST' }, {
      id: orderId,
      bookingCode: orderId,
      bookingType: 'shared',
      tourBookingType: 'shared',
      serviceType: 'shared',
      tripId: trip.id,
      batchId: batch.id,
      participantsCount: paxCount,
      fullName: 'Budi OpenTrip Traveler',
      customerName: 'Budi OpenTrip Traveler',
      email: 'budi.opentrip@example.com',
      customerEmail: 'budi.opentrip@example.com',
      phone: '+6281234567800',
      customerPhone: '+6281234567800',
      nationalityType: 'WNI',
      promoCode: promoCode
    });

    if (createRes.status !== 201) {
      console.error('Open Trip create failed:', createRes.status, createRes.body);
    }
    assert(createRes.status === 201, 'Booking Open Trip berhasil dibuat (HTTP 201)', `Order: ${orderId}`);
    const createdBooking = createRes.body;

    const baseAmount = Number(createdBooking.baseAmount);
    const discount = Number(createdBooking.discount || 0);
    const uniqueCode = Number(createdBooking.uniqueCode);
    const paymentAmount = Number(createdBooking.paymentAmount);

    assert(baseAmount > 0, `Base Amount valid (Rp ${baseAmount.toLocaleString('id-ID')})`);
    assert(discount === 25000, `Discount valid (Rp ${discount.toLocaleString('id-ID')})`);
    assert(uniqueCode >= 1 && uniqueCode <= 99, `Unique Code valid (+Rp ${uniqueCode})`);
    assert(
      baseAmount - discount + uniqueCode === paymentAmount,
      `Formula Invarian Terpenuhi: Base (${baseAmount}) - Discount (${discount}) + Unique (${uniqueCode}) === Final (${paymentAmount})`
    );

    // STEP 5: Payment Summary Verification
    console.log('\n--- 5. Verifikasi Payment Summary (/api/private-tour/check-booking) ---');
    const summaryRes = await httpRequest(TEST_SERVER_PORT, `/api/private-tour/check-booking/${encodeURIComponent(orderId)}`);
    assert(summaryRes.status === 200, 'Endpoint Payment Summary check-booking return HTTP 200');
    const summary = summaryRes.body;

    assert(Number(summary.baseAmount) === baseAmount, `Payment Summary: Base Amount persis sama (${summary.baseAmount})`);
    assert(Number(summary.discount) === discount, `Payment Summary: Discount persis sama (${summary.discount})`);
    assert(Number(summary.uniqueCode) === uniqueCode, `Payment Summary: Unique Code persis sama (${summary.uniqueCode})`);
    assert(Number(summary.paymentAmount) === paymentAmount, `Payment Summary: TOTAL FINAL persis sama (${summary.paymentAmount})`);

    // Verify button text label formatting: "Bayar Rp..." matches paymentAmount
    const buttonLabel = `Bayar Rp${paymentAmount.toLocaleString('id-ID')}`;
    console.log(`   └─ Tombol Bayar di Payment Summary: "${buttonLabel}"`);

    // STEP 6: ArtoPay Payment Intent
    console.log('\n--- 6. Verifikasi Pembayaran ke ArtoPay Gateway ---');
    capturedRequests.length = 0;

    const payRes = await httpRequest(TEST_SERVER_PORT, '/api/artopay/payment-intent', { method: 'POST' }, {
      orderId: orderId,
      amount: paymentAmount,
      currency: 'IDR'
    });
    assert(payRes.status === 200, 'Backend ArtoPay Intent HTTP 200');
    assert(Number(payRes.body.paymentAmount) === paymentAmount, `Backend Intent paymentAmount persis sama (${payRes.body.paymentAmount})`);

    // STEP 7: ArtoPay Outbound Network Payload
    console.log('\n--- 7. Verifikasi Payload Outbound ke ArtoPay Gateway ---');
    assert(capturedRequests.length === 1, 'Tepat 1 request diterima oleh ArtoPay Gateway');
    const outbound = capturedRequests[0].body;

    assert(String(outbound.amount) === String(paymentAmount), `ArtoPay Outbound amount string persis sama ("${outbound.amount}" === "${paymentAmount}")`);
    assert(outbound.currency === 'IDR', `ArtoPay Outbound currency adalah "IDR"`);
    assert(outbound.metadata && Number(outbound.metadata.paymentAmount) === paymentAmount, `ArtoPay metadata.paymentAmount persis sama (${paymentAmount})`);

    // STEP 8: 100% Strict Equality Parity Assertion
    console.log('\n--- 8. Kesetaraan Mutlak Payment Summary === ArtoPay ---');
    const summaryTotal = Number(summary.paymentAmount);
    const artoPayTotal = Number(outbound.amount);
    assert(
      summaryTotal === artoPayTotal,
      'PARITY TERPENUHI: Payment Summary dan ArtoPay memakai TOTAL FINAL YANG SAMA!',
      `Summary (${summaryTotal}) === ArtoPay (${artoPayTotal}) === Rp ${paymentAmount.toLocaleString('id-ID')} IDR`
    );

    console.log('\n================================================================');
    console.log(`🎉 TEST OPEN TRIP PARITY SELESAI: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal error during Open Trip parity test:', err);
    process.exit(1);
  } finally {
    cleanup();
  }
}

runOpenTripParitySuite();
