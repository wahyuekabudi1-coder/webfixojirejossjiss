import assert from 'assert';

const BASE_URL = 'http://localhost:3000';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

async function testSimulatePaymentCekBooking() {
  console.log('=================================================================');
  console.log('🧪 TEST: SIMULASI PEMBAYARAN SUKSES DI CEK KODE BOOKING');
  console.log('=================================================================\n');

  // Step 1: Admin login to obtain token
  console.log('[Step 1] Admin authenticating...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: ADMIN_PASSWORD })
  });
  assert.strictEqual(loginRes.status, 200, 'Admin login must succeed');
  const { token } = await loginRes.json();
  assert(token, 'Session token must be present');
  console.log('✅ [Step 1] Admin token acquired.');

  // Step 2: Get initial total count of bookings
  const adminHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };
  const initialBookingsRes = await fetch(`${BASE_URL}/api/bookings`, { headers: adminHeaders });
  assert.strictEqual(initialBookingsRes.status, 200);
  const initialBookings = await initialBookingsRes.json();
  const initialTotalCount = initialBookings.length;
  console.log(`✅ [Step 2] Initial total bookings in database: ${initialTotalCount}`);

  // Step 3: Create a new test booking
  console.log('[Step 3] Creating new booking for simulation test...');
  const randCode = `TX-SIM-${Math.floor(1000 + Math.random() * 9000)}`;
  const createRes = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: randCode,
      bookingCode: randCode,
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
      fullName: 'Test Traveler Cek Booking',
      email: 'test.cekbooking@smartjourney.id',
      phone: '+6281299998888',
      departureDate: '2026-12-15',
      participantsCount: 2,
      totalPrice: 19,
      totalPriceIDR: 300000,
      baseAmount: 300000,
      details: {
        pickupLocation: 'Juanda International Airport (SUB), Surabaya',
        destination: 'Malang City Center, East Java',
        date: '2026-12-15',
        time: '08:30',
        guests: 2,
        vehicleId: 'innova',
        vehicleName: 'Toyota Innova Reborn',
        vehicleType: 'Family'
      }
    })
  });
  assert.strictEqual(createRes.status, 201, 'Booking creation must succeed');
  const createdBooking = await createRes.json();
  const targetCode = createdBooking.bookingCode;
  const initialUniqueCode = createdBooking.uniqueCode;
  const initialPaymentAmount = createdBooking.paymentAmount;
  const initialTotalPriceIDR = createdBooking.totalPriceIDR;
  const initialBaseAmount = createdBooking.baseAmount;

  console.log(`✅ [Step 3] Created booking: Code=${targetCode}, ID=${createdBooking.id}`);
  console.log(`   Initial paymentStatus: ${createdBooking.paymentStatus}`);
  console.log(`   Initial status: ${createdBooking.status}`);
  console.log(`   Initial uniqueCode: ${initialUniqueCode}, paymentAmount: ${initialPaymentAmount}`);
  assert.strictEqual(createdBooking.paymentStatus, 'Pending');

  // Verify database count increased by exactly 1
  const afterCreateBookings = await (await fetch(`${BASE_URL}/api/bookings`, { headers: adminHeaders })).json();
  assert.strictEqual(afterCreateBookings.length, initialTotalCount + 1, 'Exactly 1 new booking created');

  // Step 4: Simulate customer opening "Cek Kode Booking"
  console.log(`[Step 4] Customer checking booking in Cek Kode Booking: "${targetCode}"...`);
  const checkRes = await fetch(`${BASE_URL}/api/private-tour/check-booking/${encodeURIComponent(targetCode)}`);
  assert.strictEqual(checkRes.status, 200);
  const checkedData = await checkRes.json();
  assert.strictEqual(checkedData.bookingCode, targetCode);
  assert.strictEqual(checkedData.paymentStatus, 'Pending');
  assert.strictEqual(checkedData.uniqueCode, initialUniqueCode, 'uniqueCode must remain identical');
  assert.strictEqual(checkedData.paymentAmount, initialPaymentAmount, 'paymentAmount must remain identical');
  console.log('✅ [Step 4] Booking successfully opened in Cek Kode Booking with pending status.');

  // Step 5: Customer clicks "Simulasi Pembayaran Sukses"
  console.log('[Step 5] Clicking "Simulasi Pembayaran Sukses" for the opened booking...');
  const simRes = await fetch(`${BASE_URL}/api/artopay/simulate-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId: targetCode,
      bookingCode: targetCode,
      bookingId: createdBooking.id
    })
  });
  assert.strictEqual(simRes.status, 200, 'simulate-webhook must return HTTP 200');
  const simData = await simRes.json();
  assert.strictEqual(simData.success, true);
  assert.strictEqual(simData.paymentStatus, 'Paid');
  assert.strictEqual(simData.bookingStatus, 'Pending Confirmation');
  console.log('✅ [Step 5] Simulation succeeded: paymentStatus=Paid, bookingStatus=Pending Confirmation.');

  // Step 6: Verify Cek Kode Booking reflects updated status WITHOUT altering pricing or unique code
  console.log('[Step 6] Customer re-checks status in Cek Kode Booking...');
  const recheckRes = await fetch(`${BASE_URL}/api/private-tour/check-booking/${encodeURIComponent(targetCode)}`);
  assert.strictEqual(recheckRes.status, 200);
  const recheckedData = await recheckRes.json();
  assert.strictEqual(recheckedData.paymentStatus, 'Paid', 'paymentStatus must now be Paid');
  assert.strictEqual(recheckedData.bookingStatus, 'Pending Confirmation', 'bookingStatus must be Pending Confirmation');
  assert.strictEqual(recheckedData.uniqueCode, initialUniqueCode, 'CRITICAL: uniqueCode must NOT change');
  assert.strictEqual(recheckedData.paymentAmount, initialPaymentAmount, 'CRITICAL: paymentAmount must NOT change');
  assert.strictEqual(recheckedData.totalPriceIDR, initialTotalPriceIDR, 'CRITICAL: totalPriceIDR must NOT change');
  assert.strictEqual(recheckedData.baseAmount, initialBaseAmount, 'CRITICAL: baseAmount must NOT change');
  console.log('✅ [Step 6] Status in Cek Kode Booking is Paid & Pending Confirmation. Pricing and uniqueCode are completely preserved.');

  // Step 7: Verify Admin Dashboard receives the updated booking and it appears as Pending Confirmation
  console.log('[Step 7] Checking Admin Dashboard bookings list...');
  const adminCheckRes = await fetch(`${BASE_URL}/api/bookings`, { headers: adminHeaders });
  assert.strictEqual(adminCheckRes.status, 200);
  const adminBookings = await adminCheckRes.json();

  // CRITICAL: Total count must still be initialTotalCount + 1 (NO duplicate / new booking created)
  assert.strictEqual(adminBookings.length, initialTotalCount + 1, 'CRITICAL: No duplicate or extra booking was created');

  const targetAdminBooking = adminBookings.find((b: any) => b.bookingCode === targetCode || b.id === createdBooking.id);
  assert(targetAdminBooking, 'Booking must exist in Admin bookings list');
  assert.strictEqual(targetAdminBooking.paymentStatus, 'Paid', 'Admin must see paymentStatus=Paid');
  assert.strictEqual(targetAdminBooking.status, 'Pending Confirmation', 'Admin must see status=Pending Confirmation');
  assert.strictEqual(targetAdminBooking.uniqueCode, initialUniqueCode, 'Admin uniqueCode must match original');
  assert.strictEqual(targetAdminBooking.paymentAmount, initialPaymentAmount, 'Admin paymentAmount must match original');
  console.log('✅ [Step 7] Verified in Admin Dashboard: paymentStatus="Paid", status="Pending Confirmation".');

  // Step 8: Test lowercase code lookup in simulate-webhook
  console.log('[Step 8] Testing lowercase code lookup in simulate-webhook...');
  const lowerCode = targetCode.toLowerCase();
  const simLowerRes = await fetch(`${BASE_URL}/api/artopay/simulate-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId: lowerCode })
  });
  assert.strictEqual(simLowerRes.status, 200, 'Lowercase lookup must succeed');
  console.log('✅ [Step 8] Lowercase lookup verified.');

  console.log('\n=================================================================');
  console.log('🎉 ALL TESTS PASSED: SIMULASI PEMBAYARAN SUKSES DI CEK KODE BOOKING IS FULLY OPERATIONAL!');
  console.log('=================================================================');
}

testSimulatePaymentCekBooking().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
