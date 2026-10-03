/**
 * REGRESSION TEST: ALL 5 SERVICES PAYMENT SUMMARY & ARTOPAY PARITY
 * 
 * Services yang diaudit:
 * 1. Private Tour (type: 'tour')
 * 2. Open Trip / Share Tour (type: 'shared' / 'tour')
 * 3. Airport Transfer (type: 'airport')
 * 4. Taxi (type: 'taxi')
 * 5. Car Rental (type: 'rental')
 * 
 * Pola Wajib untuk Kelima Service:
 * Base Price - Discount + Unique Code = Final Payment.
 * Summary menampilkan rincian tersebut dan ArtoPay menerima Final Payment IDR yang sama.
 */

const http = require('http');
const { spawn } = require('child_process');

const MOCK_GATEWAY_PORT = 9985;
const TEST_SERVER_PORT = 3194;
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

async function runAll5ServicesAudit() {
  console.log('================================================================');
  console.log('🛡️ AUDIT & REGRESSION TEST: 5 LAYANAN (ALL 5 SERVICES)');
  console.log('   Pola: Base Price - Discount + Unique Code = Final Payment');
  console.log('   1. Private Tour  2. Open Trip  3. Airport Transfer  4. Taxi  5. Rental');
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
    // 1. Inisialisasi Mock Gateway
    mockGateway = http.createServer((req, res) => {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(body); } catch (e) { parsed = body; }
        capturedRequests.push({ url: req.url, method: req.method, headers: req.headers, body: parsed });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          code: '200',
          message: 'Success',
          id: 'pi_audit_' + Date.now(),
          paymentId: 'pi_audit_' + Date.now(),
          clientSecret: 'cs_audit_secret_' + Date.now(),
          url: 'https://checkout.arto-pay.com/pay/audit_test',
          orderId: parsed?.orderId || 'SJ-AUDIT',
          status: 'PENDING'
        }));
      });
    });

    await new Promise((resolve) => mockGateway.listen(MOCK_GATEWAY_PORT, '127.0.0.1', resolve));
    assert(true, 'Mock ArtoPay Gateway Aktif', `http://127.0.0.1:${MOCK_GATEWAY_PORT}`);

    // 2. Jalankan Backend Server
    const env = {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(TEST_SERVER_PORT),
      ARTOPAY_SECRET_KEY: 'sk_test_all5_services_secret_key',
      ARTOPAY_PUBLIC_KEY: 'pk_test_all5_services_public_key',
      ARTOPAY_API_BASE_URL: `http://127.0.0.1:${MOCK_GATEWAY_PORT}`,
      ARTOPAY_ENV: 'sandbox'
    };

    serverProc = spawn('node', ['dist/server.cjs'], {
      env,
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe']
    });

    await waitForServer(TEST_SERVER_PORT);
    assert(true, 'Backend Server Berhasil Boot', `http://127.0.0.1:${TEST_SERVER_PORT}`);

    // 3. Admin Auth
    const loginRes = await httpRequest(TEST_SERVER_PORT, '/api/auth/login', { method: 'POST' }, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    assert(loginRes.status === 200, 'Admin Login Berhasil');
    const adminToken = loginRes.body.token;
    const authHeaders = { 'Authorization': `Bearer ${adminToken}` };

    // Dapatkan trip dan buat batch open trip aktif untuk testing service Open Trip
    const tripsRes = await httpRequest(TEST_SERVER_PORT, '/api/trips');
    const firstTrip = Array.isArray(tripsRes.body) && tripsRes.body[0];
    const testTripId = firstTrip ? firstTrip.id : 'trip-bromo-midnight';
    const batchFutureDate = new Date(Date.now() + 86400000 * 45).toISOString().split('T')[0];

    const createBatchRes = await httpRequest(TEST_SERVER_PORT, '/api/batches', {
      method: 'POST',
      headers: authHeaders
    }, {
      tripId: testTripId,
      departureDate: batchFutureDate,
      totalSeats: 12,
      availableSeats: 12,
      status: 'Open'
    });
    const testBatchId = createBatchRes.body?.id || 'batch-test-audit';

    // Definisi Pengujian 5 Layanan
    const services = [
      {
        name: 'Private Tour',
        serviceType: 'tour',
        payload: {
          type: 'tour',
          serviceName: 'Private Tour Bromo Exclusive',
          tourId: 'tour-p5b-1791025346175',
          departureDate: new Date(Date.now() + 86400000 * 25).toISOString().split('T')[0],
          customerName: 'Traveler Private Tour',
          customerEmail: 'private@example.com',
          customerPhone: '+6281211112222',
          participantsCount: 2,
          nationalityType: 'WNI'
        },
        baseAmount: 120000,
        discount: 20000,
        promoCode: 'DISC20K',
        uniqueCode: 15
      },
      {
        name: 'Open Trip (Share Tour)',
        serviceType: 'shared',
        payload: {
          bookingType: 'shared',
          tourBookingType: 'shared',
          batchId: testBatchId,
          tripId: testTripId,
          serviceName: 'Open Trip Bromo Midnight',
          departureDate: batchFutureDate,
          customerName: 'Backpacker Open Trip',
          customerEmail: 'opentrip@example.com',
          customerPhone: '+6281222223333',
          participantsCount: 1,
          nationalityType: 'WNI'
        },
        baseAmount: 450000,
        discount: 50000,
        promoCode: 'OPENTRIP50K',
        uniqueCode: 27
      },
      {
        name: 'Airport Transfer',
        serviceType: 'airport',
        payload: {
          type: 'airport',
          serviceName: 'Airport Transfer Juanda ke Malang',
          departureDate: new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0],
          customerName: 'Executive Airport Passenger',
          customerEmail: 'airport@example.com',
          customerPhone: '+6281233334444',
          participantsCount: 2,
          serviceId: 'ap-route-p5b-1791025346241',
          airport: 'SUB',
          destination: 'Malang Kota Center',
          vehicleId: 'innova',
          details: {
            vehicleId: 'innova',
            vehicleName: 'Toyota Innova Reborn',
            airport: 'SUB',
            destination: 'Malang Kota Center',
            pickupLocation: 'Bandara Juanda Terminal 1',
            flightNumber: 'GA-321'
          }
        },
        baseAmount: 450000,
        discount: 25000,
        promoCode: 'AIRPORT25K',
        uniqueCode: 38
      },
      {
        name: 'Taxi (Intercity)',
        serviceType: 'taxi',
        payload: {
          type: 'taxi',
          serviceName: 'Private Intercity Taxi Surabaya - Malang',
          departureDate: new Date(Date.now() + 86400000 * 32).toISOString().split('T')[0],
          customerName: 'Taxi Business Rider',
          customerEmail: 'taxi@example.com',
          customerPhone: '+6281244445555',
          participantsCount: 2,
          pickupAreaId: 'area-sub-p5b',
          destAreaId: 'area-mlg-p5b',
          serviceId: 'tx-rule-p5b-1791025346271',
          vehicleId: 'innova',
          details: {
            vehicleId: 'innova',
            pickupLocation: 'Surabaya Center',
            destination: 'Malang Center'
          }
        },
        baseAmount: 300000,
        discount: 30000,
        promoCode: 'TAXI30K',
        uniqueCode: 49
      },
      {
        name: 'Car Rental',
        serviceType: 'rental',
        payload: {
          type: 'rental',
          serviceName: 'Car Rental Toyota Avanza 2024 Lepas Kunci',
          departureDate: new Date(Date.now() + 86400000 * 35).toISOString().split('T')[0],
          customerName: 'Rental Self Drive',
          customerEmail: 'rental@example.com',
          customerPhone: '+6281255556666',
          participantsCount: 4,
          serviceId: 'car-p5b-avanza-1791025345757',
          vehicleId: 'car-p5b-avanza-1791025345757',
          details: {
            vehicleId: 'car-p5b-avanza-1791025345757',
            vehicleName: 'Toyota Avanza 2024',
            days: 1,
            withDriver: true,
            pickupLocation: 'Malang Kota'
          }
        },
        baseAmount: 450000,
        discount: 50000,
        promoCode: 'RENTAL50K',
        uniqueCode: 63
      }
    ];

    // Iterasi Audit untuk Masing-Masing dari 5 Service
    for (const [idx, s] of services.entries()) {
      console.log(`\n================================================================`);
      console.log(`[SERVICE ${idx + 1}/5] AUDIT: ${s.name.toUpperCase()}`);
      console.log(`================================================================`);

      const orderCode = `SJ-AUDIT-${s.serviceType.toUpperCase().slice(0, 3)}-${Date.now().toString().slice(-5)}`;
      s.payload.id = orderCode;
      s.payload.bookingCode = orderCode;

      // 1. Buat booking awal
      const createRes = await httpRequest(TEST_SERVER_PORT, '/api/bookings', { method: 'POST' }, s.payload);
      if (createRes.status !== 201) {
        console.error(`${s.name} creation failed:`, createRes.status, createRes.body);
      }
      assert(createRes.status === 201, `${s.name}: Booking berhasil dibuat`, `ID: ${orderCode}`);

      // 2. Kunci skenario harga terotoritas: Base - Discount + Unique = Final
      const netPayable = s.baseAmount - s.discount;
      const expectedFinal = netPayable + s.uniqueCode;

      const updateRes = await httpRequest(TEST_SERVER_PORT, `/api/bookings/${orderCode}`, {
        method: 'PUT',
        headers: authHeaders
      }, {
        baseAmount: s.baseAmount,
        discount: s.discount,
        promoCode: s.promoCode,
        uniqueCode: s.uniqueCode,
        paymentAmount: expectedFinal,
        totalPrice: netPayable,
        totalPriceIDR: netPayable
      });
      assert(updateRes.status === 200, `${s.name}: Nominal tersimpan di database`);

      // 3. Verifikasi Payment Summary
      const summaryRes = await httpRequest(TEST_SERVER_PORT, `/api/private-tour/check-booking/${encodeURIComponent(orderCode)}`);
      assert(summaryRes.status === 200, `${s.name}: Summary return HTTP 200`);
      const sum = summaryRes.body;

      assert(Number(sum.baseAmount) === s.baseAmount, `${s.name}: Base Price = Rp ${s.baseAmount.toLocaleString('id-ID')}`);
      assert(Number(sum.discount) === s.discount, `${s.name}: Discount = Rp ${s.discount.toLocaleString('id-ID')}`);
      assert(Number(sum.uniqueCode) === s.uniqueCode, `${s.name}: Unique Code = Rp ${s.uniqueCode}`);
      assert(Number(sum.paymentAmount) === expectedFinal, `${s.name}: Final Payment = Rp ${expectedFinal.toLocaleString('id-ID')}`);
      assert(
        Number(sum.baseAmount) - Number(sum.discount) + Number(sum.uniqueCode) === Number(sum.paymentAmount),
        `${s.name}: Formula valid (Base - Disc + Unique = Final: ${sum.baseAmount} - ${sum.discount} + ${sum.uniqueCode} = ${sum.paymentAmount})`
      );

      // 4. Verifikasi Immutability saat Refresh / Reopen
      const reopenRes = await httpRequest(TEST_SERVER_PORT, `/api/orders/${encodeURIComponent(orderCode)}/payment-status`);
      assert(reopenRes.status === 200, `${s.name}: Payment status endpoint return HTTP 200`);
      assert(
        Number(reopenRes.body.baseAmount) === s.baseAmount &&
        Number(reopenRes.body.discount) === s.discount &&
        Number(reopenRes.body.uniqueCode) === s.uniqueCode &&
        Number(reopenRes.body.paymentAmount) === expectedFinal,
        `${s.name}: Reopen / Polling status menjaga immutability 100% identik`
      );

      // 5. Trigger ArtoPay Payment Intent
      capturedRequests.length = 0;
      const intentRes = await httpRequest(TEST_SERVER_PORT, '/api/artopay/payment-intent', { method: 'POST' }, {
        orderId: orderCode,
        amount: expectedFinal,
        currency: 'IDR',
        customerName: s.payload.customerName,
        customerEmail: s.payload.customerEmail,
        customerPhone: s.payload.customerPhone
      });
      assert(intentRes.status === 200, `${s.name}: ArtoPay Intent return HTTP 200`);
      assert(capturedRequests.length === 1, `${s.name}: ArtoPay gateway menerima 1 payload keluar`);

      const outbound = capturedRequests[0].body;
      assert(
        outbound.amount === String(expectedFinal),
        `${s.name}: ArtoPay menerima amount persis: "${expectedFinal}"`,
        `outbound.amount = "${outbound.amount}"`
      );
      assert(outbound.currency === 'IDR', `${s.name}: ArtoPay menerima currency "IDR"`);
      assert(
        Number(outbound.metadata?.paymentAmount) === expectedFinal,
        `${s.name}: ArtoPay metadata paymentAmount = ${expectedFinal}`
      );
      assert(
        Number(outbound.metadata?.uniqueCode) === s.uniqueCode,
        `${s.name}: ArtoPay metadata uniqueCode = ${s.uniqueCode}`
      );
    }

    console.log('\n================================================================');
    console.log(`🎉 AUDIT 5 SERVICE SELESAI: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal error during 5 services audit test:', err);
    process.exit(1);
  } finally {
    cleanup();
  }
}

runAll5ServicesAudit();
