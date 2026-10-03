/**
 * REGRESSION TEST: ALL 5 SERVICES PAYMENT SUMMARY & ARTOPAY PARITY
 * 
 * Services audited:
 * 1. Private Tour
 * 2. Open Trip (Share Tour)
 * 3. Airport Transfer
 * 4. Taxi
 * 5. Car Rental
 * 
 * Verifikasi Mutlak untuk SEMUA 5 SERVICE:
 * - Pola seragam: Base Price - Discount + Unique Code = Final Payment
 * - Summary menampilkan rincian tersebut (Base Price, Discount, Unique Code, Final Payment)
 * - ArtoPay menerima nominal Final Payment IDR yang persis sama
 * - Booking data bersifat immutable pada refresh, reopen, & retry payment
 */

const http = require('http');
const { spawn } = require('child_process');

const MOCK_GATEWAY_PORT = 9987;
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

async function run() {
  console.log('================================================================');
  console.log('🛡️ AUDIT 5 SERVICES: PAYMENT SUMMARY & ARTOPAY PARITY');
  console.log('   Services: Private Tour, Open Trip, Airport Transfer, Taxi, Car Rental');
  console.log('   Invarian: Base Price - Discount + Unique Code = Final Payment');
  console.log('================================================================');

  let mockGateway = null;
  let serverProc = null;
  const outboundArtoPayRequests = [];

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
          id: 'pi_mock_' + Date.now(),
          paymentId: 'pi_mock_' + Date.now(),
          clientSecret: 'cs_test_mock',
          customerToken: 'ct_test_mock',
          url: 'https://checkout.arto-pay.com/pay/mock_' + Date.now(),
          orderId: parsed?.orderId || 'SJ-TEST',
          status: 'PENDING'
        }));
      });
    });

    await new Promise(resolve => mockGateway.listen(MOCK_GATEWAY_PORT, '127.0.0.1', resolve));
    assert(true, 'Mock ArtoPay Gateway Aktif', `http://127.0.0.1:${MOCK_GATEWAY_PORT}`);

    // -------------------------------------------------------------------------
    // 2. Jalankan Backend Server Uji
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Jalankan Backend Server Uji ---');
    const env = {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(TEST_SERVER_PORT),
      ARTOPAY_SECRET_KEY: 'sk_test_service_parity_secret',
      ARTOPAY_PUBLIC_KEY: 'pk_test_service_parity_public',
      ARTOPAY_API_BASE_URL: `http://127.0.0.1:${MOCK_GATEWAY_PORT}`,
      ARTOPAY_ENV: 'sandbox'
    };

    serverProc = spawn('node', ['dist/server.cjs'], {
      env,
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe']
    });

    serverProc.stderr.on('data', (d) => {
      const errStr = d.toString();
      if (errStr.includes('Fatal') || errStr.includes('Error:')) {
        console.error('[Server Error]', errStr.trim());
      }
    });

    await waitForServer(TEST_SERVER_PORT);
    assert(true, 'Backend Server Berhasil Boot & Healthy', `http://127.0.0.1:${TEST_SERVER_PORT}`);

    // -------------------------------------------------------------------------
    // 3. Autentikasi Admin & Setup Master Data
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Autentikasi Admin ---');
    const loginRes = await httpRequest(TEST_SERVER_PORT, '/api/auth/login', { method: 'POST' }, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    assert(loginRes.status === 200 && Boolean(loginRes.body.token), 'Admin Login Berhasil');
    const adminToken = loginRes.body.token;
    const authHeaders = { 'Authorization': `Bearer ${adminToken}` };

    // Register active promo code for discount tests
    const promoCode = 'PARITY50K';
    const promoRes = await httpRequest(TEST_SERVER_PORT, '/api/admin/promos', {
      method: 'POST',
      headers: authHeaders
    }, {
      code: promoCode,
      description: 'Diskon 50 Ribu All Service',
      discountType: 'fixed',
      discountValue: 50000,
      minSpendIDR: 10000,
      validUntil: '2027-12-31',
      maxUsage: 9999,
      isActive: true
    });
    assert(promoRes.status === 201 || promoRes.status === 409, `Promo Code "${promoCode}" terdaftar di backend`);

    // =========================================================================
    // SERVICE 1: PRIVATE TOUR
    // =========================================================================
    console.log('\n============================================================');
    console.log('📌 SERVICE 1: PRIVATE TOUR');
    console.log('============================================================');

    const toursRes = await httpRequest(TEST_SERVER_PORT, '/api/main-tours');
    const mainTours = Array.isArray(toursRes.body) ? toursRes.body : [];
    const tourItem = mainTours.find(t => t.startingPriceIDR > 0 || t.wniPrice > 0) || mainTours[0] || { id: 'tour-p5b-1791025346175' };

    const tourDeparture = new Date(Date.now() + 86400000 * (40 + Math.floor(Math.random() * 30))).toISOString().split('T')[0];
    const tourOrderId = `SJ-TOUR-${Date.now().toString().slice(-6)}`;

    const tourBookingPayload = {
      id: tourOrderId,
      bookingCode: tourOrderId,
      type: 'tour',
      serviceType: 'tour',
      tourId: tourItem.id,
      tripId: tourItem.id,
      serviceName: tourItem.title || tourItem.name || 'Private Bromo Sunrise Tour',
      departureDate: tourDeparture,
      customerName: 'Traveler Private Tour',
      customerEmail: 'traveler.private@example.com',
      customerPhone: '+6281234567890',
      participantsCount: 2,
      nationalityType: 'WNI',
      promoCode: promoCode
    };

    const tourCreateRes = await httpRequest(TEST_SERVER_PORT, '/api/bookings', { method: 'POST' }, tourBookingPayload);
    if (tourCreateRes.status !== 201) console.error('Tour Create Failed:', tourCreateRes.status, tourCreateRes.body);
    assert(tourCreateRes.status === 201, 'Private Tour: Booking created successfully', `Order: ${tourOrderId}`);
    const tourBooking = tourCreateRes.body;

    const tourBase = Number(tourBooking.baseAmount);
    const tourDiscount = Number(tourBooking.discount || 0);
    const tourUnique = Number(tourBooking.uniqueCode);
    const tourPayment = Number(tourBooking.paymentAmount);

    assert(tourBase > 0, `Private Tour: Base Price valid (Rp ${tourBase.toLocaleString('id-ID')})`);
    assert(tourDiscount === 50000, `Private Tour: Discount valid (Rp ${tourDiscount.toLocaleString('id-ID')})`);
    assert(tourUnique >= 1 && tourUnique <= 99, `Private Tour: Unique Code valid (${tourUnique})`);
    assert(tourBase - tourDiscount + tourUnique === tourPayment, `Private Tour Formula: Base - Discount + Unique === Final Payment (${tourBase} - ${tourDiscount} + ${tourUnique} = ${tourPayment})`);

    const tourCheckRes = await httpRequest(TEST_SERVER_PORT, `/api/private-tour/check-booking/${tourOrderId}`);
    assert(tourCheckRes.status === 200, 'Private Tour: Summary Check Booking HTTP 200');
    assert(Number(tourCheckRes.body.baseAmount) === tourBase, 'Private Tour: Summary baseAmount matches stored value');
    assert(Number(tourCheckRes.body.discount) === tourDiscount, 'Private Tour: Summary discount matches stored value');
    assert(Number(tourCheckRes.body.uniqueCode) === tourUnique, 'Private Tour: Summary uniqueCode matches stored value');
    assert(Number(tourCheckRes.body.paymentAmount) === tourPayment, 'Private Tour: Summary paymentAmount matches stored value');

    const tourPayRes = await httpRequest(TEST_SERVER_PORT, '/api/artopay/payment-intent', { method: 'POST' }, {
      orderId: tourOrderId,
      amount: tourPayment,
      currency: 'IDR'
    });
    assert(tourPayRes.status === 200, 'Private Tour: ArtoPay Intent HTTP 200');
    const tourOutbound = outboundArtoPayRequests[outboundArtoPayRequests.length - 1];
    assert(tourOutbound && String(tourOutbound.body.amount) === String(tourPayment), `Private Tour: ArtoPay received exact Final Payment IDR (${tourPayment})`);
    assert(tourOutbound && tourOutbound.body.currency === 'IDR', 'Private Tour: ArtoPay currency IDR verified');

    // =========================================================================
    // SERVICE 2: OPEN TRIP (SHARE TOUR)
    // =========================================================================
    console.log('\n============================================================');
    console.log('📌 SERVICE 2: OPEN TRIP (SHARE TOUR)');
    console.log('============================================================');

    const batchesRes = await httpRequest(TEST_SERVER_PORT, '/api/batches');
    const batches = Array.isArray(batchesRes.body) ? batchesRes.body : [];
    let activeBatch = batches.find(b => b.availableSeats >= 2 && !b.isArchived && b.status !== 'Closed');

    if (!activeBatch) {
      const tripsRes = await httpRequest(TEST_SERVER_PORT, '/api/trips');
      const trips = Array.isArray(tripsRes.body) ? tripsRes.body : [];
      const activeTrip = trips[0] || { id: 'trip-1' };
      const newBatchRes = await httpRequest(TEST_SERVER_PORT, '/api/batches', {
        method: 'POST',
        headers: authHeaders
      }, {
        tripId: activeTrip.id,
        departureDate: new Date(Date.now() + 86400000 * 35).toISOString().split('T')[0],
        totalSeats: 12,
        availableSeats: 12,
        status: 'Open',
        priceIDR: 450000
      });
      activeBatch = newBatchRes.body?.batch || newBatchRes.body;
    }

    const openTripOrderId = `SJ-OPEN-${Date.now().toString().slice(-6)}`;
    const openTripPayload = {
      id: openTripOrderId,
      bookingCode: openTripOrderId,
      bookingType: 'shared',
      serviceType: 'shared',
      batchId: activeBatch.id,
      tripId: activeBatch.tripId,
      participantsCount: 2,
      customerName: 'Traveler Open Trip',
      customerEmail: 'traveler.opentrip@example.com',
      customerPhone: '+6281234567891',
      nationalityType: 'WNI',
      promoCode: promoCode
    };

    const openTripCreateRes = await httpRequest(TEST_SERVER_PORT, '/api/bookings', { method: 'POST' }, openTripPayload);
    if (openTripCreateRes.status !== 201) console.error('Open Trip Create Failed:', openTripCreateRes.status, openTripCreateRes.body);
    assert(openTripCreateRes.status === 201, 'Open Trip: Booking created successfully', `Order: ${openTripOrderId}`);
    const openTripBooking = openTripCreateRes.body;

    const openBase = Number(openTripBooking.baseAmount);
    const openDiscount = Number(openTripBooking.discount || 0);
    const openUnique = Number(openTripBooking.uniqueCode);
    const openPayment = Number(openTripBooking.paymentAmount);

    assert(openBase > 0, `Open Trip: Base Price valid (Rp ${openBase.toLocaleString('id-ID')})`);
    assert(openDiscount === 50000, `Open Trip: Discount valid (Rp ${openDiscount.toLocaleString('id-ID')})`);
    assert(openUnique >= 1 && openUnique <= 99, `Open Trip: Unique Code valid (${openUnique})`);
    assert(openBase - openDiscount + openUnique === openPayment, `Open Trip Formula: Base - Discount + Unique === Final Payment (${openBase} - ${openDiscount} + ${openUnique} = ${openPayment})`);

    const openCheckRes = await httpRequest(TEST_SERVER_PORT, `/api/private-tour/check-booking/${openTripOrderId}`);
    assert(openCheckRes.status === 200, 'Open Trip: Summary Check Booking HTTP 200');
    assert(Number(openCheckRes.body.baseAmount) === openBase, 'Open Trip: Summary baseAmount matches stored value');
    assert(Number(openCheckRes.body.discount) === openDiscount, 'Open Trip: Summary discount matches stored value');
    assert(Number(openCheckRes.body.uniqueCode) === openUnique, 'Open Trip: Summary uniqueCode matches stored value');
    assert(Number(openCheckRes.body.paymentAmount) === openPayment, 'Open Trip: Summary paymentAmount matches stored value');

    const openPayRes = await httpRequest(TEST_SERVER_PORT, '/api/artopay/payment-intent', { method: 'POST' }, {
      orderId: openTripOrderId,
      amount: openPayment,
      currency: 'IDR'
    });
    assert(openPayRes.status === 200, 'Open Trip: ArtoPay Intent HTTP 200');
    const openOutbound = outboundArtoPayRequests[outboundArtoPayRequests.length - 1];
    assert(openOutbound && String(openOutbound.body.amount) === String(openPayment), `Open Trip: ArtoPay received exact Final Payment IDR (${openPayment})`);
    assert(openOutbound && openOutbound.body.currency === 'IDR', 'Open Trip: ArtoPay currency IDR verified');

    // =========================================================================
    // SERVICE 3: AIRPORT TRANSFER
    // =========================================================================
    console.log('\n============================================================');
    console.log('📌 SERVICE 3: AIRPORT TRANSFER');
    console.log('============================================================');

    const airportRoutesRes = await httpRequest(TEST_SERVER_PORT, '/api/airport-routes');
    const airportRoutes = Array.isArray(airportRoutesRes.body) ? airportRoutesRes.body : [];
    const airportRoute = airportRoutes.find(r => Number(r.priceIDR) > 0) || airportRoutes[0] || { id: 'ap-route-p5b-1791025346241', airport: 'SUB', city: 'Malang Kota Center', priceIDR: 450000 };

    const airportDeparture = new Date(Date.now() + 86400000 * (42 + Math.floor(Math.random() * 30))).toISOString().split('T')[0];
    const airportOrderId = `SJ-AIRPORT-${Date.now().toString().slice(-6)}`;

    const airportBookingPayload = {
      id: airportOrderId,
      bookingCode: airportOrderId,
      type: 'airport',
      serviceType: 'airport',
      serviceId: airportRoute.id,
      routeId: airportRoute.id,
      serviceName: `Airport Transfer: ${airportRoute.airport} - ${airportRoute.city}`,
      departureDate: airportDeparture,
      customerName: 'Traveler Airport Transfer',
      customerEmail: 'traveler.airport@example.com',
      customerPhone: '+6281234567892',
      participantsCount: 2,
      details: {
        flightNumber: 'GA-234',
        airport: airportRoute.airport,
        destination: airportRoute.city,
        vehicleId: 'innova',
        vehicleName: 'Toyota Innova Reborn',
        routeType: 'One Way'
      },
      promoCode: promoCode
    };

    const airportCreateRes = await httpRequest(TEST_SERVER_PORT, '/api/bookings', { method: 'POST' }, airportBookingPayload);
    if (airportCreateRes.status !== 201) console.error('Airport Create Failed:', airportCreateRes.status, airportCreateRes.body);
    assert(airportCreateRes.status === 201, 'Airport Transfer: Booking created successfully', `Order: ${airportOrderId}`);
    const airportBooking = airportCreateRes.body;

    const airportBase = Number(airportBooking.baseAmount);
    const airportDiscount = Number(airportBooking.discount || 0);
    const airportUnique = Number(airportBooking.uniqueCode);
    const airportPayment = Number(airportBooking.paymentAmount);

    assert(airportBase > 0, `Airport Transfer: Base Price valid (Rp ${airportBase.toLocaleString('id-ID')})`);
    assert(airportDiscount === 50000, `Airport Transfer: Discount valid (Rp ${airportDiscount.toLocaleString('id-ID')})`);
    assert(airportUnique >= 1 && airportUnique <= 99, `Airport Transfer: Unique Code valid (${airportUnique})`);
    assert(airportBase - airportDiscount + airportUnique === airportPayment, `Airport Transfer Formula: Base - Discount + Unique === Final Payment (${airportBase} - ${airportDiscount} + ${airportUnique} = ${airportPayment})`);

    const airportCheckRes = await httpRequest(TEST_SERVER_PORT, `/api/private-tour/check-booking/${airportOrderId}`);
    assert(airportCheckRes.status === 200, 'Airport Transfer: Summary Check Booking HTTP 200');
    assert(Number(airportCheckRes.body.baseAmount) === airportBase, 'Airport Transfer: Summary baseAmount matches stored value');
    assert(Number(airportCheckRes.body.discount) === airportDiscount, 'Airport Transfer: Summary discount matches stored value');
    assert(Number(airportCheckRes.body.uniqueCode) === airportUnique, 'Airport Transfer: Summary uniqueCode matches stored value');
    assert(Number(airportCheckRes.body.paymentAmount) === airportPayment, 'Airport Transfer: Summary paymentAmount matches stored value');

    const airportPayRes = await httpRequest(TEST_SERVER_PORT, '/api/artopay/payment-intent', { method: 'POST' }, {
      orderId: airportOrderId,
      amount: airportPayment,
      currency: 'IDR'
    });
    assert(airportPayRes.status === 200, 'Airport Transfer: ArtoPay Intent HTTP 200');
    const airportOutbound = outboundArtoPayRequests[outboundArtoPayRequests.length - 1];
    assert(airportOutbound && String(airportOutbound.body.amount) === String(airportPayment), `Airport Transfer: ArtoPay received exact Final Payment IDR (${airportPayment})`);
    assert(airportOutbound && airportOutbound.body.currency === 'IDR', 'Airport Transfer: ArtoPay currency IDR verified');

    // =========================================================================
    // SERVICE 4: TAXI
    // =========================================================================
    console.log('\n============================================================');
    console.log('📌 SERVICE 4: TAXI');
    console.log('============================================================');

    const taxiRes = await httpRequest(TEST_SERVER_PORT, '/api/taxi/all');
    const taxiRules = (taxiRes.body?.pricingRules || taxiRes.body || []);
    const taxiRule = taxiRules.find(r => Number(r.price_idr || r.priceIDR) > 0) || taxiRules[0] || { id: 'tx-rule-p5b-1791025346271', price_idr: 300000, source_id: 'area-sub-p5b', destination_id: 'area-mlg-p5b' };

    const taxiDeparture = new Date(Date.now() + 86400000 * (45 + Math.floor(Math.random() * 30))).toISOString().split('T')[0];
    const taxiOrderId = `SJ-TAXI-${Date.now().toString().slice(-6)}`;

    const taxiBookingPayload = {
      id: taxiOrderId,
      bookingCode: taxiOrderId,
      type: 'taxi',
      serviceType: 'taxi',
      serviceId: taxiRule.id,
      ruleId: taxiRule.id,
      serviceName: 'Private Taxi Transfer',
      departureDate: taxiDeparture,
      customerName: 'Traveler Taxi',
      customerEmail: 'traveler.taxi@example.com',
      customerPhone: '+6281234567893',
      participantsCount: 3,
      details: {
        pickupAreaId: taxiRule.source_id,
        destAreaId: taxiRule.destination_id,
        vehicleId: 'innova'
      },
      promoCode: promoCode
    };

    const taxiCreateRes = await httpRequest(TEST_SERVER_PORT, '/api/bookings', { method: 'POST' }, taxiBookingPayload);
    if (taxiCreateRes.status !== 201) console.error('Taxi Create Failed:', taxiCreateRes.status, taxiCreateRes.body);
    assert(taxiCreateRes.status === 201, 'Taxi: Booking created successfully', `Order: ${taxiOrderId}`);
    const taxiBooking = taxiCreateRes.body;

    const taxiBase = Number(taxiBooking.baseAmount);
    const taxiDiscount = Number(taxiBooking.discount || 0);
    const taxiUnique = Number(taxiBooking.uniqueCode);
    const taxiPayment = Number(taxiBooking.paymentAmount);

    assert(taxiBase > 0, `Taxi: Base Price valid (Rp ${taxiBase.toLocaleString('id-ID')})`);
    assert(taxiDiscount === 50000, `Taxi: Discount valid (Rp ${taxiDiscount.toLocaleString('id-ID')})`);
    assert(taxiUnique >= 1 && taxiUnique <= 99, `Taxi: Unique Code valid (${taxiUnique})`);
    assert(taxiBase - taxiDiscount + taxiUnique === taxiPayment, `Taxi Formula: Base - Discount + Unique === Final Payment (${taxiBase} - ${taxiDiscount} + ${taxiUnique} = ${taxiPayment})`);

    const taxiCheckRes = await httpRequest(TEST_SERVER_PORT, `/api/private-tour/check-booking/${taxiOrderId}`);
    assert(taxiCheckRes.status === 200, 'Taxi: Summary Check Booking HTTP 200');
    assert(Number(taxiCheckRes.body.baseAmount) === taxiBase, 'Taxi: Summary baseAmount matches stored value');
    assert(Number(taxiCheckRes.body.discount) === taxiDiscount, 'Taxi: Summary discount matches stored value');
    assert(Number(taxiCheckRes.body.uniqueCode) === taxiUnique, 'Taxi: Summary uniqueCode matches stored value');
    assert(Number(taxiCheckRes.body.paymentAmount) === taxiPayment, 'Taxi: Summary paymentAmount matches stored value');

    const taxiPayRes = await httpRequest(TEST_SERVER_PORT, '/api/artopay/payment-intent', { method: 'POST' }, {
      orderId: taxiOrderId,
      amount: taxiPayment,
      currency: 'IDR'
    });
    assert(taxiPayRes.status === 200, 'Taxi: ArtoPay Intent HTTP 200');
    const taxiOutbound = outboundArtoPayRequests[outboundArtoPayRequests.length - 1];
    assert(taxiOutbound && String(taxiOutbound.body.amount) === String(taxiPayment), `Taxi: ArtoPay received exact Final Payment IDR (${taxiPayment})`);
    assert(taxiOutbound && taxiOutbound.body.currency === 'IDR', 'Taxi: ArtoPay currency IDR verified');

    // =========================================================================
    // SERVICE 5: CAR RENTAL
    // =========================================================================
    console.log('\n============================================================');
    console.log('📌 SERVICE 5: CAR RENTAL');
    console.log('============================================================');

    const rentalsRes = await httpRequest(TEST_SERVER_PORT, '/api/rentals');
    const rentalVehicles = (rentalsRes.body?.vehicles || []);
    const rentalVehicle = rentalVehicles.find(v => Number(v.pricePerDayIDR) > 0) || rentalVehicles[0] || { id: 'car-p5b-avanza-1791025345757', name: 'Toyota Avanza', pricePerDayIDR: 450000 };

    const rentalDeparture = new Date(Date.now() + 86400000 * (48 + Math.floor(Math.random() * 30))).toISOString().split('T')[0];
    const rentalOrderId = `SJ-RENTAL-${Date.now().toString().slice(-6)}`;

    const rentalBookingPayload = {
      id: rentalOrderId,
      bookingCode: rentalOrderId,
      type: 'rental',
      serviceType: 'rental',
      serviceId: rentalVehicle.id,
      vehicleId: rentalVehicle.id,
      serviceName: `Car Rental: ${rentalVehicle.name}`,
      departureDate: rentalDeparture,
      customerName: 'Traveler Car Rental',
      customerEmail: 'traveler.rental@example.com',
      customerPhone: '+6281234567894',
      participantsCount: 4,
      details: {
        vehicleId: rentalVehicle.id,
        vehicleName: rentalVehicle.name,
        days: 3,
        withDriver: true,
        pickupLocation: 'Malang City',
        destination: 'Batu Tourism Area',
        pickupDetail: 'Hotel Tugu Malang'
      },
      promoCode: promoCode
    };

    const rentalCreateRes = await httpRequest(TEST_SERVER_PORT, '/api/bookings', { method: 'POST' }, rentalBookingPayload);
    if (rentalCreateRes.status !== 201) console.error('Rental Create Failed:', rentalCreateRes.status, rentalCreateRes.body);
    assert(rentalCreateRes.status === 201, 'Car Rental: Booking created successfully', `Order: ${rentalOrderId}`);
    const rentalBooking = rentalCreateRes.body;

    const rentalBase = Number(rentalBooking.baseAmount);
    const rentalDiscount = Number(rentalBooking.discount || 0);
    const rentalUnique = Number(rentalBooking.uniqueCode);
    const rentalPayment = Number(rentalBooking.paymentAmount);

    assert(rentalBase > 0, `Car Rental: Base Price valid (Rp ${rentalBase.toLocaleString('id-ID')})`);
    assert(rentalDiscount === 50000, `Car Rental: Discount valid (Rp ${rentalDiscount.toLocaleString('id-ID')})`);
    assert(rentalUnique >= 1 && rentalUnique <= 99, `Car Rental: Unique Code valid (${rentalUnique})`);
    assert(rentalBase - rentalDiscount + rentalUnique === rentalPayment, `Car Rental Formula: Base - Discount + Unique === Final Payment (${rentalBase} - ${rentalDiscount} + ${rentalUnique} = ${rentalPayment})`);

    const rentalCheckRes = await httpRequest(TEST_SERVER_PORT, `/api/private-tour/check-booking/${rentalOrderId}`);
    assert(rentalCheckRes.status === 200, 'Car Rental: Summary Check Booking HTTP 200');
    assert(Number(rentalCheckRes.body.baseAmount) === rentalBase, 'Car Rental: Summary baseAmount matches stored value');
    assert(Number(rentalCheckRes.body.discount) === rentalDiscount, 'Car Rental: Summary discount matches stored value');
    assert(Number(rentalCheckRes.body.uniqueCode) === rentalUnique, 'Car Rental: Summary uniqueCode matches stored value');
    assert(Number(rentalCheckRes.body.paymentAmount) === rentalPayment, 'Car Rental: Summary paymentAmount matches stored value');

    const rentalPayRes = await httpRequest(TEST_SERVER_PORT, '/api/artopay/payment-intent', { method: 'POST' }, {
      orderId: rentalOrderId,
      amount: rentalPayment,
      currency: 'IDR'
    });
    assert(rentalPayRes.status === 200, 'Car Rental: ArtoPay Intent HTTP 200');
    const rentalOutbound = outboundArtoPayRequests[outboundArtoPayRequests.length - 1];
    assert(rentalOutbound && String(rentalOutbound.body.amount) === String(rentalPayment), `Car Rental: ArtoPay received exact Final Payment IDR (${rentalPayment})`);
    assert(rentalOutbound && rentalOutbound.body.currency === 'IDR', 'Car Rental: ArtoPay currency IDR verified');

    // =========================================================================
    // SECTION 6: IMMUTABILITY AUDIT ACROSS ALL 5 SERVICES (REOPEN & RETRY)
    // =========================================================================
    console.log('\n============================================================');
    console.log('📌 IMMUTABILITY AUDIT: REOPEN & RETRY FOR ALL 5 SERVICES');
    console.log('============================================================');

    const allFiveOrders = [
      { name: 'Private Tour', orderId: tourOrderId, base: tourBase, disc: tourDiscount, unique: tourUnique, pay: tourPayment },
      { name: 'Open Trip', orderId: openTripOrderId, base: openBase, disc: openDiscount, unique: openUnique, pay: openPayment },
      { name: 'Airport Transfer', orderId: airportOrderId, base: airportBase, disc: airportDiscount, unique: airportUnique, pay: airportPayment },
      { name: 'Taxi', orderId: taxiOrderId, base: taxiBase, disc: taxiDiscount, unique: taxiUnique, pay: taxiPayment },
      { name: 'Car Rental', orderId: rentalOrderId, base: rentalBase, disc: rentalDiscount, unique: rentalUnique, pay: rentalPayment }
    ];

    for (const s of allFiveOrders) {
      // Reopen check
      const reopenRes = await httpRequest(TEST_SERVER_PORT, `/api/private-tour/check-booking/${s.orderId}`);
      assert(reopenRes.status === 200 && Number(reopenRes.body.paymentAmount) === s.pay, `${s.name}: Reopen preserves paymentAmount (${s.pay})`);
      assert(Number(reopenRes.body.uniqueCode) === s.unique, `${s.name}: Reopen preserves uniqueCode (${s.unique})`);

      // Retry payment
      const retryPayRes = await httpRequest(TEST_SERVER_PORT, '/api/artopay/payment-intent', { method: 'POST' }, {
        orderId: s.orderId,
        amount: s.pay,
        currency: 'IDR'
      });
      assert(retryPayRes.status === 200, `${s.name}: Retry ArtoPay payment returns HTTP 200`);
      const retryOutbound = outboundArtoPayRequests[outboundArtoPayRequests.length - 1];
      assert(retryOutbound && String(retryOutbound.body.amount) === String(s.pay), `${s.name}: ArtoPay Retry receives exact same stored amount (${s.pay})`);
    }

    // =========================================================================
    // FINAL SUMMARY
    // =========================================================================
    console.log('\n================================================================');
    if (failed === 0) {
      console.log(`🎉 ALL 5 SERVICES PASSED AUDIT! (${passed} PASSED, ${failed} FAILED)`);
      console.log('   Pola: Base Price - Discount + Unique Code = Final Payment terbukti 100% konsisten.');
      console.log('   Payment Summary & ArtoPay menerima nominal IDR yang persis sama di semua 5 layanan.');
      console.log('================================================================\n');
      process.exit(0);
    } else {
      console.error(`💥 AUDIT FAILED! (${passed} PASSED, ${failed} FAILED)`);
      console.log('================================================================\n');
      process.exit(1);
    }

  } catch (err) {
    console.error('Fatal Test Error:', err);
    process.exit(1);
  } finally {
    if (serverProc) {
      serverProc.kill('SIGTERM');
    }
    if (mockGateway) {
      mockGateway.close();
    }
  }
}

run();
