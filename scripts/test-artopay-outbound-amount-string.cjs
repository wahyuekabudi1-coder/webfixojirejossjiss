/**
 * SMART JOURNEY — REGRESSION TEST: ARTOPAY OUTBOUND AMOUNT TYPE = STRING
 * 
 * Verifies that outbound payload to ArtoPay API:
 * 1. Has typeof payload.amount === 'string'
 * 2. Has payload.amount === String(expectedPaymentAmount)
 * 3. Preserves exact numeric equality: Number(payload.amount) === expectedPaymentAmount
 * 4. Internal calculations remain numbers, strictly preserving baseAmount + uniqueCode
 * 5. Raw HTTP body contains "amount": "<string-value>" and NOT numeric "amount": <number>
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const MOCK_GATEWAY_PORT = 9876;
const TEST_SERVER_PORT = 3199;
const DB_PATH = path.join(process.cwd(), 'data', 'db.json');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${message}`);
    failedTests++;
  }
}

function httpRequest(port, method, pathUrl, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: port,
      path: pathUrl,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed, rawData: data });
      });
    });
    req.on('error', (err) => reject(err));
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

function waitForServer(port, timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: port,
        path: '/api/db',
        method: 'GET',
        timeout: 1000
      }, (res) => {
        resolve();
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

async function runSuite() {
  console.log('====================================================');
  console.log('🧪 TEST: ARTOPAY OUTBOUND AMOUNT TYPE = STRING');
  console.log('====================================================\n');

  // STEP 1: Static Source Code Verification in server.ts
  console.log('--- STEP 1: Source Code Static Analysis ---');
  const serverTs = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf8');
  assert(
    serverTs.includes('const formattedAmount = String(numAmt);'),
    'server.ts contains: const formattedAmount = String(numAmt);'
  );
  assert(
    !serverTs.includes('const formattedAmount = numAmt;'),
    'server.ts does NOT contain legacy: const formattedAmount = numAmt;'
  );
  assert(
    serverTs.includes('amount: formattedAmount,'),
    'paymentIntentPayload sets amount: formattedAmount'
  );

  // STEP 2: Spin up Mock ArtoPay Gateway to capture outbound network requests
  console.log('\n--- STEP 2: Outbound HTTP Network Capture ---');
  let capturedRequests = [];

  const mockGateway = http.createServer((req, res) => {
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
        payload: {
          paymentIntentId: 'pi_test_' + Date.now(),
          redirectUrl: 'https://checkout.arto-pay.com/pay/test',
          status: 'PENDING'
        }
      }));
    });
  });

  await new Promise((resolve) => mockGateway.listen(MOCK_GATEWAY_PORT, '127.0.0.1', resolve));
  console.log(`✅ Mock ArtoPay Gateway listening on http://127.0.0.1:${MOCK_GATEWAY_PORT}`);

  // STEP 3: Spawn backend server configured with mock ArtoPay gateway
  const env = {
    ...process.env,
    PORT: String(TEST_SERVER_PORT),
    NODE_ENV: 'production',
    ARTOPAY_SECRET_KEY: 'sk_test_outbound_amt_spec_secret_key',
    ARTOPAY_API_BASE_URL: `http://127.0.0.1:${MOCK_GATEWAY_PORT}`,
    ARTOPAY_ENV: 'sandbox'
  };

  const serverProc = spawn('node', ['dist/server.cjs'], {
    env,
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let serverOutput = '';
  serverProc.stdout.on('data', (d) => serverOutput += d.toString());
  serverProc.stderr.on('data', (d) => serverOutput += d.toString());

  try {
    await waitForServer(TEST_SERVER_PORT);
    console.log(`✅ Test server running on http://127.0.0.1:${TEST_SERVER_PORT}`);

    // Create a fresh test booking
    const bookingPayload = {
      tripId: 'tour-bromo-sunrise-safari',
      departureDate: '2026-10-15',
      fullName: 'String Amount Tester',
      email: 'tester@smartjourney.id',
      phone: '081234567890',
      participantsCount: 2,
      participantData: {
        pickupLocation: 'Malang City',
        paymentMethod: 'artopay',
        members: [
          { name: 'Tester One', nationality: 'Indonesia' },
          { name: 'Tester Two', nationality: 'Indonesia' }
        ]
      }
    };

    const bookRes = await httpRequest(TEST_SERVER_PORT, 'POST', '/api/bookings', bookingPayload);
    assert(bookRes.status === 201, 'Booking created successfully with HTTP 201');
    const booking = bookRes.body.booking || bookRes.body;
    const orderId = booking.bookingCode;
    const expectedPaymentAmount = booking.paymentAmount;

    assert(typeof expectedPaymentAmount === 'number', 'Internal booking.paymentAmount is strictly a number');
    assert(expectedPaymentAmount > 1000, `Internal booking.paymentAmount is ${expectedPaymentAmount} IDR`);

    // TEST 1: POST /api/artopay/payment-intent
    console.log('\n--- TEST A: /api/artopay/payment-intent Outbound Payload ---');
    capturedRequests = [];
    const piRes1 = await httpRequest(TEST_SERVER_PORT, 'POST', '/api/artopay/payment-intent', {
      orderId: orderId,
      amount: expectedPaymentAmount,
      currency: 'IDR'
    });

    assert(piRes1.status === 200, 'POST /api/artopay/payment-intent returns HTTP 200');
    assert(capturedRequests.length === 1, 'Exactly 1 request received by Mock ArtoPay Gateway');

    const req1 = capturedRequests[0];
    assert(typeof req1.body.amount === 'string', `typeof payload.amount === 'string' (actual type: ${typeof req1.body.amount})`);
    assert(req1.body.amount === String(expectedPaymentAmount), `payload.amount === String(${expectedPaymentAmount}) -> "${req1.body.amount}"`);
    assert(Number(req1.body.amount) === expectedPaymentAmount, `Number(payload.amount) === ${expectedPaymentAmount}`);
    assert(req1.body.currency === 'IDR', 'payload.currency === "IDR"');
    assert(typeof req1.body.orderId === 'string', 'typeof payload.orderId === "string"');

    // Strict raw JSON inspection: verify quotes around amount value in HTTP body
    const rawMatch = req1.rawBody.match(/"amount"\s*:\s*("[^"]+"|[^,\s}]+)/);
    assert(Boolean(rawMatch), 'Found "amount" key in raw JSON body');
    if (rawMatch) {
      assert(rawMatch[1] === `"${expectedPaymentAmount}"`, `Raw JSON body has string quotes: "amount": "${expectedPaymentAmount}"`);
      assert(!rawMatch[1].match(/^\d+$/), `Raw JSON body is NOT unquoted number`);
    }

    // TEST 2: Alias POST /artopay/payment-intent
    console.log('\n--- TEST B: Alias /artopay/payment-intent ---');
    capturedRequests = [];
    const piRes2 = await httpRequest(TEST_SERVER_PORT, 'POST', '/artopay/payment-intent', {
      orderId: orderId,
      amount: expectedPaymentAmount,
      currency: 'IDR'
    });
    assert(piRes2.status === 200, 'Alias POST /artopay/payment-intent returns HTTP 200');
    assert(capturedRequests.length === 1, 'Mock gateway received 1 request from alias');
    assert(typeof capturedRequests[0].body.amount === 'string', 'Alias produces typeof payload.amount === "string"');
    assert(capturedRequests[0].body.amount === String(expectedPaymentAmount), 'Alias amount matches String(expectedPaymentAmount)');

    // TEST 3: Alias POST /api/payment/create-intent
    console.log('\n--- TEST C: Alias /api/payment/create-intent ---');
    capturedRequests = [];
    const piRes3 = await httpRequest(TEST_SERVER_PORT, 'POST', '/api/payment/create-intent', {
      orderId: orderId,
      amount: expectedPaymentAmount,
      currency: 'IDR'
    });
    assert(piRes3.status === 200, 'Alias POST /api/payment/create-intent returns HTTP 200');
    assert(capturedRequests.length === 1, 'Mock gateway received 1 request from create-intent');
    assert(typeof capturedRequests[0].body.amount === 'string', 'Alias create-intent produces typeof payload.amount === "string"');
    assert(capturedRequests[0].body.amount === String(expectedPaymentAmount), 'Alias create-intent amount matches String(expectedPaymentAmount)');

    // TEST 4: Integrity of Internal Database Amounts
    console.log('\n--- TEST D: Internal State & Type Integrity ---');
    const orderStatusRes = await httpRequest(TEST_SERVER_PORT, 'GET', `/api/orders/${orderId}/payment-status`);
    assert(orderStatusRes.status === 200, 'Payment status endpoint returns HTTP 200');
    assert(typeof orderStatusRes.body.paymentAmount === 'number', 'Internal order.paymentAmount remains number');
    assert(typeof orderStatusRes.body.baseAmount === 'number', 'Internal order.baseAmount remains number');
    assert(typeof orderStatusRes.body.uniqueCode === 'number', 'Internal order.uniqueCode remains number');
    assert(
      orderStatusRes.body.paymentAmount === orderStatusRes.body.baseAmount + orderStatusRes.body.uniqueCode,
      'Internal calculation formula preserved: paymentAmount === baseAmount + uniqueCode'
    );

  } finally {
    // Cleanup processes & servers
    mockGateway.close();
    serverProc.kill('SIGTERM');

    // Clean test booking from db
    try {
      const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
      db.bookings = [];
      db.adminSessions = [];
      db.adminDrafts = {};
      fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
    } catch (e) {
      // ignore
    }
  }

  console.log('\n====================================================');
  console.log(`TOTAL AMOUNT STRING CHECKS: ${passedTests + failedTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
  console.log('====================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Test run error:', err);
  process.exit(1);
});
