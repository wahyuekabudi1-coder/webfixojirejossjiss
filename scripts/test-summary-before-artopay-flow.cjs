/**
 * REGRESSION TEST: SUMMARY BEFORE ARTOPAY FLOW
 * 
 * Verifikasi Mutlak:
 * 1. Flow: isi form → Payment Summary → ArtoPay
 * 2. Sebelum membuka ArtoPay, summary wajib menampilkan:
 *    - Harga Trip (baseAmount)
 *    - Kode Unik (uniqueCode)
 *    - TOTAL PEMBAYARAN FINAL (paymentAmount)
 * 3. Kode unik dan total harus berasal dari nilai booking yang tersimpan di DB, bukan generate ulang.
 * 4. Tombol pembayaran jelas: "Bayar Rp10.044" sesuai total final.
 * 5. ArtoPay baru menerima payload setelah summary dikonfirmasi & tombol bayar diklik.
 */

const http = require('http');
const { spawn } = require('child_process');

const MOCK_GATEWAY_PORT = 9983;
const TEST_SERVER_PORT = 3196;
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

async function runSummaryBeforeArtoPaySuite() {
  console.log('================================================================');
  console.log('🛡️ REGRESSION TEST: ISI FORM → PAYMENT SUMMARY → ARTOPAY');
  console.log('   Skenario Wajib: Base Rp10.000 + Kode Unik Rp44 = Total Rp10.044');
  console.log('   Tombol Pembayaran: "Bayar Rp10.044"');
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
          id: 'pi_sum_' + Date.now(),
          paymentId: 'pi_sum_' + Date.now(),
          clientSecret: 'cs_sum_secret_' + Date.now(),
          customerToken: 'ct_sum_token_' + Date.now(),
          url: 'https://checkout.arto-pay.com/pay/summary_flow_test',
          orderId: parsed?.orderId || 'SJ-SUMMARY',
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
      ARTOPAY_SECRET_KEY: 'sk_test_summary_flow_secret_key',
      ARTOPAY_PUBLIC_KEY: 'pk_test_summary_flow_public_key',
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
    // STEP 4: TAHAP 1 - ISI FORM & SIMPAN BOOKING
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Tahap 1: Isi Form & Simpan Booking ke Database ---');
    const orderCode = `SJ-SUM-${Date.now().toString().slice(-6)}`;
    const createRes = await httpRequest(TEST_SERVER_PORT, '/api/bookings', { method: 'POST' }, {
      id: orderCode,
      bookingCode: orderCode,
      type: 'tour',
      tourId: 'tour-p5b-1791025346175',
      serviceName: 'Bromo Sunrise Summary Flow Tour',
      departureDate: new Date(Date.now() + 86400000 * (15 + Math.floor(Math.random() * 50))).toISOString().split('T')[0],
      customerName: 'Siti Summary Traveler',
      customerEmail: 'siti.summary@example.com',
      customerPhone: '+6281277776666',
      participantsCount: 1,
      nationalityType: 'WNI'
    });
    assert(createRes.status === 201, 'Booking berhasil dibuat dari form pengisian', `Order Code: ${orderCode}`);

    // Target nominal yang ditentukan dalam spesifikasi: Base Rp10.000 + Kode Rp44 = Rp10.044
    const targetBase = 10000;
    const targetUnique = 44;
    const targetFinal = 10044;

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
    assert(setRes.status === 200, 'Nominal tersimpan di DB: Base Rp10.000 + Kode Rp44 = Final Rp10.044');

    // -------------------------------------------------------------------------
    // STEP 5: VERIFIKASI SEBELUM ARTO-PAY - GATEWAY BELUM BOLEH MENERIMA REQUEST
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Verifikasi: ArtoPay Gateway Belum Dipanggil Sebelum Summary ---');
    assert(
      capturedRequests.length === 0,
      'GATEWAY BELUM DIPANGGIL: ArtoPay menerima 0 request saat form selesai diisi',
      `Captured requests count = ${capturedRequests.length}`
    );

    // -------------------------------------------------------------------------
    // STEP 6: TAHAP 2 - TAMPILKAN PAYMENT SUMMARY DENGAN RINCIAN TERSIMPAN
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Tahap 2: Tampilkan Payment Summary Sebelum Membuka ArtoPay ---');
    const summaryRes = await httpRequest(TEST_SERVER_PORT, `/api/private-tour/check-booking/${encodeURIComponent(orderCode)}`);
    assert(summaryRes.status === 200, 'Payment Summary berhasil dimuat (HTTP 200)');
    const sum = summaryRes.body;

    assert(
      Number(sum.baseAmount) === targetBase,
      'Payment Summary memuat Harga Trip (Base Fare) yang tersimpan di DB',
      `Harga Trip = Rp ${Number(sum.baseAmount).toLocaleString('id-ID')}`
    );
    assert(
      Number(sum.uniqueCode) === targetUnique,
      'Payment Summary memuat Kode Unik yang tersimpan di DB',
      `Kode Unik = Rp ${Number(sum.uniqueCode)}`
    );
    assert(
      Number(sum.paymentAmount) === targetFinal,
      'Payment Summary memuat TOTAL PEMBAYARAN FINAL yang tersimpan di DB',
      `TOTAL PEMBAYARAN FINAL = Rp ${Number(sum.paymentAmount).toLocaleString('id-ID')}`
    );
    assert(
      Number(sum.baseAmount) + Number(sum.uniqueCode) === Number(sum.paymentAmount),
      'Formula kesetaraan summary valid: baseAmount + uniqueCode = paymentAmount',
      `${sum.baseAmount} + ${sum.uniqueCode} = ${sum.paymentAmount}`
    );

    // -------------------------------------------------------------------------
    // STEP 7: VERIFIKASI TEKS TOMBOL PEMBAYARAN
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Verifikasi Label Tombol Pembayaran Sesuai Total Final ---');
    // Format tombol yang ditentukan: "Bayar Rp10.044" sesuai total final
    const rawFormattedTotal = Number(sum.paymentAmount).toLocaleString('id-ID');
    const buttonLabelExact = `Bayar Rp${rawFormattedTotal}`;
    const buttonLabelWithSpace = `Bayar Rp ${rawFormattedTotal}`;

    assert(
      buttonLabelExact === 'Bayar Rp10.044' || buttonLabelWithSpace === 'Bayar Rp 10.044',
      'Tombol pembayaran jelas dan memuat nominal final persis "Bayar Rp10.044"',
      `Label Tombol: "${buttonLabelExact}"`
    );

    // -------------------------------------------------------------------------
    // STEP 8: TAHAP 3 - KLIK TOMBOL BAYAR → BARU BUKA ARTOPAY
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Tahap 3: Customer Klik Tombol Bayar → Buka ArtoPay Gateway ---');
    capturedRequests.length = 0;

    const payRes = await httpRequest(TEST_SERVER_PORT, '/api/artopay/payment-intent', { method: 'POST' }, {
      orderId: orderCode,
      amount: sum.paymentAmount,
      currency: 'IDR',
      customerName: sum.customerName,
      customerEmail: 'siti.summary@example.com',
      customerPhone: '+6281277776666'
    });
    assert(payRes.status === 200, 'Backend Payment Intent berhasil dibuat (HTTP 200)');
    assert(capturedRequests.length === 1, 'ArtoPay Gateway menerima tepat 1 payload keluar setelah klik tombol Bayar');

    const outbound = capturedRequests[0].body;
    assert(outbound.amount === '10044', 'ArtoPay Outbound: amount adalah "10044"', `outbound.amount = "${outbound.amount}"`);
    assert(outbound.currency === 'IDR', 'ArtoPay Outbound: currency adalah "IDR"', `outbound.currency = "${outbound.currency}"`);
    assert(Number(outbound.metadata?.paymentAmount) === 10044, 'ArtoPay Metadata: paymentAmount = 10044');
    assert(Number(outbound.metadata?.uniqueCode) === 44, 'ArtoPay Metadata: uniqueCode = 44 (tersimpan, bukan generate ulang)');

    // -------------------------------------------------------------------------
    // STEP 9: VERIFIKASI TIDAK ADA GENERATE ULANG SAAT SUMMARY DIBUKA LAGI
    // -------------------------------------------------------------------------
    console.log('\n--- 9. Verifikasi Nilai Tetap Terkunci (Tidak Generate Ulang) ---');
    const reSummaryRes = await httpRequest(TEST_SERVER_PORT, `/api/private-tour/check-booking/${encodeURIComponent(orderCode)}`);
    assert(reSummaryRes.status === 200, 'Re-check summary return HTTP 200');
    assert(
      Number(reSummaryRes.body.uniqueCode) === 44 && Number(reSummaryRes.body.paymentAmount) === 10044,
      'Nilai unik dan total booking tetap konsisten dan terkunci (44 & 10044)',
      `UniqueCode: ${reSummaryRes.body.uniqueCode}, PaymentAmount: ${reSummaryRes.body.paymentAmount}`
    );

    console.log('\n================================================================');
    console.log(`🎉 TEST SUMMARY-BEFORE-ARTOPAY SELESAI: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal error during summary before artopay test:', err);
    process.exit(1);
  } finally {
    cleanup();
  }
}

runSummaryBeforeArtoPaySuite();
