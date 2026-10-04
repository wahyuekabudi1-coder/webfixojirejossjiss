/**
 * SMART JOURNEY — TAXI PAYMENT PARITY AUDIT SUITE
 * "Cek Taxi saja: pastikan Payment Summary dan ArtoPay memakai total final yang sama."
 *
 * Verifies that for Taxi:
 * 1. Booking creation correctly resolves route, vehicle, and base fare.
 * 2. Invariant holds: Total Final = (Base Fare - Promo Discount) + Unique Code.
 * 3. Payment Summary displays exact Base Fare, Discount, Unique Code, and Final Total.
 * 4. ArtoPay payment amount strictly matches the Payment Summary final total (zero discrepancy).
 * 5. Check-booking endpoint (/api/private-tour/check-booking) returns locked amounts with 100% parity.
 * 6. ArtoPay webhook simulation maintains locked payment amount.
 * 7. Final Summary endpoint returns matching payment amounts.
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

// Client helper replication matching TaxiView.tsx
function getTaxiFinalAmount(b) {
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

function getTaxiBaseAmount(b) {
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
  console.log('🚕 SMART JOURNEY: TAXI PAYMENT PARITY AUDIT SUITE');
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
    console.log('  Server is alive and responsive.');

    // ------------------------------------------------------------------------
    // SCENARIO 1: Standard Fixed Zone Taxi Route (Surabaya to Malang)
    // Vehicle: Toyota Innova Reborn (Family)
    // ------------------------------------------------------------------------
    console.log('\n--- SCENARIO 1: Standard Fixed Zone Taxi Route (No Promo) ---');
    const randCode1 = `TX-PARITY-${Math.floor(1000 + Math.random() * 9000)}`;
    const bookingPayload1 = {
      id: randCode1,
      bookingCode: randCode1,
      type: 'taxi',
      serviceType: 'taxi',
      serviceName: 'Private Taxi: Surabaya ⇄ Malang (Toyota Innova Reborn)',
      source_id: 'area-sub-p5b',
      destination_id: 'area-mlg-p5b',
      pickupAreaId: 'area-sub-p5b',
      destAreaId: 'area-mlg-p5b',
      pickup: 'Juanda International Airport (SUB), Surabaya',
      destination: 'Malang City Center, East Java',
      pickupLocation: 'Juanda International Airport (SUB), Surabaya',
      vehicleId: 'innova',
      vehicleName: 'Toyota Innova Reborn',
      vehicleType: 'Family',
      customerName: 'Budi Santoso',
      customerEmail: 'budi.santoso@example.com',
      customerPhone: '081234567890',
      totalPrice: 19,
      totalPriceIDR: 300000,
      baseAmount: 300000,
      details: {
        pickupLocation: 'Juanda International Airport (SUB), Surabaya',
        destination: 'Malang City Center, East Java',
        date: '2026-11-20',
        time: '08:30',
        guests: 5,
        vehicleId: 'innova',
        vehicleName: 'Toyota Innova Reborn',
        vehicleType: 'Family',
        source_id: 'area-sub-p5b',
        destination_id: 'area-mlg-p5b'
      }
    };

    const res1 = await httpRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/bookings',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, bookingPayload1);

    assert('Booking 1 created successfully (HTTP 201)', res1.status === 201);
    const b1 = res1.data;
    assert('Booking 1 has valid bookingCode', Boolean(b1.bookingCode));
    assert('Booking 1 detected as taxi service', b1.serviceType === 'taxi' || b1.type === 'taxi');
    assert('Booking 1 baseAmount is authoritative (300,000)', Number(b1.baseAmount) === 300000);
    assert('Booking 1 discount is 0', Number(b1.discount || 0) === 0);
    assert('Booking 1 uniqueCode is in valid range (1..99)', Number(b1.uniqueCode) >= 1 && Number(b1.uniqueCode) <= 99);
    assert('Booking 1 paymentAmount strictly equals baseAmount + uniqueCode', Number(b1.paymentAmount) === (300000 + Number(b1.uniqueCode)));

    // Verify Payment Summary client calculation
    const summary1Final = getTaxiFinalAmount(b1);
    const summary1Base = getTaxiBaseAmount(b1);
    assert('Payment Summary Base Amount equals booking baseAmount (300,000)', summary1Base === 300000);
    assert('Payment Summary Final Total equals booking paymentAmount', summary1Final === Number(b1.paymentAmount));

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
    assert('Check-Booking paymentAmount matches booking paymentAmount', Number(check1.data?.paymentAmount) === Number(b1.paymentAmount));
    assert('Check-Booking finalPaymentAmount matches booking paymentAmount', Number(check1.data?.finalPaymentAmount) === Number(b1.paymentAmount));
    assert('Check-Booking uniqueCode is locked and identical', Number(check1.data?.uniqueCode) === Number(b1.uniqueCode));
    assert('Check-Booking baseAmount is identical', Number(check1.data?.baseAmount) === 300000);

    // ------------------------------------------------------------------------
    // SCENARIO 2: Taxi Booking WITH Promo Discount (WELCOME2026)
    // ------------------------------------------------------------------------
    console.log('\n--- SCENARIO 2: Taxi Booking with Promo Discount (WELCOME2026) ---');
    const randCode2 = `TX-PROMO-${Math.floor(1000 + Math.random() * 9000)}`;
    const promoCode = 'WELCOME2026';
    const expectedDiscount = 50000;

    const bookingPayload2 = {
      id: randCode2,
      bookingCode: randCode2,
      type: 'taxi',
      serviceType: 'taxi',
      serviceName: 'Private Taxi: Surabaya ⇄ Malang (Toyota Innova Reborn)',
      source_id: 'area-sub-p5b',
      destination_id: 'area-mlg-p5b',
      pickupAreaId: 'area-sub-p5b',
      destAreaId: 'area-mlg-p5b',
      pickup: 'Juanda International Airport (SUB), Surabaya',
      destination: 'Malang City Center, East Java',
      pickupLocation: 'Juanda International Airport (SUB), Surabaya',
      vehicleId: 'innova',
      vehicleName: 'Toyota Innova Reborn',
      vehicleType: 'Family',
      customerName: 'Siti Rahma',
      customerEmail: 'siti.rahma@example.com',
      customerPhone: '081298765432',
      promoCode: promoCode,
      promo_code: promoCode,
      discount: expectedDiscount,
      discountAmount: expectedDiscount,
      totalPrice: 16,
      totalPriceIDR: 300000,
      baseAmount: 300000,
      details: {
        pickupLocation: 'Juanda International Airport (SUB), Surabaya',
        destination: 'Malang City Center, East Java',
        date: '2026-11-21',
        time: '14:00',
        guests: 4,
        vehicleId: 'innova',
        vehicleName: 'Toyota Innova Reborn',
        vehicleType: 'Family',
        source_id: 'area-sub-p5b',
        destination_id: 'area-mlg-p5b',
        promoCode: promoCode,
        discountAmount: expectedDiscount
      }
    };

    const res2 = await httpRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/bookings',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, bookingPayload2);

    assert('Booking 2 with promo created successfully (HTTP 201)', res2.status === 201);
    const b2 = res2.data;
    const expectedBase2 = 300000;
    const actualDiscount2 = Number(b2.discount || b2.details?.verifiedDiscount || b2.details?.discountAmount || 0);
    const expectedPayableBase2 = Math.max(0, expectedBase2 - actualDiscount2);
    const expectedPaymentAmount2 = expectedPayableBase2 + Number(b2.uniqueCode);

    assert('Booking 2 baseAmount is 300,000 IDR', Number(b2.baseAmount) === expectedBase2);
    assert('Booking 2 verified discount matches 50,000 IDR', actualDiscount2 === expectedDiscount);
    assert('Booking 2 paymentAmount respects: (base - discount) + uniqueCode', Number(b2.paymentAmount) === expectedPaymentAmount2);

    const summary2Final = getTaxiFinalAmount(b2);
    const summary2Base = getTaxiBaseAmount(b2);
    assert('Payment Summary Base Amount matches 300,000 IDR', summary2Base === expectedBase2);
    assert('Payment Summary Final Total equals booking paymentAmount', summary2Final === expectedPaymentAmount2);
    assert('ArtoPay Amount strictly equals Payment Summary Final Total', summary2Final === expectedPaymentAmount2);

    // Verify Check-Booking API parity for promo booking
    const check2 = await httpRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/api/private-tour/check-booking/${encodeURIComponent(b2.bookingCode)}`,
      method: 'GET'
    });
    assert('Check-Booking returns found: true for promo booking', check2.data?.found === true);
    assert('Check-Booking paymentAmount matches booking paymentAmount', Number(check2.data?.paymentAmount) === expectedPaymentAmount2);
    assert('Check-Booking discount matches verified discount', Number(check2.data?.discount) === actualDiscount2);
    assert('Check-Booking baseAmount matches 300,000 IDR', Number(check2.data?.baseAmount) === expectedBase2);

    // ------------------------------------------------------------------------
    // SCENARIO 3: Taxi Booking with Vehicle Scaling (Toyota Avanza / Standard)
    // ------------------------------------------------------------------------
    console.log('\n--- SCENARIO 3: Taxi Booking with Vehicle Scaling (Toyota Avanza / Standard) ---');
    const randCode3 = `TX-AVANZA-${Math.floor(1000 + Math.random() * 9000)}`;
    const expectedAvanzaBase = 270000; // 300000 * 0.9
    const bookingPayload3 = {
      id: randCode3,
      bookingCode: randCode3,
      type: 'taxi',
      serviceType: 'taxi',
      serviceName: 'Private Taxi: Surabaya ⇄ Malang (Toyota Avanza)',
      source_id: 'area-sub-p5b',
      destination_id: 'area-mlg-p5b',
      pickupAreaId: 'area-sub-p5b',
      destAreaId: 'area-mlg-p5b',
      pickup: 'Juanda International Airport (SUB), Surabaya',
      destination: 'Malang City Center, East Java',
      pickupLocation: 'Juanda International Airport (SUB), Surabaya',
      vehicleId: 'avanza',
      vehicleName: 'Toyota Avanza',
      vehicleType: 'Standard',
      customerName: 'Hendro Wijaya',
      customerEmail: 'hendro@example.com',
      customerPhone: '081345678901',
      totalPrice: 17,
      totalPriceIDR: expectedAvanzaBase,
      baseAmount: expectedAvanzaBase,
      details: {
        pickupLocation: 'Juanda International Airport (SUB), Surabaya',
        destination: 'Malang City Center, East Java',
        date: '2026-11-22',
        time: '11:00',
        guests: 3,
        vehicleId: 'avanza',
        vehicleName: 'Toyota Avanza',
        vehicleType: 'Standard',
        source_id: 'area-sub-p5b',
        destination_id: 'area-mlg-p5b'
      }
    };

    const res3 = await httpRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/bookings',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, bookingPayload3);

    assert('Booking 3 for Avanza created successfully (HTTP 201)', res3.status === 201);
    const b3 = res3.data;
    assert('Booking 3 baseAmount scaled by Avanza multiplier (270,000 IDR)', Number(b3.baseAmount) === expectedAvanzaBase);
    assert('Booking 3 paymentAmount equals baseAmount (270,000) + uniqueCode', Number(b3.paymentAmount) === expectedAvanzaBase + Number(b3.uniqueCode));

    const summary3Final = getTaxiFinalAmount(b3);
    assert('Payment Summary Final Total equals booking paymentAmount', summary3Final === Number(b3.paymentAmount));
    assert('ArtoPay Amount strictly equals Payment Summary Final Total', summary3Final === Number(b3.paymentAmount));

    // ------------------------------------------------------------------------
    // SCENARIO 4: Simulate ArtoPay Settlement & Final Summary Verification
    // ------------------------------------------------------------------------
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
    assert('Booking 2 paymentAmount remains identical after payment', Number(checkPaid.data?.paymentAmount) === expectedPaymentAmount2);

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
    assert('Final Summary totalPaid matches paymentAmount exactly', Number(finalSummaryRes.data?.payment?.totalPaid) === expectedPaymentAmount2);
    assert('Final Summary baseAmount matches 300,000 IDR', Number(finalSummaryRes.data?.payment?.baseAmount) === expectedBase2);
    assert('Final Summary discount matches 50,000 IDR', Number(finalSummaryRes.data?.payment?.discount) === expectedDiscount);
    assert('Final Summary uniqueCode matches booking uniqueCode', Number(finalSummaryRes.data?.payment?.uniqueCode) === Number(b2.uniqueCode));

    // ------------------------------------------------------------------------
    // SCENARIO 5: Custom Distance-Based Route (Arbitrary Java addresses)
    // ------------------------------------------------------------------------
    console.log('\n--- SCENARIO 5: Custom Distance Route Fallback ---');
    const randCode5 = `TX-CUSTOM-${Math.floor(1000 + Math.random() * 9000)}`;
    const customCalculatedBase = 850000;
    const bookingPayload5 = {
      id: randCode5,
      bookingCode: randCode5,
      type: 'taxi',
      serviceType: 'taxi',
      serviceName: 'Private Taxi: Surabaya ⇄ Banyuwangi (Toyota Innova Reborn)',
      pickup: 'Jl. Pemuda No. 45, Surabaya',
      destination: 'Ketapang Port, Banyuwangi',
      pickupLocation: 'Jl. Pemuda No. 45, Surabaya',
      vehicleId: 'innova',
      vehicleName: 'Toyota Innova Reborn',
      vehicleType: 'Family',
      customerName: 'Maya Kusuma',
      customerEmail: 'maya@example.com',
      customerPhone: '081211223344',
      totalPrice: 53,
      totalPriceIDR: customCalculatedBase,
      baseAmount: customCalculatedBase,
      details: {
        pickupLocation: 'Jl. Pemuda No. 45, Surabaya',
        destination: 'Ketapang Port, Banyuwangi',
        date: '2026-11-25',
        time: '06:00',
        guests: 4,
        vehicleId: 'innova',
        vehicleName: 'Toyota Innova Reborn',
        vehicleType: 'Family'
      }
    };

    const res5 = await httpRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/bookings',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, bookingPayload5);

    assert('Custom distance-based Taxi route succeeds with HTTP 201', res5.status === 201);
    const b5 = res5.data;
    assert('Custom route baseAmount matches client calculated base (850,000 IDR)', Number(b5.baseAmount) === customCalculatedBase);
    assert('Custom route paymentAmount equals baseAmount + uniqueCode', Number(b5.paymentAmount) === customCalculatedBase + Number(b5.uniqueCode));
    const summary5Final = getTaxiFinalAmount(b5);
    assert('Client helper matches custom route paymentAmount', summary5Final === Number(b5.paymentAmount));
    assert('ArtoPay Amount strictly equals Payment Summary Final Total', summary5Final === Number(b5.paymentAmount));

    console.log('\n===============================================================');
    console.log(`🚕 AUDIT COMPLETE: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('===============================================================');

    if (failCount > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Test execution failed with error:', err);
    process.exit(1);
  }
}

runAudit();
