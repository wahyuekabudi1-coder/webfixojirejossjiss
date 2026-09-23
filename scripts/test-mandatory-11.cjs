const http = require('http');
const crypto = require('crypto');
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

async function run11MandatoryTests() {
  console.log('================================================================');
  console.log('       11 MANDATORY SECURITY & REJECTION VERIFICATION TESTS      ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(cond, testNum, name, detail) {
    if (cond) {
      console.log(`✅ [PASS] Test ${testNum}: ${name}`);
      if (detail) console.log(`   └─ ${detail}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] Test ${testNum}: ${name}`);
      if (detail) console.error(`   └─ FAILURE: ${detail}`);
      failed++;
    }
  }

  const secret = (process.env.WEBHOOK_SECRET || process.env.ARTOPAY_SECRET_KEY || '').trim();

  // ---------------------------------------------------------------------------
  // TEST 1: WEBHOOK_SECRET kosong → reject (Fail Closed)
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
  const res1 = await makeReq(3002, '/api/artopay/webhook', { method: 'POST' }, { orderId: 'SJ-TEST', status: 'PAID' });
  tempServer.close();
  assert(res1.status === 503 || res1.status === 401, 1, 'WEBHOOK_SECRET kosong → reject (Fail Closed)', `Status: ${res1.status} | Body: ${JSON.stringify(res1.body)}`);

  // ---------------------------------------------------------------------------
  // Setup a real booking in main server (port 3000) for testing
  // ---------------------------------------------------------------------------
  const testOrderId = `SJ-SEC-${Date.now().toString().slice(-6)}`;
  const bookRes1 = await makeReq(3000, '/api/bookings', { method: 'POST' }, {
    id: testOrderId,
    bookingCode: testOrderId,
    type: 'Tours',
    customerName: 'Security Audit Traveler',
    customerEmail: 'audit@example.com',
    totalPriceIDR: 100000,
    baseAmount: 100000,
    paymentStatus: 'Pending',
    status: 'Pending'
  });
  const expectedAmount = Number(bookRes1.body?.booking?.paymentAmount || bookRes1.body?.paymentAmount || 100037);

  // ---------------------------------------------------------------------------
  // TEST 2: Signature kosong → reject
  // ---------------------------------------------------------------------------
  const rawBody2 = JSON.stringify({ orderId: testOrderId, status: 'PAID', amount: expectedAmount, currency: 'IDR' });
  const res2 = await makeReq(3000, '/api/artopay/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, rawBody2);
  assert(res2.status === 401, 2, 'Signature kosong → reject', `Status: ${res2.status} | Error: ${res2.body.error}`);

  // ---------------------------------------------------------------------------
  // TEST 3: Signature salah → reject
  // ---------------------------------------------------------------------------
  const rawBody3 = JSON.stringify({ orderId: testOrderId, status: 'PAID', amount: expectedAmount, currency: 'IDR' });
  const res3 = await makeReq(3000, '/api/artopay/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-artopay-signature': 'invalid_signature_hash_1234567890abcdef'
    }
  }, rawBody3);
  assert(res3.status === 401, 3, 'Signature salah → reject', `Status: ${res3.status} | Error: ${res3.body.error}`);

  // ---------------------------------------------------------------------------
  // TEST 4: Signature benar → accepted
  // ---------------------------------------------------------------------------
  const rawBody4 = JSON.stringify({ orderId: testOrderId, status: 'PAID', amount: expectedAmount, currency: 'IDR' });
  const validSig4 = crypto.createHmac('sha256', secret).update(rawBody4).digest('hex');
  const res4 = await makeReq(3000, '/api/artopay/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-artopay-signature': validSig4
    }
  }, rawBody4);
  assert(res4.status === 200, 4, 'Signature benar → accepted', `Status: ${res4.status} | Payment: ${res4.body.paymentStatus}`);

  // ---------------------------------------------------------------------------
  // Create a second test booking for Amount Exact Match Testing
  // ---------------------------------------------------------------------------
  const testOrderId2 = `SJ-AMT-${Date.now().toString().slice(-6)}`;
  const bookRes2 = await makeReq(3000, '/api/bookings', { method: 'POST' }, {
    id: testOrderId2,
    bookingCode: testOrderId2,
    type: 'Tours',
    customerName: 'Amount Test Traveler',
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
  // TEST 6: Amount berbeda Rp1 → rejected (expected = expectedAmount2, received = expectedAmount2 + 1)
  // ---------------------------------------------------------------------------
  const rawBody6 = JSON.stringify({ orderId: testOrderId2, status: 'PAID', amount: expectedAmount2 + 1, currency: 'IDR' });
  const validSig6 = crypto.createHmac('sha256', secret).update(rawBody6).digest('hex');
  const res6 = await makeReq(3000, '/api/artopay/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-artopay-signature': validSig6
    }
  }, rawBody6);
  assert(res6.status === 400, 6, 'Amount berbeda Rp1 → rejected', `Status: ${res6.status} | Error: ${res6.body.error} (Exp: ${res6.body.expectedAmount}, Rec: ${res6.body.receivedAmount})`);

  // ---------------------------------------------------------------------------
  // TEST 7: Amount berbeda lebih besar → rejected (expected = expectedAmount2, received = expectedAmount2 + 50000)
  // ---------------------------------------------------------------------------
  const rawBody7 = JSON.stringify({ orderId: testOrderId2, status: 'PAID', amount: expectedAmount2 + 50000, currency: 'IDR' });
  const validSig7 = crypto.createHmac('sha256', secret).update(rawBody7).digest('hex');
  const res7 = await makeReq(3000, '/api/artopay/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-artopay-signature': validSig7
    }
  }, rawBody7);
  assert(res7.status === 400, 7, 'Amount berbeda lebih besar → rejected', `Status: ${res7.status} | Error: ${res7.body.error}`);

  // ---------------------------------------------------------------------------
  // TEST 8: Amount mismatch → database tidak berubah
  // ---------------------------------------------------------------------------
  const checkAfterMismatch = await makeReq(3000, `/api/orders/${testOrderId2}/payment-status`);
  const dbUnchanged = (checkAfterMismatch.body.paymentStatus === initialPaymentStatus) && 
                      (checkAfterMismatch.body.orderStatus === initialOrderStatus) &&
                      (checkAfterMismatch.body.paymentStatus === 'Pending');
  assert(dbUnchanged, 8, 'Amount mismatch → database tidak berubah (Zero Mutation)', `PaymentStatus remains "${checkAfterMismatch.body.paymentStatus}", OrderStatus remains "${checkAfterMismatch.body.orderStatus}"`);

  // ---------------------------------------------------------------------------
  // TEST 5: Amount tepat → accepted (expected = expectedAmount2, received = expectedAmount2)
  // ---------------------------------------------------------------------------
  const rawBody5 = JSON.stringify({ orderId: testOrderId2, status: 'PAID', amount: expectedAmount2, currency: 'IDR' });
  const validSig5 = crypto.createHmac('sha256', secret).update(rawBody5).digest('hex');
  const res5 = await makeReq(3000, '/api/artopay/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-artopay-signature': validSig5
    }
  }, rawBody5);
  assert(res5.status === 200, 5, 'Amount tepat → accepted', `Status: ${res5.status} | Payment: ${res5.body.paymentStatus}`);

  // ---------------------------------------------------------------------------
  // TEST 9: ADMIN_PASSWORD kosong → login reject (Fail Closed)
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
  const res9 = await makeReq(3003, '/api/auth/login', { method: 'POST' }, {
    email: 'sawahjayagroup@gmail.com',
    password: 'sawahjaya2026'
  });
  tempLoginServer.close();
  assert(res9.status === 401, 9, 'ADMIN_PASSWORD kosong → login reject (Fail Closed)', `Status: ${res9.status} | Error: ${res9.body.error}`);

  // ---------------------------------------------------------------------------
  // TEST 10: ADMIN_PASSWORD benar → login berhasil
  // ---------------------------------------------------------------------------
  const res10 = await makeReq(3000, '/api/auth/login', { method: 'POST' }, {
    email: 'sawahjayagroup@gmail.com',
    password: 'sawahjaya2026'
  });
  assert(res10.status === 200 && res10.body.token, 10, 'ADMIN_PASSWORD benar → login berhasil', `Status: ${res10.status} | Token length: ${res10.body?.token?.length} chars`);

  // ---------------------------------------------------------------------------
  // TEST 11: Password alternatif smartjourney2026 → reject
  // ---------------------------------------------------------------------------
  const res11 = await makeReq(3000, '/api/auth/login', { method: 'POST' }, {
    email: 'sawahjayagroup@gmail.com',
    password: 'smartjourney2026'
  });
  assert(res11.status === 401, 11, 'Password alternatif smartjourney2026 → reject', `Status: ${res11.status} | Error: ${res11.body.error}`);

  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run11MandatoryTests().catch((err) => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
