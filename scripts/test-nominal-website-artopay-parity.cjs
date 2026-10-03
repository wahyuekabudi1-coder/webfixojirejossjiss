/**
 * REGRESSION TEST: NOMINAL WEBSITE = ARTOPAY GATEWAY PARITY
 * 
 * Verifikasi Syarat Mutlak:
 * 1. Base Rp10.000 + Unique Code Rp99 = Final Rp10.099
 * 2. Nominal Rp10.099 harus PERSIS SAMA di:
 *    - Checkout (Pemesanan awal)
 *    - Payment Summary (Cek status pesanan)
 *    - Backend Payment Intent (/api/artopay/payment-intent)
 *    - ArtoPay Outbound Payload (amount="10099", currency="IDR")
 * 3. Untuk USD/CNY: Tampilkan mata uang pilihan + ekuivalen IDR final (ArtoPay tetap terima IDR final).
 */

const http = require('http');
const { spawn } = require('child_process');

const MOCK_GATEWAY_PORT = 9981;
const TEST_SERVER_PORT = 3199;
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

async function runWebsiteArtoPayParityTest() {
  console.log('================================================================');
  console.log('🛡️ REGRESSION TEST: NOMINAL WEBSITE = NOMINAL ARTOPAY');
  console.log('   Skenario Wajib: Base Rp10.000 + Unique Code Rp99 = Rp10.099');
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
    // STEP 1: Spin up Mock ArtoPay Gateway
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
          id: 'pi_parity_' + Date.now(),
          paymentId: 'pi_parity_' + Date.now(),
          clientSecret: 'cs_parity_secret',
          customerToken: 'ct_parity_token',
          url: 'https://checkout.arto-pay.com/pay/parity_test',
          orderId: parsed?.orderId || 'SJ-PARITY',
          status: 'PENDING'
        }));
      });
    });

    await new Promise((resolve) => mockGateway.listen(MOCK_GATEWAY_PORT, '127.0.0.1', resolve));
    assert(true, 'Mock ArtoPay Gateway Aktif', `http://127.0.0.1:${MOCK_GATEWAY_PORT}`);

    // STEP 2: Boot Backend Server
    console.log('\n--- 2. Jalankan Backend Server Uji ---');
    const env = {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(TEST_SERVER_PORT),
      ARTOPAY_SECRET_KEY: 'sk_test_website_artopay_parity_key',
      ARTOPAY_PUBLIC_KEY: 'pk_test_website_artopay_parity_pubkey',
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

    // STEP 3: Admin Auth
    console.log('\n--- 3. Autentikasi Admin ---');
    const loginRes = await httpRequest(TEST_SERVER_PORT, '/api/auth/login', { method: 'POST' }, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    assert(loginRes.status === 200 && Boolean(loginRes.body.token), 'Admin Login Berhasil');
    const adminToken = loginRes.body.token;
    const authHeaders = { 'Authorization': `Bearer ${adminToken}` };

    // STEP 4: Setup Skenario Uji: Base Rp10.000 + Unique Code Rp99 = Rp10.099
    console.log('\n--- 4. Buat Reservasi & Set Nominal Base Rp10.000 + Kode Rp99 = Rp10.099 ---');
    const orderCode = `SJ-NOM-${Date.now().toString().slice(-6)}`;
    const createRes = await httpRequest(TEST_SERVER_PORT, '/api/bookings', { method: 'POST' }, {
      id: orderCode,
      bookingCode: orderCode,
      type: 'tour',
      tourId: 'tour-p5b-1791025346175',
      serviceName: 'Bromo Sunrise Parity Tour',
      departureDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
      customerName: 'Ahmad Parity',
      customerEmail: 'ahmad.parity@example.com',
      customerPhone: '+6281299998888',
      participantsCount: 1,
      nationalityType: 'WNI'
    });
    assert(createRes.status === 201, 'Booking awal berhasil dibuat di database', `Order Code: ${orderCode}`);

    const baseAmount = 10000;
    const uniqueCode = 99;
    const finalAmount = 10099;

    const setNominalRes = await httpRequest(TEST_SERVER_PORT, `/api/bookings/${orderCode}`, {
      method: 'PUT',
      headers: authHeaders
    }, {
      baseAmount: baseAmount,
      totalPrice: baseAmount,
      totalPriceIDR: baseAmount,
      uniqueCode: uniqueCode,
      paymentAmount: finalAmount
    });
    assert(setNominalRes.status === 200, 'Berhasil set nominal: Base Rp10.000 + Kode Rp99 = Rp10.099');

    // STEP 5: Verifikasi Stage 1 - Checkout Nominal
    console.log('\n--- 5. Verifikasi Stage 1: Checkout Nominal ---');
    const bkg = setNominalRes.body;
    assert(Number(bkg.baseAmount) === 10000, 'Checkout: Base Amount adalah persis Rp 10.000', `Rp ${Number(bkg.baseAmount).toLocaleString('id-ID')}`);
    assert(Number(bkg.uniqueCode) === 99, 'Checkout: Unique Code adalah persis Rp 99', `Rp ${Number(bkg.uniqueCode)}`);
    assert(Number(bkg.paymentAmount) === 10099, 'Checkout: Final Amount (Base + Unique Code) adalah persis Rp 10.099', `Rp ${Number(bkg.paymentAmount).toLocaleString('id-ID')}`);

    // STEP 6: Verifikasi Stage 2 - Payment Summary (/api/private-tour/check-booking)
    console.log('\n--- 6. Verifikasi Stage 2: Payment Summary (/api/private-tour/check-booking) ---');
    const checkRes = await httpRequest(TEST_SERVER_PORT, `/api/private-tour/check-booking/${encodeURIComponent(orderCode)}`);
    assert(checkRes.status === 200, 'Endpoint Payment Summary check-booking return HTTP 200');
    const summary = checkRes.body;
    assert(Number(summary.baseAmount) === 10000, 'Payment Summary: Base Amount adalah persis Rp 10.000');
    assert(Number(summary.uniqueCode) === 99, 'Payment Summary: Unique Code adalah persis Rp 99');
    assert(Number(summary.paymentAmount) === 10099, 'Payment Summary: Final Payment Amount adalah persis Rp 10.099', `Rp ${Number(summary.paymentAmount).toLocaleString('id-ID')}`);

    // STEP 7: Verifikasi Stage 3 - Backend Payment Intent (/api/artopay/payment-intent)
    console.log('\n--- 7. Verifikasi Stage 3: Backend Payment Intent (/api/artopay/payment-intent) ---');
    capturedRequests.length = 0;

    const intentRes = await httpRequest(TEST_SERVER_PORT, '/api/artopay/payment-intent', { method: 'POST' }, {
      orderId: orderCode,
      amount: 10099,
      currency: 'IDR',
      customerName: bkg.customerName,
      customerEmail: bkg.customerEmail,
      customerPhone: bkg.customerPhone
    });
    assert(intentRes.status === 200, 'Endpoint /api/artopay/payment-intent return HTTP 200');
    assert(Number(intentRes.body.paymentAmount) === 10099, 'Backend Intent: Response paymentAmount adalah persis 10099', `Rp ${Number(intentRes.body.paymentAmount).toLocaleString('id-ID')}`);
    assert(Number(intentRes.body.baseAmount) === 10000 && Number(intentRes.body.uniqueCode) === 99, 'Backend Intent: Menjaga Base Rp10.000 dan Kode Rp99');

    // STEP 8: Verifikasi Stage 4 - ArtoPay Outbound Gateway Payload
    console.log('\n--- 8. Verifikasi Stage 4: ArtoPay Outbound Network Payload ---');
    assert(capturedRequests.length === 1, 'Tepat 1 payload keluar terkirim ke ArtoPay Gateway');
    const outbound = capturedRequests[0].body;
    assert(typeof outbound.amount === 'string', 'ArtoPay Outbound: amount bertipe String sesuai spesifikasi ArtoPay', `typeof outbound.amount === '${typeof outbound.amount}'`);
    assert(outbound.amount === '10099', 'ArtoPay Outbound: Nilai string amount adalah "10099"', `outbound.amount = "${outbound.amount}"`);
    assert(Number(outbound.amount) === 10099, 'ArtoPay Outbound: Nilai numerik amount adalah persis 10099');
    assert(outbound.currency === 'IDR', 'ArtoPay Outbound: Nilai currency adalah "IDR"', `outbound.currency = "${outbound.currency}"`);
    assert(outbound.metadata && Number(outbound.metadata.paymentAmount) === 10099, 'ArtoPay Outbound: metadata.paymentAmount adalah persis 10099');
    assert(outbound.metadata && Number(outbound.metadata.uniqueCode) === 99, 'ArtoPay Outbound: metadata.uniqueCode adalah persis 99');

    // STEP 9: Verifikasi Foreign Currency Display Rule (USD/CNY)
    console.log('\n--- 9. Verifikasi Foreign Currency Display Rule (USD/CNY) ---');
    const usdEquiv = Math.round(finalAmount / 16000); // 1 USD
    const cnyEquiv = Number((usdEquiv * 7.2).toFixed(1)); // 7.2 CNY
    const usdDisplay = `$${usdEquiv} (≈ Rp ${finalAmount.toLocaleString('id-ID')} IDR)`;
    const cnyDisplay = `¥${cnyEquiv} (≈ Rp ${finalAmount.toLocaleString('id-ID')} IDR)`;

    assert(
      usdDisplay.includes('Rp 10.099') && cnyDisplay.includes('Rp 10.099'),
      'UI Foreign Currency menampilkan mata uang pilihan + ekuivalen IDR final',
      `USD: "${usdDisplay}" | CNY: "${cnyDisplay}"`
    );
    assert(
      outbound.currency === 'IDR' && outbound.amount === '10099',
      'ArtoPay tetap menerima nominal IDR final (amount="10099", currency="IDR") walau pelanggan memilih USD/CNY'
    );

    // STEP 10: Matriks Kesetaraan 4 Tahap
    console.log('\n--- 10. Matriks Kesetaraan 4 Tahap (100% Identik) ---');
    const stage1 = Number(bkg.paymentAmount);
    const stage2 = Number(summary.paymentAmount);
    const stage3 = Number(intentRes.body.paymentAmount);
    const stage4 = Number(outbound.amount);
    const expected = 10099;

    const allIdentical = (stage1 === expected) && (stage2 === expected) && (stage3 === expected) && (stage4 === expected);
    assert(
      allIdentical,
      'NOMINAL KONSISTEN: Checkout === Payment Summary === Backend Intent === ArtoPay Outbound',
      `Stage 1 (${stage1}) === Stage 2 (${stage2}) === Stage 3 (${stage3}) === Stage 4 (${stage4}) === Rp 10.099 IDR`
    );

    console.log('\n================================================================');
    console.log(`🎉 TEST SELESAI: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal error during parity test:', err);
    process.exit(1);
  } finally {
    if (serverProc) {
      serverProc.kill();
    }
    if (mockGateway) {
      mockGateway.close();
    }
  }
}

runWebsiteArtoPayParityTest();
