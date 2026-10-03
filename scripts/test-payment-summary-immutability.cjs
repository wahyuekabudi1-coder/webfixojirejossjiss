/**
 * REGRESSION TEST: PAYMENT SUMMARY IMMUTABILITY
 * 
 * Verifikasi Mutlak:
 * 1. Payment Summary selalu immutable untuk booking yang sama:
 *    - Harga (baseAmount)
 *    - Diskon (discount) & promoCode
 *    - Kode Unik (uniqueCode)
 *    - TOTAL FINAL (paymentAmount / finalPaymentAmount)
 * 2. Tetap sama saat:
 *    - refresh halaman (refresh)
 *    - navigasi kembali (back)
 *    - buka ulang booking (reopen)
 *    - klik bayar lagi (retry payment)
 * 3. JANGAN generate/recalculate ulang unique code atau total jika booking sudah memiliki nilai tersimpan.
 * 4. ArtoPay wajib selalu memakai total tersimpan tersebut dalam IDR.
 */

const http = require('http');
const { spawn } = require('child_process');

const MOCK_GATEWAY_PORT = 9984;
const TEST_SERVER_PORT = 3195;
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

async function runImmutabilitySuite() {
  console.log('================================================================');
  console.log('🛡️ REGRESSION TEST: PAYMENT SUMMARY IMMUTABILITY');
  console.log('   Skenario: Refresh → Back → Reopen → Retry Payment');
  console.log('   Invarian: Harga, Kode Unik, Diskon, TOTAL FINAL Tetap Sama');
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
    // -------------------------------------------------------------------------
    // STEP 1: Inisialisasi Mock ArtoPay Gateway
    // -------------------------------------------------------------------------
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
          id: 'pi_imm_' + Date.now(),
          paymentId: 'pi_imm_' + Date.now(),
          clientSecret: 'cs_imm_secret_' + Date.now(),
          customerToken: 'ct_imm_token_' + Date.now(),
          url: 'https://checkout.arto-pay.com/pay/immutability_test',
          orderId: parsed?.orderId || 'SJ-IMMUTABLE',
          status: 'PENDING'
        }));
      });
    });

    await new Promise((resolve) => mockGateway.listen(MOCK_GATEWAY_PORT, '127.0.0.1', resolve));
    assert(true, 'Mock ArtoPay Gateway Aktif', `http://127.0.0.1:${MOCK_GATEWAY_PORT}`);

    // -------------------------------------------------------------------------
    // STEP 2: Boot Backend Server Uji (NODE_ENV=test)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Jalankan Backend Server Uji ---');
    const env = {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(TEST_SERVER_PORT),
      ARTOPAY_SECRET_KEY: 'sk_test_immutability_secret_key',
      ARTOPAY_PUBLIC_KEY: 'pk_test_immutability_public_key',
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

    // -------------------------------------------------------------------------
    // STEP 3: Admin Auth
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Autentikasi Admin ---');
    const loginRes = await httpRequest(TEST_SERVER_PORT, '/api/auth/login', { method: 'POST' }, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    assert(loginRes.status === 200 && Boolean(loginRes.body.token), 'Admin Login Berhasil');
    const adminToken = loginRes.body.token;
    const authHeaders = { 'Authorization': `Bearer ${adminToken}` };

    // -------------------------------------------------------------------------
    // STEP 4: Setup Skenario Uji Lengkap (Harga, Diskon, Kode Unik, Total Final)
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Setup Booking Lengkap dengan Diskon Promo & Kode Unik ---');
    // Matriks:
    // Harga Trip (Base): Rp 20.000
    // Diskon Promo: Rp 5.000 (Kode: PROMOSAVE5)
    // Net Payable: Rp 15.000
    // Kode Unik: 42
    // TOTAL FINAL: Rp 15.042
    const targetBase = 20000;
    const targetDiscount = 5000;
    const targetPromoCode = 'PROMOSAVE5';
    const targetUnique = 42;
    const targetFinal = 15042; // (20000 - 5000) + 42 = 15042

    const orderCode = `SJ-IMM-${Date.now().toString().slice(-6)}`;
    const randomDate = new Date(Date.now() + 86400000 * (15 + Math.floor(Math.random() * 50))).toISOString().split('T')[0];

    const createRes = await httpRequest(TEST_SERVER_PORT, '/api/bookings', { method: 'POST' }, {
      id: orderCode,
      bookingCode: orderCode,
      type: 'tour',
      tourId: 'tour-p5b-1791025346175',
      serviceName: 'Bromo Sunrise Immutable Tour',
      departureDate: randomDate,
      customerName: 'Dewi Immutability',
      customerEmail: 'dewi.immutable@example.com',
      customerPhone: '+6281233334444',
      participantsCount: 1,
      nationalityType: 'WNI'
    });
    assert(createRes.status === 201, 'Booking awal berhasil dibuat di database', `Order Code: ${orderCode}`);

    // Update database dengan nilai lengkap terotoritas
    const updateRes = await httpRequest(TEST_SERVER_PORT, `/api/bookings/${orderCode}`, {
      method: 'PUT',
      headers: authHeaders
    }, {
      baseAmount: targetBase,
      totalPrice: targetBase - targetDiscount,
      totalPriceIDR: targetBase - targetDiscount,
      discount: targetDiscount,
      promoCode: targetPromoCode,
      uniqueCode: targetUnique,
      paymentAmount: targetFinal
    });
    assert(updateRes.status === 200, 'Berhasil set nilai tersimpan lengkap di DB');

    // -------------------------------------------------------------------------
    // STEP 5: Buka Summary Pertama Kali
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Buka Payment Summary Pertama Kali ---');
    const summary1 = await httpRequest(TEST_SERVER_PORT, `/api/private-tour/check-booking/${encodeURIComponent(orderCode)}`);
    assert(summary1.status === 200, 'Summary pertama return HTTP 200');
    const s1 = summary1.body;

    assert(Number(s1.baseAmount) === targetBase, `Summary 1: baseAmount = Rp ${targetBase.toLocaleString('id-ID')}`);
    assert(Number(s1.discount) === targetDiscount, `Summary 1: discount = Rp ${targetDiscount.toLocaleString('id-ID')}`);
    assert(s1.promoCode === targetPromoCode, `Summary 1: promoCode = "${targetPromoCode}"`);
    assert(Number(s1.uniqueCode) === targetUnique, `Summary 1: uniqueCode = ${targetUnique}`);
    assert(Number(s1.paymentAmount) === targetFinal, `Summary 1: paymentAmount = Rp ${targetFinal.toLocaleString('id-ID')}`);
    assert(Number(s1.finalPaymentAmount) === targetFinal, `Summary 1: finalPaymentAmount = Rp ${targetFinal.toLocaleString('id-ID')}`);

    // -------------------------------------------------------------------------
    // STEP 6: Simulasi Refresh Halaman (Browser Refresh)
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Siklus 1: Simulasi Refresh Halaman (Browser Reload) ---');
    const summaryRefresh = await httpRequest(TEST_SERVER_PORT, `/api/private-tour/check-booking/${encodeURIComponent(orderCode)}`);
    assert(summaryRefresh.status === 200, 'Summary pasca-refresh return HTTP 200');
    const sRef = summaryRefresh.body;

    assert(Number(sRef.baseAmount) === targetBase, 'Refresh: baseAmount TETAP SAMA (tidak berubah)');
    assert(Number(sRef.discount) === targetDiscount, 'Refresh: discount TETAP SAMA (tidak berubah)');
    assert(sRef.promoCode === targetPromoCode, 'Refresh: promoCode TETAP SAMA (tidak berubah)');
    assert(Number(sRef.uniqueCode) === targetUnique, 'Refresh: uniqueCode TETAP SAMA (tidak berubah/generate ulang)');
    assert(Number(sRef.paymentAmount) === targetFinal, 'Refresh: TOTAL FINAL TETAP SAMA (tidak recalculate)');

    // -------------------------------------------------------------------------
    // STEP 7: Simulasi Navigasi Kembali (Back & Status Check)
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Siklus 2: Simulasi Navigasi Back & Polling Status ---');
    const statusBack = await httpRequest(TEST_SERVER_PORT, `/api/orders/${encodeURIComponent(orderCode)}/payment-status`);
    assert(statusBack.status === 200, 'Endpoint payment-status return HTTP 200');
    const sBack = statusBack.body;

    assert(Number(sBack.baseAmount) === targetBase, 'Back: baseAmount tetap sama di endpoint status');
    assert(Number(sBack.discount) === targetDiscount, 'Back: discount tetap sama di endpoint status');
    assert(Number(sBack.uniqueCode) === targetUnique, 'Back: uniqueCode tetap sama di endpoint status');
    assert(Number(sBack.paymentAmount) === targetFinal, 'Back: paymentAmount tetap sama di endpoint status');

    // -------------------------------------------------------------------------
    // STEP 8: Simulasi Buka Ulang Booking (Reopen via ID & BookingCode)
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Siklus 3: Simulasi Buka Ulang Booking (Reopen) ---');
    const summaryReopen = await httpRequest(TEST_SERVER_PORT, `/api/bookings/check/${encodeURIComponent(orderCode)}`);
    assert(summaryReopen.status === 200, 'Reopen summary return HTTP 200');
    const sReopen = summaryReopen.body;

    assert(Number(sReopen.baseAmount) === targetBase, 'Reopen: baseAmount identik');
    assert(Number(sReopen.discount) === targetDiscount, 'Reopen: discount identik');
    assert(Number(sReopen.uniqueCode) === targetUnique, 'Reopen: uniqueCode identik');
    assert(Number(sReopen.paymentAmount) === targetFinal, 'Reopen: TOTAL FINAL identik');

    // -------------------------------------------------------------------------
    // STEP 9: Klik "Bayar Lagi" (Retry Payment via ArtoPay Intent)
    // -------------------------------------------------------------------------
    console.log('\n--- 9. Siklus 4: Klik "Bayar Lagi" (Retry Payment ke ArtoPay) ---');
    capturedRequests.length = 0;

    const intentRetry1 = await httpRequest(TEST_SERVER_PORT, '/api/artopay/payment-intent', { method: 'POST' }, {
      orderId: orderCode,
      amount: targetFinal,
      currency: 'IDR'
    });
    assert(intentRetry1.status === 200, 'ArtoPay Intent Retry 1 return HTTP 200');
    assert(
      Number(intentRetry1.body.uniqueCode) === targetUnique,
      'Retry 1: uniqueCode TIDAK DI-GENERATE ULANG (tetap 42)',
      `UniqueCode = ${intentRetry1.body.uniqueCode}`
    );
    assert(
      Number(intentRetry1.body.paymentAmount) === targetFinal,
      'Retry 1: paymentAmount TIDAK DI-RECALCULATE (tetap 15042)',
      `PaymentAmount = ${intentRetry1.body.paymentAmount}`
    );
    assert(capturedRequests.length === 1, 'ArtoPay menerima 1 outbound payload');
    assert(
      capturedRequests[0].body.amount === String(targetFinal),
      `ArtoPay Outbound menerima nominal tersimpan: "${targetFinal}"`
    );
    assert(capturedRequests[0].body.currency === 'IDR', 'ArtoPay Outbound menerima currency "IDR"');

    // -------------------------------------------------------------------------
    // STEP 10: Retry Sekali Lagi (Retry Payment 2)
    // -------------------------------------------------------------------------
    console.log('\n--- 10. Siklus 5: Retry Sekali Lagi (Retry 2) ---');
    capturedRequests.length = 0;

    const intentRetry2 = await httpRequest(TEST_SERVER_PORT, '/api/artopay/payment-intent', { method: 'POST' }, {
      orderId: orderCode,
      amount: targetFinal,
      currency: 'IDR'
    });
    assert(intentRetry2.status === 200, 'ArtoPay Intent Retry 2 return HTTP 200');
    assert(
      Number(intentRetry2.body.uniqueCode) === targetUnique,
      'Retry 2: uniqueCode tetap 42',
      `UniqueCode = ${intentRetry2.body.uniqueCode}`
    );
    assert(
      Number(intentRetry2.body.paymentAmount) === targetFinal,
      'Retry 2: paymentAmount tetap 15042',
      `PaymentAmount = ${intentRetry2.body.paymentAmount}`
    );
    assert(
      capturedRequests[0].body.amount === String(targetFinal),
      `ArtoPay Outbound Retry 2 tetap menerima nominal tersimpan: "${targetFinal}"`
    );

    // -------------------------------------------------------------------------
    // STEP 11: Verifikasi Invariansi Matriks 5 Titik
    // -------------------------------------------------------------------------
    console.log('\n--- 11. Verifikasi Matriks Invariansi Mutlak (5 Titik Pengujian) ---');
    const finalSummaryCheck = await httpRequest(TEST_SERVER_PORT, `/api/private-tour/check-booking/${encodeURIComponent(orderCode)}`);
    assert(finalSummaryCheck.status === 200, 'Final check return HTTP 200');
    const f = finalSummaryCheck.body;

    const isAllEqual = 
      Number(f.baseAmount) === targetBase &&
      Number(f.discount) === targetDiscount &&
      f.promoCode === targetPromoCode &&
      Number(f.uniqueCode) === targetUnique &&
      Number(f.paymentAmount) === targetFinal;

    assert(
      isAllEqual,
      'IMMUTABILITY PARITY 100%: Initial === Refresh === Back === Reopen === Retry 1 === Retry 2',
      `Harga: ${f.baseAmount} | Diskon: ${f.discount} | Kode: ${f.uniqueCode} | TOTAL FINAL: ${f.paymentAmount}`
    );

    console.log('\n================================================================');
    console.log(`🎉 TEST IMMUTABILITY SELESAI: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal error during immutability test:', err);
    process.exit(1);
  } finally {
    cleanup();
  }
}

runImmutabilitySuite();
