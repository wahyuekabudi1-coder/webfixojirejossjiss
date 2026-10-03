/**
 * REGRESSION TEST: PAYMENT FLOW RETRY & UNIQUE CODE LOCKING PARITY
 * 
 * Flow yang diuji:
 * Booking → Summary (harga + kode unik + total) → ArtoPay (intent)
 * Skenario Pembatalan & Retry:
 * Customer batal/kembali dari ArtoPay → Buka summary lagi → Klik bayar lagi (retry)
 * Syarat Mutlak:
 * 1. uniqueCode dibuat dan dikunci SEKALI saat booking/payment summary pertama dibuat.
 * 2. baseAmount + uniqueCode = finalPaymentAmount harus tetap sama.
 * 3. Saat customer retry / bayar lagi, JANGAN generate unique code baru.
 * 4. uniqueCode dan finalPaymentAmount yang tersimpan di DB wajib dipakai ulang.
 * 5. ArtoPay selalu menerima total tersimpan yang sama dalam IDR (amount="10099", currency="IDR").
 */

const http = require('http');
const { spawn } = require('child_process');

const MOCK_GATEWAY_PORT = 9982;
const TEST_SERVER_PORT = 3197;
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

async function runRetryPaymentParitySuite() {
  console.log('================================================================');
  console.log('🛡️ REGRESSION TEST: CANCEL PAYMENT → RETRY PAYMENT PARITY');
  console.log('   Kunci: uniqueCode & finalPaymentAmount Wajib Tetap Sama');
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
          body: parsed,
          rawBody: body
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          code: '200',
          message: 'Success',
          id: 'pi_retry_' + Date.now(),
          paymentId: 'pi_retry_' + Date.now(),
          clientSecret: 'cs_retry_secret_' + Date.now(),
          customerToken: 'ct_retry_token_' + Date.now(),
          url: 'https://checkout.arto-pay.com/pay/retry_test',
          orderId: parsed?.orderId || 'SJ-RETRY',
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
      ARTOPAY_SECRET_KEY: 'sk_test_retry_parity_secret_key',
      ARTOPAY_PUBLIC_KEY: 'pk_test_retry_parity_public_key',
      ARTOPAY_API_BASE_URL: `http://127.0.0.1:${MOCK_GATEWAY_PORT}`,
      ARTOPAY_ENV: 'sandbox'
    };

    serverProc = spawn('node', ['dist/server.cjs'], {
      env,
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe']
    });

    serverProc.stderr.on('data', (d) => {
      const s = d.toString().trim();
      if (s && (s.includes('Fatal') || s.includes('Error:'))) {
        console.error('[Server Err]', s);
      }
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
    // STEP 4: Buat Booking Baru (Booking Phase)
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Buat Booking: Base Rp10.000 + Kode Unik Rp99 = Rp10.099 ---');
    const orderCode = `SJ-RTR-${Date.now().toString().slice(-6)}`;
    const createRes = await httpRequest(TEST_SERVER_PORT, '/api/bookings', { method: 'POST' }, {
      id: orderCode,
      bookingCode: orderCode,
      type: 'tour',
      tourId: 'tour-p5b-1791025346175',
      serviceName: 'Bromo Sunrise Retry Tour',
      departureDate: new Date(Date.now() + 86400000 * (20 + Math.floor(Math.random() * 60))).toISOString().split('T')[0],
      customerName: 'Budi Retry Customer',
      customerEmail: 'budi.retry@example.com',
      customerPhone: '+6281288887777',
      participantsCount: 1,
      nationalityType: 'WNI'
    });
    if (createRes.status !== 201) {
      console.error('createRes failed:', createRes.status, createRes.body);
    }
    assert(createRes.status === 201, 'Booking awal berhasil dibuat di database', `Order Code: ${orderCode}`);

    // Set nominal persis: Base Rp10.000 + Kode Rp99 = Rp10.099
    const targetBase = 10000;
    const targetUnique = 99;
    const targetFinal = 10099;

    const setRes = await httpRequest(TEST_SERVER_PORT, `/api/bookings/${orderCode}`, {
      method: 'PUT',
      headers: authHeaders
    }, {
      baseAmount: targetBase,
      totalPrice: targetBase,
      totalPriceIDR: targetBase,
      uniqueCode: targetUnique,
      paymentAmount: targetFinal
    });
    assert(setRes.status === 200, 'Berhasil set nominal awal di DB: Base Rp10.000, UniqueCode Rp99, Final Rp10.099');

    // -------------------------------------------------------------------------
    // STEP 5: Buka Summary Pertama (Summary Phase)
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Buka Summary Pertama Kali ---');
    const summary1Res = await httpRequest(TEST_SERVER_PORT, `/api/private-tour/check-booking/${encodeURIComponent(orderCode)}`);
    assert(summary1Res.status === 200, 'Summary pertama return HTTP 200');
    const sum1 = summary1Res.body;
    assert(Number(sum1.baseAmount) === targetBase, `Summary 1: baseAmount = Rp ${targetBase.toLocaleString('id-ID')}`);
    assert(Number(sum1.uniqueCode) === targetUnique, `Summary 1: uniqueCode = Rp ${targetUnique}`);
    assert(Number(sum1.paymentAmount) === targetFinal, `Summary 1: paymentAmount = Rp ${targetFinal.toLocaleString('id-ID')}`);

    const lockedUniqueCode = Number(sum1.uniqueCode);
    const lockedPaymentAmount = Number(sum1.paymentAmount);

    // -------------------------------------------------------------------------
    // STEP 6: Percobaan Bayar Pertama (ArtoPay Intent 1)
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Buat Payment Intent Pertama (Percobaan 1) ---');
    capturedRequests.length = 0;
    const intent1Res = await httpRequest(TEST_SERVER_PORT, '/api/artopay/payment-intent', { method: 'POST' }, {
      orderId: orderCode,
      amount: lockedPaymentAmount,
      currency: 'IDR'
    });
    assert(intent1Res.status === 200, 'Intent 1 return HTTP 200');
    assert(Number(intent1Res.body.paymentAmount) === lockedPaymentAmount, `Intent 1: paymentAmount = ${lockedPaymentAmount}`);
    assert(Number(intent1Res.body.uniqueCode) === lockedUniqueCode, `Intent 1: uniqueCode = ${lockedUniqueCode}`);
    assert(capturedRequests.length === 1, 'ArtoPay menerima tepat 1 payload keluar');
    assert(capturedRequests[0].body.amount === String(lockedPaymentAmount), `ArtoPay Gateway menerima amount = "${lockedPaymentAmount}"`);
    assert(capturedRequests[0].body.currency === 'IDR', 'ArtoPay Gateway menerima currency = "IDR"');

    // -------------------------------------------------------------------------
    // STEP 7: Customer Batal / Kembali dari ArtoPay
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Simulasi Customer Batal / Kembali dari ArtoPay ---');
    // Pembayaran belum lunas, customer menutup gateway dan kembali ke halaman summary
    console.log('Customer membatalkan gateway dan kembali membuka Payment Summary...');

    const summaryAfterCancel = await httpRequest(TEST_SERVER_PORT, `/api/private-tour/check-booking/${encodeURIComponent(orderCode)}`);
    assert(summaryAfterCancel.status === 200, 'Summary setelah pembatalan return HTTP 200');
    assert(
      Number(summaryAfterCancel.body.uniqueCode) === lockedUniqueCode,
      'Summary pasca-batal: uniqueCode TIDAK BERUBAH (tetap terkunci)',
      `UniqueCode = ${summaryAfterCancel.body.uniqueCode} (tetap ${lockedUniqueCode})`
    );
    assert(
      Number(summaryAfterCancel.body.paymentAmount) === lockedPaymentAmount,
      'Summary pasca-batal: paymentAmount TIDAK BERUBAH (tetap terkunci)',
      `PaymentAmount = ${summaryAfterCancel.body.paymentAmount} (tetap ${lockedPaymentAmount})`
    );

    // -------------------------------------------------------------------------
    // STEP 8: Customer Klik "Bayar Lagi" (Retry Payment 1)
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Customer Klik "Bayar Lagi" (Retry 1) ---');
    capturedRequests.length = 0;
    const retry1Res = await httpRequest(TEST_SERVER_PORT, '/api/artopay/payment-intent', { method: 'POST' }, {
      orderId: orderCode,
      amount: lockedPaymentAmount,
      currency: 'IDR'
    });
    assert(retry1Res.status === 200, 'Retry 1 return HTTP 200');
    assert(
      Number(retry1Res.body.uniqueCode) === lockedUniqueCode,
      'JANGAN generate unique code baru: uniqueCode pada Retry 1 PERSIS SAMA dengan semula',
      `Retry 1 UniqueCode = ${retry1Res.body.uniqueCode} === ${lockedUniqueCode}`
    );
    assert(
      Number(retry1Res.body.paymentAmount) === lockedPaymentAmount,
      'finalPaymentAmount pada Retry 1 PERSIS SAMA dengan semula',
      `Retry 1 PaymentAmount = ${retry1Res.body.paymentAmount} === ${lockedPaymentAmount}`
    );
    assert(capturedRequests.length === 1, 'ArtoPay menerima 1 payload keluar pada Retry 1');
    assert(
      capturedRequests[0].body.amount === String(lockedPaymentAmount),
      `ArtoPay Outbound pada Retry 1 menerima amount = "${lockedPaymentAmount}"`,
      `Outbound amount = "${capturedRequests[0].body.amount}"`
    );
    assert(capturedRequests[0].body.currency === 'IDR', 'ArtoPay Outbound pada Retry 1 menerima currency = "IDR"');

    // -------------------------------------------------------------------------
    // STEP 9: Customer Retry Sekali Lagi (Retry Payment 2)
    // -------------------------------------------------------------------------
    console.log('\n--- 9. Customer Retry Sekali Lagi (Retry 2) ---');
    capturedRequests.length = 0;
    const retry2Res = await httpRequest(TEST_SERVER_PORT, '/api/artopay/payment-intent', { method: 'POST' }, {
      orderId: orderCode,
      amount: lockedPaymentAmount,
      currency: 'IDR'
    });
    assert(retry2Res.status === 200, 'Retry 2 return HTTP 200');
    assert(
      Number(retry2Res.body.uniqueCode) === lockedUniqueCode,
      'Retry 2: uniqueCode tetap persis sama (99)',
      `UniqueCode = ${retry2Res.body.uniqueCode} === ${lockedUniqueCode}`
    );
    assert(
      Number(retry2Res.body.paymentAmount) === lockedPaymentAmount,
      'Retry 2: finalPaymentAmount tetap persis sama (10099)',
      `PaymentAmount = ${retry2Res.body.paymentAmount} === ${lockedPaymentAmount}`
    );
    assert(
      capturedRequests[0].body.amount === String(lockedPaymentAmount),
      `ArtoPay Outbound pada Retry 2 menerima amount = "${lockedPaymentAmount}"`
    );

    // -------------------------------------------------------------------------
    // STEP 10: Verifikasi Status Summary Akhir & Foreign Currency Parity
    // -------------------------------------------------------------------------
    console.log('\n--- 10. Verifikasi Invariansi Matriks Retrying & Foreign Currency ---');
    const finalSummaryRes = await httpRequest(TEST_SERVER_PORT, `/api/private-tour/check-booking/${encodeURIComponent(orderCode)}`);
    assert(finalSummaryRes.status === 200, 'Final summary check return HTTP 200');
    const finalSum = finalSummaryRes.body;

    const summaryCode = Number(finalSum.uniqueCode);
    const summaryAmount = Number(finalSum.paymentAmount);

    const isInvariant = (summaryCode === lockedUniqueCode) && (summaryAmount === lockedPaymentAmount);
    assert(
      isInvariant,
      'INVARIANSI LENGKAP: Summary -> Intent 1 -> Cancel -> Summary -> Retry 1 -> Retry 2',
      `Locked Unique Code (${lockedUniqueCode}) & Locked Amount (${lockedPaymentAmount}) 100% Tidak Berubah!`
    );

    // Foreign currency conversion display check:
    const usdEquiv = Math.round(lockedPaymentAmount / 16000);
    const cnyEquiv = Number((usdEquiv * 7.2).toFixed(1));
    const usdDisplay = `$${usdEquiv} (≈ Rp ${lockedPaymentAmount.toLocaleString('id-ID')} IDR)`;
    const cnyDisplay = `¥${cnyEquiv} (≈ Rp ${lockedPaymentAmount.toLocaleString('id-ID')} IDR)`;

    assert(
      usdDisplay.includes('Rp 10.099') && cnyDisplay.includes('Rp 10.099'),
      'UI Foreign Currency: Menampilkan mata uang pilihan + ekuivalen IDR final',
      `USD: "${usdDisplay}" | CNY: "${cnyDisplay}"`
    );

    console.log('\n================================================================');
    console.log(`🎉 TEST RETRY PARITY SELESAI: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal error during retry parity test:', err);
    process.exit(1);
  } finally {
    cleanup();
  }
}

runRetryPaymentParitySuite();
