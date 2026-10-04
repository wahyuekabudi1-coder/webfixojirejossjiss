/**
 * SMART JOURNEY — PRIVATE TOUR PAYMENT PARITY AUDIT
 * "Cek Private Tour saja: pastikan Payment Summary dan ArtoPay memakai total final yang sama."
 *
 * Verifies that for Private Tour:
 * 1. Booking creation stores authoritative Base Amount, Discount, Unique Code, and Payment Amount.
 * 2. Payment Summary displays exact Base Fare, Discount, Unique Code, and Total Final.
 * 3. Payment Summary button and ArtoPay trigger use the exact same final total.
 * 4. ArtoPay gateway receives the exact same final total in IDR string and metadata.
 * 5. Values remain locked and identical across retries and reopens.
 */

const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const MOCK_GATEWAY_PORT = 9976;
const TEST_SERVER_PORT = 3191;
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
  console.log('🧭 AUDIT KHUSUS PRIVATE TOUR: PAYMENT SUMMARY = ARTOPAY FINAL TOTAL');
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
          id: 'pi_privatetour_' + Date.now(),
          paymentId: 'pi_privatetour_' + Date.now(),
          clientSecret: 'cs_test_mock',
          customerToken: 'ct_test_mock',
          url: 'https://checkout.arto-pay.com/pay/privatetour_' + Date.now(),
          orderId: parsed?.orderId || 'SJ-TOUR-TEST',
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
      ARTOPAY_SECRET_KEY: 'sk_test_privatetour_secret_key',
      ARTOPAY_PUBLIC_KEY: 'pk_test_privatetour_public_key',
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

    const promoCode = 'PRIVATETOUR50K';
    const promoRes = await httpRequest(TEST_SERVER_PORT, '/api/admin/promos', {
      method: 'POST',
      headers: authHeaders
    }, {
      code: promoCode,
      description: 'Diskon 50 Ribu Private Tour',
      discountType: 'fixed',
      discountValue: 50000,
      minSpendIDR: 10000,
      validUntil: '2027-12-31',
      maxUsage: 9999,
      isActive: true
    });
    assert(promoRes.status === 201 || promoRes.status === 409, `Promo Code "${promoCode}" terdaftar di backend`);

    // -------------------------------------------------------------------------
    // 4. Resolve Active Private Tour
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Dapatkan Paket Private Tour ---');
    const toursRes = await httpRequest(TEST_SERVER_PORT, '/api/main-tours');
    const mainTours = Array.isArray(toursRes.body) ? toursRes.body : [];
    const tourItem = mainTours.find(t => (t.startingPriceIDR > 0 || t.wniPrice > 0) && (t.wnaPriceIDR > 0 || t.wnaPrice > 0)) || mainTours[0] || { id: 'tour-1', name: 'Private Bromo Sunrise' };
    assert(Boolean(tourItem && tourItem.id), 'Active Private Tour ditemukan', `Tour: ${tourItem.name || tourItem.title}`);

    // =========================================================================
    // SKENARIO 1: PRIVATE TOUR DENGAN DISKON PROMO (WNI)
    // =========================================================================
    console.log('\n============================================================');
    console.log('📌 SKENARIO 1: PRIVATE TOUR DENGAN DISKON PROMO (WNI)');
    console.log('============================================================');

    const tourOrderId1 = `SJ-TOUR-P1-${Date.now().toString().slice(-6)}`;
    const tourDeparture1 = new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0];

    const tourPayload1 = {
      id: tourOrderId1,
      bookingCode: tourOrderId1,
      type: 'tour',
      serviceType: 'tour',
      tourId: tourItem.id,
      tripId: tourItem.id,
      serviceName: tourItem.name || tourItem.title || 'Private Tour',
      departureDate: tourDeparture1,
      customerName: 'Ahmad Private Traveler',
      customerEmail: 'ahmad.private@example.com',
      customerPhone: '+6281234567890',
      participantsCount: 2,
      nationalityType: 'WNI',
      promoCode: promoCode,
      pickupLocation: 'Hotel Tugu Malang'
    };

    const createRes1 = await httpRequest(TEST_SERVER_PORT, '/api/bookings', { method: 'POST' }, tourPayload1);
    assert(createRes1.status === 201, 'Private Tour 1: Booking created successfully', `Order Code: ${tourOrderId1}`);
    const booking1 = createRes1.body;

    const base1 = Number(booking1.baseAmount);
    const discount1 = Number(booking1.discount || 0);
    const unique1 = Number(booking1.uniqueCode);
    const paymentAmount1 = Number(booking1.paymentAmount);

    assert(base1 > 0, `Private Tour 1: Base Amount valid (Rp ${base1.toLocaleString('id-ID')})`);
    assert(discount1 === 50000, `Private Tour 1: Promo Discount valid (Rp ${discount1.toLocaleString('id-ID')})`);
    assert(unique1 >= 1 && unique1 <= 99, `Private Tour 1: Unique Code valid (Rp ${unique1})`);
    assert(base1 - discount1 + unique1 === paymentAmount1, `Private Tour 1 Formula: Base - Discount + Unique === Final Payment (${base1} - ${discount1} + ${unique1} = ${paymentAmount1})`);

    // Verify Payment Summary
    console.log('\n--- Verifikasi Payment Summary Skenario 1 ---');
    const summaryRes1 = await httpRequest(TEST_SERVER_PORT, `/api/private-tour/check-booking/${tourOrderId1}`);
    assert(summaryRes1.status === 200, 'Private Tour 1: Payment Summary loaded HTTP 200');
    assert(Number(summaryRes1.body.baseAmount) === base1, 'Private Tour 1: Summary baseAmount matches stored value');
    assert(Number(summaryRes1.body.discount) === discount1, 'Private Tour 1: Summary discount matches stored value');
    assert(Number(summaryRes1.body.uniqueCode) === unique1, 'Private Tour 1: Summary uniqueCode matches stored value');
    assert(Number(summaryRes1.body.paymentAmount) === paymentAmount1, `Private Tour 1: Summary paymentAmount matches stored value (Rp ${paymentAmount1.toLocaleString('id-ID')})`);
    assert(Number(summaryRes1.body.finalPaymentAmount) === paymentAmount1, 'Private Tour 1: Summary finalPaymentAmount is strictly equal');

    // Simulate Pay Button Click -> ArtoPay Intent
    console.log('\n--- Verifikasi ArtoPay Gateway Skenario 1 ---');
    outboundArtoPayRequests.length = 0;
    const payRes1 = await httpRequest(TEST_SERVER_PORT, '/api/artopay/payment-intent', { method: 'POST' }, {
      orderId: tourOrderId1,
      amount: paymentAmount1,
      currency: 'IDR'
    });
    assert(payRes1.status === 200, 'Private Tour 1: Payment Intent created HTTP 200');
    assert(outboundArtoPayRequests.length === 1, 'Private Tour 1: ArtoPay Gateway received exactly 1 outbound request');

    const outbound1 = outboundArtoPayRequests[0];
    assert(typeof outbound1.body.amount === 'string', 'Private Tour 1: Outbound amount is string type');
    assert(outbound1.body.amount === String(paymentAmount1), `Private Tour 1: Outbound amount is strictly "${paymentAmount1}"`);
    assert(outbound1.body.currency === 'IDR', 'Private Tour 1: Outbound currency is IDR');
    assert(Number(outbound1.body.metadata?.paymentAmount) === paymentAmount1, `Private Tour 1: Outbound metadata.paymentAmount is ${paymentAmount1}`);
    assert(Number(outbound1.body.metadata?.uniqueCode) === unique1, `Private Tour 1: Outbound metadata.uniqueCode is ${unique1}`);

    // PARITY CHECK 1: Summary === ArtoPay
    assert(
      Number(summaryRes1.body.paymentAmount) === Number(outbound1.body.amount) &&
      Number(outbound1.body.amount) === paymentAmount1,
      '🎯 PARITAS 100% SKENARIO 1: Payment Summary (Rp ' + summaryRes1.body.paymentAmount + ') === ArtoPay (Rp ' + outbound1.body.amount + ')'
    );

    // =========================================================================
    // SKENARIO 2: PRIVATE TOUR REGULER TANPA DISKON
    // =========================================================================
    console.log('\n============================================================');
    console.log('📌 SKENARIO 2: PRIVATE TOUR REGULER (TANPA DISKON)');
    console.log('============================================================');

    const tourOrderId2 = `SJ-TOUR-P2-${Date.now().toString().slice(-6)}`;
    const tourDeparture2 = new Date(Date.now() + 86400000 * 32).toISOString().split('T')[0];

    const tourPayload2 = {
      id: tourOrderId2,
      bookingCode: tourOrderId2,
      type: 'tour',
      serviceType: 'tour',
      tourId: tourItem.id,
      tripId: tourItem.id,
      serviceName: tourItem.name || tourItem.title || 'Private Tour',
      departureDate: tourDeparture2,
      customerName: 'Dewi Private Solo',
      customerEmail: 'dewi.private@example.com',
      customerPhone: '+6281277778888',
      participantsCount: 1,
      nationalityType: 'WNI',
      pickupLocation: 'Hotel Majapahit Surabaya'
    };

    const createRes2 = await httpRequest(TEST_SERVER_PORT, '/api/bookings', { method: 'POST' }, tourPayload2);
    assert(createRes2.status === 201, 'Private Tour 2: Booking created successfully', `Order Code: ${tourOrderId2}`);
    const booking2 = createRes2.body;

    const base2 = Number(booking2.baseAmount);
    const discount2 = Number(booking2.discount || 0);
    const unique2 = Number(booking2.uniqueCode);
    const paymentAmount2 = Number(booking2.paymentAmount);

    assert(base2 > 0, `Private Tour 2: Base Amount valid (Rp ${base2.toLocaleString('id-ID')})`);
    assert(discount2 === 0, 'Private Tour 2: Discount is 0 (No promo applied)');
    assert(unique2 >= 1 && unique2 <= 99, `Private Tour 2: Unique Code valid (Rp ${unique2})`);
    assert(base2 + unique2 === paymentAmount2, `Private Tour 2 Formula: Base + Unique === Final Payment (${base2} + ${unique2} = ${paymentAmount2})`);

    // Verify Payment Summary
    console.log('\n--- Verifikasi Payment Summary Skenario 2 ---');
    const summaryRes2 = await httpRequest(TEST_SERVER_PORT, `/api/private-tour/check-booking/${tourOrderId2}`);
    assert(summaryRes2.status === 200, 'Private Tour 2: Payment Summary loaded HTTP 200');
    assert(Number(summaryRes2.body.baseAmount) === base2, 'Private Tour 2: Summary baseAmount matches stored value');
    assert(Number(summaryRes2.body.uniqueCode) === unique2, 'Private Tour 2: Summary uniqueCode matches stored value');
    assert(Number(summaryRes2.body.paymentAmount) === paymentAmount2, `Private Tour 2: Summary paymentAmount matches stored value (Rp ${paymentAmount2.toLocaleString('id-ID')})`);

    // Simulate Pay Button Click -> ArtoPay Intent
    console.log('\n--- Verifikasi ArtoPay Gateway Skenario 2 ---');
    outboundArtoPayRequests.length = 0;
    const payRes2 = await httpRequest(TEST_SERVER_PORT, '/api/artopay/payment-intent', { method: 'POST' }, {
      orderId: tourOrderId2,
      amount: paymentAmount2,
      currency: 'IDR'
    });
    assert(payRes2.status === 200, 'Private Tour 2: Payment Intent created HTTP 200');
    assert(outboundArtoPayRequests.length === 1, 'Private Tour 2: ArtoPay Gateway received exactly 1 outbound request');

    const outbound2 = outboundArtoPayRequests[0];
    assert(outbound2.body.amount === String(paymentAmount2), `Private Tour 2: Outbound amount is strictly "${paymentAmount2}"`);
    assert(outbound2.body.currency === 'IDR', 'Private Tour 2: Outbound currency is IDR');
    assert(Number(outbound2.body.metadata?.paymentAmount) === paymentAmount2, `Private Tour 2: Outbound metadata.paymentAmount is ${paymentAmount2}`);

    // PARITY CHECK 2: Summary === ArtoPay
    assert(
      Number(summaryRes2.body.paymentAmount) === Number(outbound2.body.amount) &&
      Number(outbound2.body.amount) === paymentAmount2,
      '🎯 PARITAS 100% SKENARIO 2: Payment Summary (Rp ' + summaryRes2.body.paymentAmount + ') === ArtoPay (Rp ' + outbound2.body.amount + ')'
    );

    // =========================================================================
    // SKENARIO 3: PRIVATE TOUR WNA (INTERNATIONAL)
    // =========================================================================
    console.log('\n============================================================');
    console.log('📌 SKENARIO 3: PRIVATE TOUR WNA INTERNASIONAL');
    console.log('============================================================');

    const tourOrderId3 = `SJ-TOUR-P3-${Date.now().toString().slice(-6)}`;
    const tourDeparture3 = new Date(Date.now() + 86400000 * 35).toISOString().split('T')[0];

    const tourPayload3 = {
      id: tourOrderId3,
      bookingCode: tourOrderId3,
      type: 'tour',
      serviceType: 'tour',
      tourId: tourItem.id,
      tripId: tourItem.id,
      serviceName: tourItem.name || tourItem.title || 'Private Tour',
      departureDate: tourDeparture3,
      customerName: 'John International Traveler',
      customerEmail: 'john.international@example.com',
      customerPhone: '+14155552671',
      participantsCount: 2,
      nationalityType: 'WNA_EUROPE',
      pickupLocation: 'Juanda Airport Surabaya'
    };

    const createRes3 = await httpRequest(TEST_SERVER_PORT, '/api/bookings', { method: 'POST' }, tourPayload3);
    assert(createRes3.status === 201, 'Private Tour 3: Booking created successfully', `Order Code: ${tourOrderId3}`);
    const booking3 = createRes3.body;

    const base3 = Number(booking3.baseAmount);
    const unique3 = Number(booking3.uniqueCode);
    const paymentAmount3 = Number(booking3.paymentAmount);

    assert(base3 > 0, `Private Tour 3: WNA Base Amount valid (Rp ${base3.toLocaleString('id-ID')})`);
    assert(base3 + unique3 === paymentAmount3, `Private Tour 3 Formula: Base + Unique === Final Payment (${base3} + ${unique3} = ${paymentAmount3})`);

    // Verify Payment Summary
    const summaryRes3 = await httpRequest(TEST_SERVER_PORT, `/api/private-tour/check-booking/${tourOrderId3}`);
    assert(summaryRes3.status === 200, 'Private Tour 3: Payment Summary loaded HTTP 200');
    assert(Number(summaryRes3.body.paymentAmount) === paymentAmount3, `Private Tour 3: Summary paymentAmount matches stored value (Rp ${paymentAmount3.toLocaleString('id-ID')})`);

    // ArtoPay Gateway Check
    outboundArtoPayRequests.length = 0;
    const payRes3 = await httpRequest(TEST_SERVER_PORT, '/api/artopay/payment-intent', { method: 'POST' }, {
      orderId: tourOrderId3,
      amount: paymentAmount3,
      currency: 'IDR'
    });
    assert(payRes3.status === 200, 'Private Tour 3: Payment Intent created HTTP 200');
    const outbound3 = outboundArtoPayRequests[0];
    assert(outbound3.body.amount === String(paymentAmount3), `Private Tour 3: ArtoPay amount is strictly "${paymentAmount3}"`);
    assert(outbound3.body.currency === 'IDR', 'Private Tour 3: ArtoPay received strictly IDR currency');

    // PARITY CHECK 3: Summary === ArtoPay
    assert(
      Number(summaryRes3.body.paymentAmount) === Number(outbound3.body.amount) &&
      Number(outbound3.body.amount) === paymentAmount3,
      '🎯 PARITAS 100% SKENARIO 3: Payment Summary (Rp ' + summaryRes3.body.paymentAmount + ') === ArtoPay (Rp ' + outbound3.body.amount + ')'
    );

    // =========================================================================
    // SKENARIO 4: IMMUTABILITY & RE-OPEN LOCKING TEST
    // =========================================================================
    console.log('\n============================================================');
    console.log('📌 SKENARIO 4: KONSISTENSI SAAT SUMMARY DIBUKA ULANG / RETRY');
    console.log('============================================================');

    const reopenRes = await httpRequest(TEST_SERVER_PORT, `/api/private-tour/check-booking/${tourOrderId1}`);
    assert(reopenRes.status === 200, 'Private Tour 1: Re-check summary returned HTTP 200');
    assert(Number(reopenRes.body.uniqueCode) === unique1, `Private Tour 1: Unique code is locked and not changed (${unique1})`);
    assert(Number(reopenRes.body.paymentAmount) === paymentAmount1, `Private Tour 1: Payment amount is locked and not changed (${paymentAmount1})`);

    // Retry payment intent
    outboundArtoPayRequests.length = 0;
    const retryPayRes = await httpRequest(TEST_SERVER_PORT, '/api/artopay/payment-intent', { method: 'POST' }, {
      orderId: tourOrderId1,
      amount: paymentAmount1,
      currency: 'IDR'
    });
    assert(retryPayRes.status === 200, 'Private Tour 1: Retry payment intent HTTP 200');
    const retryOutbound = outboundArtoPayRequests[0];
    assert(retryOutbound && retryOutbound.body.amount === String(paymentAmount1), `Private Tour 1: Retry ArtoPay amount is identical ("${paymentAmount1}")`);

    console.log('\n================================================================');
    console.log(`🎉 HASIL AUDIT PRIVATE TOUR: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal error during private tour parity audit:', err);
    process.exit(1);
  } finally {
    cleanup();
  }
}

run();
