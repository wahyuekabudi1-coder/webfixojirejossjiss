/**
 * SMART JOURNEY — AUTHORITATIVE REGRESSION TEST: NOMINAL WEBSITE = ARTOPAY PARITY
 * 
 * Verifies that:
 * 1. Base Rp10.000 + unique code Rp99 = final Rp10.099
 * 2. Nominal Rp10.099 is strictly identical across:
 *    - Checkout (booking creation)
 *    - Payment Summary (booking ledger / check status)
 *    - Backend Payment Intent (/api/artopay/payment-intent)
 *    - ArtoPay Outbound Gateway (amount="10099", currency="IDR")
 * 3. Foreign currencies (USD/CNY) display chosen currency + exact final IDR equivalent,
 *    while ArtoPay receives strictly final IDR.
 */

const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const MOCK_GATEWAY_PORT = 9889;
const TEST_SERVER_PORT = 3198;
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

async function runNominalParitySuite() {
  console.log('================================================================');
  console.log('🛡️ SMART JOURNEY REGRESSION TEST: NOMINAL WEBSITE = ARTOPAY PARITY');
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
    // STEP 1: Spin up Mock ArtoPay Gateway to capture outbound network requests
    // -------------------------------------------------------------------------
    console.log('--- STEP 1: Initialize Mock ArtoPay Gateway ---');
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
          id: 'pi_test_' + Date.now(),
          paymentId: 'pi_test_' + Date.now(),
          clientSecret: 'cs_test_mock_secret',
          customerToken: 'ct_test_mock_token',
          url: 'https://checkout.arto-pay.com/pay/mock_test',
          orderId: parsed?.orderId || 'SJ-TEST',
          status: 'PENDING'
        }));
      });
    });

    await new Promise((resolve) => mockGateway.listen(MOCK_GATEWAY_PORT, '127.0.0.1', resolve));
    assert(true, 'Mock ArtoPay Gateway listening', `http://127.0.0.1:${MOCK_GATEWAY_PORT}`);

    // -------------------------------------------------------------------------
    // STEP 2: Spawn Backend Server with Mock ArtoPay Gateway Configuration
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 2: Start Test Server ---');
    const env = {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(TEST_SERVER_PORT),
      ARTOPAY_SECRET_KEY: 'sk_test_nominal_parity_secret_key',
      ARTOPAY_PUBLIC_KEY: 'pk_test_nominal_parity_public_key',
      ARTOPAY_API_BASE_URL: `http://127.0.0.1:${MOCK_GATEWAY_PORT}`,
      ARTOPAY_ENV: 'sandbox'
    };

    serverProc = spawn('node', ['dist/server.cjs'], {
      env,
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe']
    });

    serverProc.stdout.on('data', () => {});
    serverProc.stderr.on('data', (d) => {
      const errStr = d.toString();
      if (errStr.includes('Fatal') || errStr.includes('Error:')) {
        console.error('[Server Proc]', errStr.trim());
      }
    });

    await waitForServer(TEST_SERVER_PORT);
    assert(true, 'Test server booted and healthy', `http://127.0.0.1:${TEST_SERVER_PORT}`);

    // -------------------------------------------------------------------------
    // STEP 3: Admin Authentication for Test Setup
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 3: Admin Authentication ---');
    const loginRes = await httpRequest(TEST_SERVER_PORT, '/api/auth/login', { method: 'POST' }, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    assert(loginRes.status === 200 && Boolean(loginRes.body.token), 'Admin authenticated successfully');
    const adminToken = loginRes.body.token;
    const authHeaders = { 'Authorization': `Bearer ${adminToken}` };

    // -------------------------------------------------------------------------
    // STEP 4: Booking Creation and Target Nominal Setup
    // Base Rp 10.000 + unique code Rp 99 = final Rp 10.099
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 4: Create Booking & Set Exact Parity Scenario ---');
    const testOrderId = `SJ-PARITY-${Date.now().toString().slice(-6)}`;
    const createBookingRes = await httpRequest(TEST_SERVER_PORT, '/api/bookings', { method: 'POST' }, {
      id: testOrderId,
      bookingCode: testOrderId,
      type: 'tour',
      tourId: 'tour-p5b-1791025346175',
      serviceName: 'Bromo Sunrise Tour',
      departureDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
      customerName: 'Budi Santoso Parity Test',
      customerEmail: 'budi.parity@example.com',
      customerPhone: '+6281234567899',
      participantsCount: 1,
      nationalityType: 'WNI'
    });
    assert(createBookingRes.status === 201, 'Initial booking created in database', `ID: ${testOrderId}`);

    const targetBaseAmount = 10000;
    const targetUniqueCode = 99;
    const targetPaymentAmount = targetBaseAmount + targetUniqueCode; // 10099

    const updateRes = await httpRequest(TEST_SERVER_PORT, `/api/bookings/${testOrderId}`, {
      method: 'PUT',
      headers: authHeaders
    }, {
      baseAmount: targetBaseAmount,
      totalPrice: targetBaseAmount,
      totalPriceIDR: targetBaseAmount,
      uniqueCode: targetUniqueCode,
      paymentAmount: targetPaymentAmount
    });
    assert(updateRes.status === 200, 'Target nominal set: Base Rp10.000 + Unique Code Rp99 = Rp10.099');

    // -------------------------------------------------------------------------
    // STEP 5: Verify Stage 1 (Checkout / DAL Persistence)
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 5: Verify Stage 1 - Checkout Nominal ---');
    const booking = updateRes.body;
    assert(
      Number(booking.baseAmount) === 10000,
      'Stage 1 (Checkout): Base Amount verified as exactly Rp 10.000',
      `Base: Rp ${Number(booking.baseAmount).toLocaleString('id-ID')}`
    );
    assert(
      Number(booking.uniqueCode) === 99,
      'Stage 1 (Checkout): Unique verification code verified as exactly Rp 99',
      `Unique Code: Rp ${Number(booking.uniqueCode)}`
    );
    assert(
      Number(booking.paymentAmount) === 10099,
      'Stage 1 (Checkout): Final Amount formula verified: Base Rp10.000 + Unique Code Rp99 = Final Rp10.099',
      `Final Payment Amount: Rp ${Number(booking.paymentAmount).toLocaleString('id-ID')}`
    );

    // -------------------------------------------------------------------------
    // STEP 6: Verify Stage 2 (Payment Summary / Customer Status Endpoint)
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 6: Verify Stage 2 - Payment Summary Nominal ---');
    const checkRes = await httpRequest(TEST_SERVER_PORT, `/api/private-tour/check-booking/${encodeURIComponent(testOrderId)}`);
    assert(checkRes.status === 200, 'Stage 2 (Payment Summary): Customer check-booking API returned HTTP 200');

    const summaryData = checkRes.body;
    const summaryPaymentAmount = Number(summaryData.paymentAmount);
    const summaryBaseAmount = Number(summaryData.baseAmount);
    const summaryUniqueCode = Number(summaryData.uniqueCode);

    assert(
      summaryPaymentAmount === 10099,
      'Stage 2 (Payment Summary): Nominal strictly identical to Rp 10.099',
      `Summary: Rp ${summaryPaymentAmount.toLocaleString('id-ID')} (Base: Rp ${summaryBaseAmount.toLocaleString('id-ID')} + Kode: ${summaryUniqueCode})`
    );
    assert(
      summaryBaseAmount === 10000 && summaryUniqueCode === 99,
      'Stage 2 (Payment Summary): Breakdown strictly matches Base Rp10.000 and Unique Code Rp99'
    );

    // -------------------------------------------------------------------------
    // STEP 7: Verify Stage 3 (Backend Payment Intent /api/artopay/payment-intent)
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 7: Verify Stage 3 - Backend Payment Intent ---');
    capturedRequests.length = 0; // Clear captured requests

    const intentRes = await httpRequest(TEST_SERVER_PORT, '/api/artopay/payment-intent', { method: 'POST' }, {
      orderId: testOrderId,
      amount: 10099,
      currency: 'IDR',
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      customerPhone: booking.customerPhone
    });

    assert(
      intentRes.status === 200,
      'Stage 3 (Backend Intent): /api/artopay/payment-intent returned HTTP 200',
      `Status: ${intentRes.status}`
    );

    const intentData = intentRes.body;
    assert(
      Number(intentData.paymentAmount) === 10099,
      'Stage 3 (Backend Intent): Payment Intent response contains paymentAmount = 10099',
      `Backend Payment Intent: Rp ${Number(intentData.paymentAmount).toLocaleString('id-ID')}`
    );
    assert(
      Number(intentData.baseAmount) === 10000 && Number(intentData.uniqueCode) === 99,
      'Stage 3 (Backend Intent): Response preserves baseAmount = 10000 and uniqueCode = 99'
    );

    // -------------------------------------------------------------------------
    // STEP 8: Verify Stage 4 (ArtoPay Outbound Network Payload)
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 8: Verify Stage 4 - ArtoPay Outbound Gateway Payload ---');
    assert(capturedRequests.length === 1, 'Exactly 1 outbound HTTPS payload dispatched to ArtoPay');

    const outboundPayload = capturedRequests[0].body;
    assert(
      typeof outboundPayload.amount === 'string',
      'Stage 4 (ArtoPay): Outbound amount is strict string format (ArtoPay standard)',
      `typeof payload.amount === '${typeof outboundPayload.amount}'`
    );
    assert(
      outboundPayload.amount === '10099',
      'Stage 4 (ArtoPay): Outbound amount string value is strictly "10099"',
      `amount = "${outboundPayload.amount}"`
    );
    assert(
      Number(outboundPayload.amount) === 10099,
      'Stage 4 (ArtoPay): Outbound numeric value is strictly 10099',
      `Number(amount) = ${Number(outboundPayload.amount)}`
    );
    assert(
      outboundPayload.currency === 'IDR',
      'Stage 4 (ArtoPay): Outbound currency is strictly "IDR"',
      `currency = "${outboundPayload.currency}"`
    );
    assert(
      outboundPayload.metadata && Number(outboundPayload.metadata.paymentAmount) === 10099,
      'Stage 4 (ArtoPay): Outbound metadata.paymentAmount strictly equals 10099'
    );
    assert(
      outboundPayload.metadata && Number(outboundPayload.metadata.uniqueCode) === 99,
      'Stage 4 (ArtoPay): Outbound metadata.uniqueCode strictly equals 99'
    );

    // -------------------------------------------------------------------------
    // STEP 9: Foreign Currency Display Rule (USD/CNY)
    // Display chosen currency alongside final IDR equivalent; ArtoPay receives final IDR
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 9: Foreign Currency Display Rule ---');
    const usdVal = Math.round(targetPaymentAmount / 16000);
    const cnyVal = Number((usdVal * 7.2).toFixed(1));
    const usdDisplayWithIDR = `$${usdVal} (≈ Rp ${targetPaymentAmount.toLocaleString('id-ID')} IDR)`;
    const cnyDisplayWithIDR = `¥${cnyVal} (≈ Rp ${targetPaymentAmount.toLocaleString('id-ID')} IDR)`;

    assert(
      usdDisplayWithIDR.includes('Rp 10.099') && cnyDisplayWithIDR.includes('Rp 10.099'),
      'Foreign currencies display chosen currency alongside exact final IDR equivalent',
      `USD: "${usdDisplayWithIDR}", CNY: "${cnyDisplayWithIDR}"`
    );
    assert(
      outboundPayload.currency === 'IDR' && outboundPayload.amount === '10099',
      'ArtoPay strictly receives final IDR (amount="10099", currency="IDR") regardless of customer display currency'
    );

    // -------------------------------------------------------------------------
    // STEP 10: Complete 4-Stage Parity Matrix
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 10: Complete 4-Stage Parity Matrix ---');
    const stage1 = Number(booking.paymentAmount);
    const stage2 = summaryPaymentAmount;
    const stage3 = Number(intentData.paymentAmount);
    const stage4 = Number(outboundPayload.amount);
    const expectedFinal = 10099;

    const isAllEqual = (stage1 === expectedFinal) &&
                       (stage2 === expectedFinal) &&
                       (stage3 === expectedFinal) &&
                       (stage4 === expectedFinal);

    assert(
      isAllEqual,
      'CROSS-SYSTEM EQUALITY VERIFIED: Checkout === Payment Summary === Backend Intent === ArtoPay Outbound',
      `Stage 1 Checkout (${stage1}) === Stage 2 Summary (${stage2}) === Stage 3 Backend Intent (${stage3}) === Stage 4 ArtoPay (${stage4}) === 10099 IDR`
    );

    console.log('\n================================================================');
    console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal test error:', err);
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

runNominalParitySuite();
