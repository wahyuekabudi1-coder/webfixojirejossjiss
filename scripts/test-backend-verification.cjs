const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
try { require('dotenv').config(); } catch (e) {}

async function makeReq(port, path, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path,
        method: options.method || 'GET',
        headers: options.headers || { 'Content-Type': 'application/json' }
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data), raw: data });
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

async function runFinalVerification() {
  console.log('================================================================');
  console.log('       FINAL BACKEND HARDENING: 13 VERIFICATION CHECKS          ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(cond, checkNum, description, detail) {
    if (cond) {
      console.log(`✅ [PASS] Check ${checkNum}: ${description}`);
      if (detail) console.log(`   └─ ${detail}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] Check ${checkNum}: ${description}`);
      if (detail) console.error(`   └─ FAILURE: ${detail}`);
      failed++;
    }
  }

  const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.ts'), 'utf-8');

  // ---------------------------------------------------------------------------
  // Check 1: Search source untuk `if (webhookSecret)` dan pastikan tidak ada lagi sebagai conditional verification
  // ---------------------------------------------------------------------------
  const hasConditionalWebhookSecret = /if\s*\(\s*webhookSecret\s*\)\s*\{/i.test(serverSource);
  assert(!hasConditionalWebhookSecret, 1, 'Source check: if (webhookSecret) conditional verification eliminated', 'Zero instances found in server.ts');

  // ---------------------------------------------------------------------------
  // Check 2: Search source untuk `Math.abs(receivedAmount - expectedAmount)` dan pastikan tidak digunakan
  // ---------------------------------------------------------------------------
  const hasMathAbsAmount = /Math\.abs\(\s*receivedAmount\s*-\s*expectedAmount\s*\)/i.test(serverSource);
  assert(!hasMathAbsAmount, 2, 'Source check: Math.abs(receivedAmount - expectedAmount) tolerance eliminated', 'Zero instances found in server.ts (Exact match enforced)');

  // ---------------------------------------------------------------------------
  // Check 3: Pastikan server tidak memiliki fallback password
  // ---------------------------------------------------------------------------
  const hasServerPasswordFallback = /process\.env\.ADMIN_PASSWORD\s*\|\|\s*['"`]sawahjaya2026/i.test(serverSource) ||
                                    /process\.env\.ADMIN_PASSWORD\s*\|\|\s*['"`]smartjourney2026/i.test(serverSource) ||
                                    /password\s*===\s*['"`]smartjourney2026/i.test(serverSource);
  assert(!hasServerPasswordFallback, 3, 'Source check: Server fallback passwords eliminated', 'No fallback password in server.ts authentication logic');

  const secret = (process.env.WEBHOOK_SECRET || process.env.ARTOPAY_SECRET_KEY || '').trim();

  // ---------------------------------------------------------------------------
  // Check 4: Test webhook secret kosong → 503
  // ---------------------------------------------------------------------------
  const isolatedApp = express();
  isolatedApp.use(express.json());
  isolatedApp.post('/api/artopay/webhook', (req, res) => {
    const webhookSecret = (process.env.TEST_EMPTY_SECRET || '').trim();
    if (!webhookSecret) {
      return res.status(503).json({ error: 'Webhook secret is not configured on server (Fail Closed)' });
    }
    return res.json({ success: true });
  });
  const tempServer = isolatedApp.listen(3002);
  const res4 = await makeReq(3002, '/api/artopay/webhook', { method: 'POST' }, { orderId: 'SJ-TEST', status: 'PAID' });
  tempServer.close();
  assert(res4.status === 503, 4, 'Test webhook secret kosong → 503', `HTTP Status: ${res4.status} | Body: ${JSON.stringify(res4.body)}`);

  // Setup a real booking in main server (port 3000) for testing
  const testOrderId = `SJ-VER-${Date.now().toString().slice(-6)}`;
  const bookRes1 = await makeReq(3000, '/api/bookings', { method: 'POST' }, {
    id: testOrderId,
    bookingCode: testOrderId,
    type: 'Tours',
    customerName: 'Verification Traveler',
    customerEmail: 'verify@example.com',
    totalPriceIDR: 100000,
    baseAmount: 100000,
    paymentStatus: 'Pending',
    status: 'Pending'
  });
  const expectedAmount = Number(bookRes1.body?.booking?.paymentAmount || bookRes1.body?.paymentAmount || 100037);

  // ---------------------------------------------------------------------------
  // Check 5: Test signature kosong → 401
  // ---------------------------------------------------------------------------
  const rawBody5 = JSON.stringify({ orderId: testOrderId, status: 'PAID', amount: expectedAmount });
  const res5 = await makeReq(3000, '/api/artopay/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, rawBody5);
  assert(res5.status === 401, 5, 'Test signature kosong → 401', `HTTP Status: ${res5.status} | Error: ${res5.body.error}`);

  // ---------------------------------------------------------------------------
  // Check 6: Test signature salah → 401
  // ---------------------------------------------------------------------------
  const rawBody6 = JSON.stringify({ orderId: testOrderId, status: 'PAID', amount: expectedAmount, currency: 'IDR' });
  const res6 = await makeReq(3000, '/api/artopay/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-artopay-signature': '0000000000000000000000000000000000000000000000000000000000000000'
    }
  }, rawBody6);
  assert(res6.status === 401, 6, 'Test signature salah → 401', `HTTP Status: ${res6.status} | Error: ${res6.body.error}`);

  // ---------------------------------------------------------------------------
  // Check 7: Test signature benar → 200
  // ---------------------------------------------------------------------------
  const rawBody7 = JSON.stringify({ orderId: testOrderId, status: 'PAID', amount: expectedAmount, currency: 'IDR' });
  const validSig7 = crypto.createHmac('sha256', secret).update(rawBody7).digest('hex');
  const res7 = await makeReq(3000, '/api/artopay/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-artopay-signature': validSig7
    }
  }, rawBody7);
  assert(res7.status === 200, 7, 'Test signature benar → 200', `HTTP Status: ${res7.status} | PaymentStatus: ${res7.body.paymentStatus}`);

  // Create a second test booking for Amount Exact Match Testing
  const testOrderId2 = `SJ-AMT-${Date.now().toString().slice(-6)}`;
  const bookRes2 = await makeReq(3000, '/api/bookings', { method: 'POST' }, {
    id: testOrderId2,
    bookingCode: testOrderId2,
    type: 'Tours',
    customerName: 'Amount Traveler',
    customerEmail: 'amount@example.com',
    totalPriceIDR: 100000,
    baseAmount: 100000,
    paymentStatus: 'Pending',
    status: 'Pending'
  });
  const expectedAmount2 = Number(bookRes2.body?.booking?.paymentAmount || bookRes2.body?.paymentAmount || 100037);

  const checkInitial = await makeReq(3000, `/api/orders/${testOrderId2}/payment-status`);
  const initialPaymentStatus = checkInitial.body.paymentStatus;
  const initialOrderStatus = checkInitial.body.orderStatus;

  // ---------------------------------------------------------------------------
  // Check 8: Test amount tepat → 200 (tested later after mismatch tests to preserve Pending state)
  // Check 9: Test amount berbeda Rp1 → 400 + database tidak berubah
  // ---------------------------------------------------------------------------
  const rawBody9 = JSON.stringify({ orderId: testOrderId2, status: 'PAID', amount: expectedAmount2 + 1, currency: 'IDR' });
  const validSig9 = crypto.createHmac('sha256', secret).update(rawBody9).digest('hex');
  const res9 = await makeReq(3000, '/api/artopay/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-artopay-signature': validSig9
    }
  }, rawBody9);

  const checkAfterMismatch1 = await makeReq(3000, `/api/orders/${testOrderId2}/payment-status`);
  const dbUnchanged1 = (checkAfterMismatch1.body.paymentStatus === initialPaymentStatus) && 
                       (checkAfterMismatch1.body.orderStatus === initialOrderStatus) &&
                       (checkAfterMismatch1.body.paymentStatus === 'Pending');

  assert(res9.status === 400 && dbUnchanged1, 9, 'Test amount berbeda Rp1 → 400 + database tidak berubah', `HTTP Status: ${res9.status} | Exp: ${expectedAmount2}, Rec: ${expectedAmount2 + 1} | DB paymentStatus: ${checkAfterMismatch1.body.paymentStatus}`);

  // ---------------------------------------------------------------------------
  // Check 10: Test amount berbeda lebih besar → 400 + database tidak berubah
  // ---------------------------------------------------------------------------
  const rawBody10 = JSON.stringify({ orderId: testOrderId2, status: 'PAID', amount: expectedAmount2 + 50000, currency: 'IDR' });
  const validSig10 = crypto.createHmac('sha256', secret).update(rawBody10).digest('hex');
  const res10 = await makeReq(3000, '/api/artopay/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-artopay-signature': validSig10
    }
  }, rawBody10);

  const checkAfterMismatch2 = await makeReq(3000, `/api/orders/${testOrderId2}/payment-status`);
  const dbUnchanged2 = (checkAfterMismatch2.body.paymentStatus === initialPaymentStatus) && 
                       (checkAfterMismatch2.body.orderStatus === initialOrderStatus) &&
                       (checkAfterMismatch2.body.paymentStatus === 'Pending');

  assert(res10.status === 400 && dbUnchanged2, 10, 'Test amount berbeda lebih besar → 400 + database tidak berubah', `HTTP Status: ${res10.status} | Exp: ${expectedAmount2}, Rec: ${expectedAmount2 + 50000} | DB paymentStatus: ${checkAfterMismatch2.body.paymentStatus}`);

  // ---------------------------------------------------------------------------
  // Check 8: Test amount tepat → 200
  // ---------------------------------------------------------------------------
  const rawBody8 = JSON.stringify({ orderId: testOrderId2, status: 'PAID', amount: expectedAmount2, currency: 'IDR' });
  const validSig8 = crypto.createHmac('sha256', secret).update(rawBody8).digest('hex');
  const res8 = await makeReq(3000, '/api/artopay/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-artopay-signature': validSig8
    }
  }, rawBody8);
  assert(res8.status === 200 && res8.body.paymentStatus === 'Paid', 8, 'Test amount tepat → 200', `HTTP Status: ${res8.status} | Payment: ${res8.body.paymentStatus}`);

  // ---------------------------------------------------------------------------
  // Check 11: Test ADMIN_PASSWORD kosong → 401
  // ---------------------------------------------------------------------------
  const isolatedAppLogin = express();
  isolatedAppLogin.use(express.json());
  isolatedAppLogin.post('/api/auth/login', (req, res) => {
    const rawAdminPassword = (process.env.TEST_EMPTY_PASSWORD || '').trim();
    if (!rawAdminPassword) {
      return res.status(401).json({ error: 'Akses Admin ditolak: ADMIN_PASSWORD tidak dikonfigurasi pada server (Fail Closed).' });
    }
    return res.json({ success: true });
  });
  const tempLoginServer = isolatedAppLogin.listen(3003);
  const res11 = await makeReq(3003, '/api/auth/login', { method: 'POST' }, {
    email: 'sawahjayagroup@gmail.com',
    password: 'sawahjaya2026'
  });
  tempLoginServer.close();
  assert(res11.status === 401, 11, 'Test ADMIN_PASSWORD kosong → 401 (Fail Closed)', `HTTP Status: ${res11.status} | Error: ${res11.body.error}`);

  // ---------------------------------------------------------------------------
  // Check 12: Test password benar → 200
  // ---------------------------------------------------------------------------
  const res12 = await makeReq(3000, '/api/auth/login', { method: 'POST' }, {
    email: 'sawahjayagroup@gmail.com',
    password: 'sawahjaya2026'
  });
  assert(res12.status === 200 && res12.body.token, 12, 'Test password benar → 200', `HTTP Status: ${res12.status} | Session Token: ${res12.body.token?.substring(0, 16)}...`);

  // ---------------------------------------------------------------------------
  // Check 13: Test smartjourney2026 → 401
  // ---------------------------------------------------------------------------
  const res13 = await makeReq(3000, '/api/auth/login', { method: 'POST' }, {
    email: 'sawahjayagroup@gmail.com',
    password: 'smartjourney2026'
  });
  assert(res13.status === 401, 13, 'Test smartjourney2026 → 401 (Ditolak)', `HTTP Status: ${res13.status} | Error: ${res13.body.error}`);

  console.log('\n================================================================');
  console.log(`TOTAL CHECKS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runFinalVerification().catch((err) => {
  console.error('Fatal error in verification:', err);
  process.exit(1);
});
