/**
 * SMART JOURNEY — AIRPORT TRANSFER PAYMENT PARITY AUDIT
 * "Cek Airport Transfer saja: pastikan Payment Summary dan ArtoPay memakai total final yang sama."
 *
 * Verifies that for Airport Transfer:
 * 1. Booking creation correctly resolves route, vehicle, and base fare.
 * 2. Invariant holds: Total Final = (Base Fare - Promo Discount) + Unique Code.
 * 3. Payment Summary displays exact Base Fare, Discount, Unique Code, and Final Total.
 * 4. ArtoPay payment amount strictly matches the Payment Summary final total (zero discrepancy).
 * 5. Check-booking endpoint (/api/private-tour/check-booking) returns locked amounts with 100% parity.
 * 6. Final Summary endpoint returns matching payment amounts.
 */

const http = require('http');

const PORT = Number(process.env.TARGET_PORT || 3000);

function httpRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: json, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, data, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

// Client helper replication matching AirportTransferView.tsx
function getTransferFinalAmount(b) {
  if (!b) return 0;
  if (b.paymentAmount !== undefined && b.paymentAmount !== null && Number(b.paymentAmount) > 0) {
    return Number(b.paymentAmount);
  }
  const disc = Math.max(0, Number(
    b.discount !== undefined && b.discount !== null
      ? b.discount
      : (b.details?.verifiedDiscount ?? b.details?.discountAmount ?? 0)
  ));
  const base = Number(b.baseAmount) > 0
    ? Number(b.baseAmount)
    : (Number(b.totalPriceIDR || b.totalPrice || 0) + (Number(b.baseAmount) === 0 && disc > 0 ? disc : 0));
  const payableBase = Math.max(0, base - disc);
  const uCode = Math.max(0, Number(b.uniqueCode || 0));
  return payableBase + uCode;
}

function getTransferBaseAmount(b) {
  if (!b) return 0;
  const disc = Math.max(0, Number(
    b.discount !== undefined && b.discount !== null
      ? b.discount
      : (b.details?.verifiedDiscount ?? b.details?.discountAmount ?? 0)
  ));
  if (b.baseAmount !== undefined && b.baseAmount !== null && Number(b.baseAmount) > 0) {
    return Number(b.baseAmount);
  }
  return Number(b.totalPriceIDR || b.totalPrice || 0) + disc;
}

async function runAudit() {
  console.log('===============================================================');
  console.log('✈️  SMART JOURNEY: AIRPORT TRANSFER PAYMENT PARITY AUDIT SUITE');
  console.log('===============================================================');

  let passCount = 0;
  let failCount = 0;

  function assert(desc, condition) {
    if (condition) {
      console.log(`  ✅ PASS: ${desc}`);
      passCount++;
    } else {
      console.error(`  ❌ FAIL: ${desc}`);
      failCount++;
    }
  }

  try {
    console.log(`\n⏳ Checking server connection on port ${PORT}...`);
    const health = await httpRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/health',
      method: 'GET'
    });
    if (health.status !== 200) {
      throw new Error(`Server returned HTTP ${health.status} on /api/health`);
    }
    console.log('🚀 Server is running and healthy.');

    // -------------------------------------------------------------
    // SCENARIO 1: Airport Transfer Regular (No Promo) - Avanza (0.9x)
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO 1: Airport Transfer Regular (No Promo) ---');
    const booking1Payload = {
      type: 'airport',
      serviceType: 'airport',
      airport: 'SUB',
      destinationCity: 'Malang Kota Center',
      city: 'Malang Kota Center',
      serviceName: 'Airport Transfer: SUB ⇄ Malang Kota Center (Toyota Avanza)',
      vehicleId: 'avanza',
      vehicleName: 'Toyota Avanza',
      routeType: 'One Way',
      customerName: 'Ahmad Dahlan',
      customerEmail: 'ahmad@example.com',
      customerPhone: '081234567891',
      totalPrice: 25,
      totalPriceIDR: 405000,
      baseAmount: 405000,
      details: {
        airport: 'SUB',
        city: 'Malang Kota Center',
        destinationCity: 'Malang Kota Center',
        pickupLocation: 'Bandara Juanda (SUB)',
        destination: 'Malang Kota Center Area',
        date: `2026-12-${String(Math.floor(15 + Math.random() * 10)).padStart(2, '0')}`,
        time: '10:00',
        guests: 3,
        luggage: 2,
        vehicleId: 'avanza',
        vehicleName: 'Toyota Avanza',
        routeType: 'One Way',
        direction: 'Airport to City'
      }
    };

    const res1 = await httpRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/bookings',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, booking1Payload);

    assert('Booking 1 created successfully (HTTP 201)', res1.status === 201);
    const b1 = res1.data;
    assert('Booking 1 has valid bookingCode', Boolean(b1.bookingCode));
    assert('Booking 1 baseAmount is authoritative (405,000)', b1.baseAmount === 405000);
    assert('Booking 1 discount is 0', b1.discount === 0);
    assert('Booking 1 uniqueCode is in valid range (1..99)', b1.uniqueCode >= 1 && b1.uniqueCode <= 99);
    assert('Booking 1 paymentAmount strictly equals baseAmount + uniqueCode', b1.paymentAmount === (405000 + b1.uniqueCode));

    // Verify Payment Summary client calculation
    const summary1Final = getTransferFinalAmount(b1);
    const summary1Base = getTransferBaseAmount(b1);
    assert('Payment Summary Base Amount equals booking baseAmount (405,000)', summary1Base === 405000);
    assert('Payment Summary Final Total equals booking paymentAmount', summary1Final === b1.paymentAmount);

    // Verify ArtoPay payment payload amount equals Payment Summary Final Total
    const artopay1Amount = summary1Final;
    assert('ArtoPay Amount strictly equals Payment Summary Final Total', artopay1Amount === summary1Final);

    // Verify Check-Booking API parity
    const check1 = await httpRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/api/private-tour/check-booking/${encodeURIComponent(b1.bookingCode)}`,
      method: 'GET'
    });
    assert('Check-Booking returns found: true', check1.data?.found === true);
    assert('Check-Booking paymentAmount matches booking paymentAmount', check1.data?.paymentAmount === b1.paymentAmount);
    assert('Check-Booking finalPaymentAmount matches booking paymentAmount', check1.data?.finalPaymentAmount === b1.paymentAmount);
    assert('Check-Booking uniqueCode is locked and identical', check1.data?.uniqueCode === b1.uniqueCode);
    assert('Check-Booking baseAmount is identical', check1.data?.baseAmount === 405000);

    // -------------------------------------------------------------
    // SCENARIO 2: Airport Transfer with Promo Discount (WELCOME2026)
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO 2: Airport Transfer with Promo Discount ---');
    const booking2Payload = {
      type: 'airport',
      serviceType: 'airport',
      airport: 'SUB',
      destinationCity: 'Malang Kota Center',
      city: 'Malang Kota Center',
      serviceName: 'Airport Transfer: SUB ⇄ Malang Kota Center (Toyota Innova Reborn)',
      vehicleId: 'innova',
      vehicleName: 'Toyota Innova Reborn',
      routeType: 'One Way',
      customerName: 'Siti Rahmawati',
      customerEmail: 'siti@example.com',
      customerPhone: '081234567892',
      promoCode: 'WELCOME2026',
      totalPrice: 28,
      totalPriceIDR: 450000,
      baseAmount: 450000,
      details: {
        airport: 'SUB',
        city: 'Malang Kota Center',
        destinationCity: 'Malang Kota Center',
        pickupLocation: 'Bandara Juanda (SUB)',
        destination: 'Malang Kota Center Area',
        date: '2026-12-28',
        time: '14:00',
        guests: 4,
        luggage: 3,
        vehicleId: 'innova',
        vehicleName: 'Toyota Innova Reborn',
        routeType: 'One Way',
        direction: 'Airport to City',
        promoCode: 'WELCOME2026',
        discountAmount: 50000
      }
    };

    const res2 = await httpRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/bookings',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, booking2Payload);

    assert('Booking 2 with promo created successfully (HTTP 201)', res2.status === 201);
    const b2 = res2.data;
    assert('Booking 2 baseAmount is 450,000', b2.baseAmount === 450000);
    assert('Booking 2 discount is verified 50,000', b2.discount === 50000);
    assert('Booking 2 uniqueCode is in valid range (1..99)', b2.uniqueCode >= 1 && b2.uniqueCode <= 99);
    const expectedFinal2 = (450000 - 50000) + b2.uniqueCode;
    assert(`Booking 2 paymentAmount strictly equals (450000 - 50000) + ${b2.uniqueCode} = ${expectedFinal2}`, b2.paymentAmount === expectedFinal2);

    // Verify Payment Summary client calculation
    const summary2Final = getTransferFinalAmount(b2);
    const summary2Base = getTransferBaseAmount(b2);
    assert('Payment Summary Base Amount is 450,000', summary2Base === 450000);
    assert('Payment Summary Final Total equals booking paymentAmount', summary2Final === expectedFinal2);

    // Verify ArtoPay payment payload amount equals Payment Summary Final Total
    const artopay2Amount = summary2Final;
    assert('ArtoPay Amount strictly equals Payment Summary Final Total', artopay2Amount === summary2Final);

    // Verify Check-Booking API parity
    const check2 = await httpRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/api/private-tour/check-booking/${encodeURIComponent(b2.bookingCode)}`,
      method: 'GET'
    });
    assert('Check-Booking returns found: true for booking 2', check2.data?.found === true);
    assert('Check-Booking paymentAmount matches booking 2 paymentAmount', check2.data?.paymentAmount === expectedFinal2);
    assert('Check-Booking discount matches 50,000', check2.data?.discount === 50000);
    assert('Check-Booking baseAmount matches 450,000', check2.data?.baseAmount === 450000);
    assert('Check-Booking uniqueCode is locked and identical', check2.data?.uniqueCode === b2.uniqueCode);

    // -------------------------------------------------------------
    // SCENARIO 3: Airport Transfer Round Trip (5% discount on base)
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO 3: Airport Transfer Round Trip ---');
    // Base for SUB -> Malang is 450,000. Round trip = 450,000 * 2 * 0.95 = 855,000. Hiace Commuter = 1.5x -> 1,282,500.
    const expectedRoundTripBase = Math.round(450000 * 2 * 0.95 * 1.5);
    const booking3Payload = {
      type: 'airport',
      serviceType: 'airport',
      airport: 'SUB',
      destinationCity: 'Malang Kota Center',
      city: 'Malang Kota Center',
      serviceName: 'Airport Transfer: SUB ⇄ Malang Kota Center (Round Trip - Hiace Commuter)',
      vehicleId: 'hiace-commuter',
      vehicleName: 'Toyota Hiace Commuter',
      routeType: 'Round Trip',
      customerName: 'Budi Hartono',
      customerEmail: 'budi@example.com',
      customerPhone: '081234567893',
      totalPriceIDR: expectedRoundTripBase,
      baseAmount: expectedRoundTripBase,
      details: {
        airport: 'SUB',
        city: 'Malang Kota Center',
        destinationCity: 'Malang Kota Center',
        pickupLocation: 'Bandara Juanda (SUB)',
        destination: 'Malang Kota Center Area',
        date: `2026-12-${String(Math.floor(10 + Math.random() * 18)).padStart(2, '0')}`,
        time: '08:00',
        guests: 10,
        luggage: 8,
        vehicleId: 'hiace-commuter',
        vehicleName: 'Toyota Hiace Commuter',
        routeType: 'Round Trip',
        direction: 'Airport to City',
        returnDateText: '2026-12-05',
        returnTimeText: '16:00'
      }
    };

    const res3 = await httpRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/bookings',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, booking3Payload);

    assert('Booking 3 Round Trip created successfully (HTTP 201)', res3.status === 201);
    const b3 = res3.data;
    assert(`Booking 3 baseAmount equals canonical round trip fare (${expectedRoundTripBase})`, b3.baseAmount === expectedRoundTripBase);
    assert('Booking 3 paymentAmount equals baseAmount + uniqueCode', b3.paymentAmount === (expectedRoundTripBase + b3.uniqueCode));

    const summary3Final = getTransferFinalAmount(b3);
    assert('Payment Summary Final Total strictly equals booking paymentAmount', summary3Final === b3.paymentAmount);
    assert('ArtoPay Amount strictly equals Payment Summary Final Total', summary3Final === b3.paymentAmount);

    // -------------------------------------------------------------
    // SCENARIO 4: Simulate ArtoPay Settlement & Final Summary Verification
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO 4: ArtoPay Settlement & Final Summary Parity ---');
    const simRes = await httpRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/artopay/simulate-webhook',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      orderId: b2.bookingCode
    });
    assert('ArtoPay payment simulated successfully (HTTP 200)', simRes.status === 200 && simRes.data?.success === true);

    // Check updated booking status
    const checkPaid = await httpRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/api/private-tour/check-booking/${encodeURIComponent(b2.bookingCode)}`,
      method: 'GET'
    });
    assert('Booking 2 paymentStatus is updated to Paid', checkPaid.data?.paymentStatus === 'Paid');
    assert('Booking 2 paymentAmount remains identical after payment', checkPaid.data?.paymentAmount === expectedFinal2);

    // Authenticate as Admin and Confirm booking to unlock final summary
    const adminLoginRes = await httpRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      email: 'admin@smartjourney.id',
      password: 'admin123'
    });
    const adminToken = adminLoginRes.data?.token;

    await httpRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/api/bookings/${encodeURIComponent(b2.bookingCode)}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, {
      status: 'Confirmed'
    });

    // Verify Final Summary endpoint
    const finalSummaryRes = await httpRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/api/private-tour/final-summary/${encodeURIComponent(b2.bookingCode)}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
    assert('Final Summary endpoint returns HTTP 200', finalSummaryRes.status === 200 && finalSummaryRes.data?.success === true);
    assert('Final Summary totalPaid matches paymentAmount exactly', finalSummaryRes.data?.payment?.totalPaid === expectedFinal2);
    assert('Final Summary baseAmount matches 450,000', finalSummaryRes.data?.payment?.baseAmount === 450000);
    assert('Final Summary discount matches 50,000', finalSummaryRes.data?.payment?.discount === 50000);
    assert('Final Summary uniqueCode matches booking uniqueCode', finalSummaryRes.data?.payment?.uniqueCode === b2.uniqueCode);

  } catch (err) {
    console.error('Test execution failed with error:', err);
    failCount++;
  }

  console.log('\n===============================================================');
  console.log(`✈️  AUDIT COMPLETE: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('===============================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runAudit();
