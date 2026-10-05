import assert from 'assert';

const BASE_URL = 'http://localhost:3000';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

async function runMyBookingsAdminParitySuite() {
  console.log('========================================================================');
  console.log('🧪 RUNNING: VERIFIKASI PARITAS MY BOOKING VS ADMIN (PAID & CONFIRMED)');
  console.log('    STATUS & TOTAL PEMBAYARAN HARUS IDENTIK 100% TANPA SELISIH        ');
  console.log('========================================================================\n');

  // Step 1: Admin Authentication
  console.log('[Setup] Mengambil token admin...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@smartjourney.com', password: ADMIN_PASSWORD })
  });
  assert.strictEqual(loginRes.status, 200, 'Admin login harus berhasil (HTTP 200)');
  const { token } = await loginRes.json();
  assert(token, 'Session token harus tersedia');
  const adminHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };
  console.log('✅ [Setup] Token admin terverifikasi.');

  // Test across multiple services: Private Tour, Taxi, Open Trip, Car Rental
  const testCases = [
    {
      service: 'Private Tour',
      title: 'Private Tour (Bromo Sunrise & Crater Safari)',
      codePrefix: 'SJ-MYBK-TR',
      payload: (code: string, id: string) => ({
        id,
        bookingCode: code,
        tourId: 'tour-bromo-sunrise-safari',
        tripId: 'tour-bromo-sunrise-safari',
        type: 'tour',
        serviceType: 'tour',
        serviceName: 'Bromo Sunrise & Crater Safari',
        fullName: 'Clarissa Ward',
        customerName: 'Clarissa Ward',
        email: 'clarissa.ward@example.com',
        phone: '+6281234567890',
        departureDate: '2026-11-20',
        participantsCount: 2,
        totalPriceIDR: 2850000,
        baseAmount: 2850000,
        paymentStatus: 'Pending',
        status: 'Pending Payment',
        details: {
          tourId: 'tour-bromo-sunrise-safari',
          date: '2026-11-20',
          package: 'Private Exclusive VIP',
          duration: '2 Hari 1 Malam',
          vehicleName: 'Toyota HiAce Premio Luxury',
          pickupLocation: 'Hotel Tugu Malang'
        }
      })
    },
    {
      service: 'Taxi Service',
      title: 'Taxi Service (Surabaya ⇄ Malang)',
      codePrefix: 'SJ-MYBK-TX',
      payload: (code: string, id: string) => ({
        id,
        bookingCode: code,
        type: 'taxi',
        serviceType: 'taxi',
        serviceName: 'Taxi Service: Surabaya ⇄ Malang (Toyota Innova Reborn)',
        source_id: 'area-sub-p5b',
        destination_id: 'area-mlg-p5b',
        pickupAreaId: 'area-sub-p5b',
        destAreaId: 'area-mlg-p5b',
        pickup: 'Juanda International Airport (SUB), Surabaya',
        destination: 'Malang City Center, East Java',
        pickupLocation: 'Juanda International Airport (SUB), Surabaya',
        vehicleId: 'innova',
        vehicleName: 'Toyota Innova Reborn',
        fullName: 'Hendra Gunawan',
        customerName: 'Hendra Gunawan',
        email: 'hendra.gunawan@example.com',
        phone: '+6281344445555',
        departureDate: '2026-12-05',
        participantsCount: 2,
        totalPrice: 19,
        totalPriceIDR: 300000,
        baseAmount: 300000,
        details: {
          pickupLocation: 'Juanda International Airport (SUB), Surabaya',
          destination: 'Malang City Center, East Java',
          date: '2026-12-05',
          time: '08:30',
          guests: 2,
          vehicleId: 'innova',
          vehicleName: 'Toyota Innova Reborn'
        }
      })
    },
    {
      service: 'Open Trip (Share Tour)',
      title: 'Open Trip (Share Tour Batch 5)',
      codePrefix: 'SJ-MYBK-OT',
      payload: (code: string, id: string) => ({
        id,
        bookingCode: code,
        type: 'sharetour',
        serviceType: 'sharetour',
        serviceName: 'Open Trip Bromo Sunrise Expedition',
        tripTitle: 'Open Trip Bromo Sunrise Expedition',
        tripId: 'trip-2',
        batchId: 'batch-5',
        fullName: 'Dewi Lestari',
        customerName: 'Dewi Lestari',
        email: 'dewi.lestari@example.com',
        phone: '+6281788889999',
        departureDate: '2026-08-18',
        participantsCount: 1,
        participantsNames: ['Dewi Lestari'],
        nationalityType: 'WNI',
        totalPriceIDR: 2250000,
        baseAmount: 2250000,
        paymentStatus: 'Pending',
        status: 'Pending Payment',
        details: {
          tripId: 'trip-2',
          batchId: 'batch-5',
          date: '2026-08-18',
          package: 'Paket Open Trip Bromo',
          pickupLocation: 'Stasiun Pasar Turi'
        }
      })
    }
  ];

  let passedTests = 0;

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const randNum = Math.floor(1000 + Math.random() * 9000);
    const bookingCode = `${tc.codePrefix}-${randNum}`;
    const bookingId = `bk-${tc.codePrefix.toLowerCase()}-${randNum}`;
    const randDay = Math.floor(1 + Math.random() * 25);
    const dayStr = String(randDay).padStart(2, '0');
    const dynamicDate = tc.service.includes('Open Trip') ? '2026-08-18' : `2027-01-${dayStr}`;

    console.log(`\n------------------------------------------------------------------------`);
    console.log(`[Kasus ${i + 1}] Menguji: ${tc.title}`);
    console.log(`------------------------------------------------------------------------`);

    // 1. Buat Booking
    const rawPayload = tc.payload(bookingCode, bookingId);
    rawPayload.departureDate = dynamicDate;
    if (rawPayload.details) rawPayload.details.date = dynamicDate;
    const createRes = await fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rawPayload)
    });
    if (createRes.status !== 201) {
      const txt = await createRes.text();
      console.error(`ERROR createRes: status=${createRes.status}, body=${txt}`);
    }
    assert.strictEqual(createRes.status, 201, `Pembuatan booking ${bookingCode} harus berhasil (HTTP 201)`);
    const createdBooking = await createRes.json();
    
    // Periksa kode unik & total pembayaran awal
    const checkInitRes = await fetch(`${BASE_URL}/api/private-tour/check-booking/${bookingCode}`);
    const checkInit = await checkInitRes.json();
    const lockedTotalPaid = checkInit.paymentAmount;
    assert(lockedTotalPaid > 0, 'Total bayar harus > 0');
    console.log(`  1. Booking Dibuat: Code=${bookingCode}, Base=Rp ${checkInit.baseAmount.toLocaleString('id-ID')}, Kode Unik=+Rp ${checkInit.uniqueCode}, Total Tagihan=Rp ${lockedTotalPaid.toLocaleString('id-ID')}`);

    // 2. Simulasi Webhook ArtoPay Sukses -> Status menjadi Paid
    const payRes = await fetch(`${BASE_URL}/api/artopay/simulate-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: bookingCode,
        bookingCode,
        bookingId: createdBooking.id || bookingId
      })
    });
    assert.strictEqual(payRes.status, 200, `Simulasi pembayaran ArtoPay harus berhasil`);
    console.log(`  2. Pembayaran Lunas (Paid) via Gateway ArtoPay.`);

    // 3. Admin Konfirmasi Booking -> Menjadi Confirmed & Paid
    const confirmRes = await fetch(`${BASE_URL}/api/bookings/${bookingId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        status: 'Confirmed',
        paymentStatus: 'Paid'
      })
    });
    assert.strictEqual(confirmRes.status, 200, `Admin konfirmasi booking ${bookingId} harus berhasil`);
    console.log(`  3. Admin Mengonfirmasi Booking -> Status resmi: CONFIRMED & PAID.`);

    // 4. Verifikasi Data Sisi Admin (via GET /api/bookings dan logika AdminView)
    const adminListRes = await fetch(`${BASE_URL}/api/bookings`, { headers: adminHeaders });
    assert.strictEqual(adminListRes.status, 200, 'Admin fetch bookings harus berhasil');
    const adminAllBookings = await adminListRes.json();
    const adminBooking = adminAllBookings.find((b: any) => b.bookingCode === bookingCode || b.id === bookingId);
    assert(adminBooking, `Booking ${bookingCode} harus ada di daftar Admin`);

    // Logika perhitungan AdminView:
    const adminRawPayment = (adminBooking.paymentStatus || '').trim().toLowerCase();
    const adminRawBooking = (adminBooking.status || '').trim().toLowerCase();
    const adminIsPaid = adminRawPayment === 'paid' || adminRawBooking === 'confirmed' || Boolean(adminBooking.paidAt);
    const adminPaymentStatus = adminIsPaid ? 'Paid' : 'Pending';
    const adminBookingStatus = adminRawBooking === 'confirmed' ? 'Confirmed' : 'Pending Payment';
    const adminTotalAmountIDR = Number(adminBooking.paymentAmount) || Number(adminBooking.totalPriceIDR) || 0;

    console.log(`  🔍 [ADMIN VIEW DATA]`);
    console.log(`     - Kode: ${adminBooking.bookingCode}`);
    console.log(`     - paymentStatus: ${adminPaymentStatus}`);
    console.log(`     - bookingStatus: ${adminBookingStatus}`);
    console.log(`     - Total Transaksi (IDR): Rp ${adminTotalAmountIDR.toLocaleString('id-ID')}`);

    // 5. Verifikasi Data Sisi Customer: Check Booking API (/api/private-tour/check-booking/:code)
    const custCheckRes = await fetch(`${BASE_URL}/api/private-tour/check-booking/${bookingCode}`);
    assert.strictEqual(custCheckRes.status, 200, 'Customer check booking harus berhasil');
    const custCheckData = await custCheckRes.json();

    console.log(`  🔍 [MY BOOKING TAB 1: Cek Booking ID & Invoice]`);
    console.log(`     - Kode: ${custCheckData.bookingCode}`);
    console.log(`     - paymentStatus: ${custCheckData.paymentStatus}`);
    console.log(`     - bookingStatus: ${custCheckData.bookingStatus}`);
    console.log(`     - Total Pembayaran: Rp ${custCheckData.paymentAmount.toLocaleString('id-ID')}`);

    // 6. Verifikasi Data Sisi Customer: Tiket Reservasi Saya (BookingsView state mapping & rendering)
    // Mensimulasikan persis logika BookingsView.tsx
    const storedBookingFromCheck = {
      id: custCheckData.id,
      bookingCode: custCheckData.bookingCode,
      type: custCheckData.isShared ? 'shared' : 'tour',
      serviceName: custCheckData.serviceName || custCheckData.tripTitle,
      totalPriceIDR: custCheckData.paymentAmount,
      totalAmountIDR: custCheckData.paymentAmount,
      paymentAmount: custCheckData.paymentAmount,
      totalPaid: custCheckData.paymentAmount,
      uniqueCode: custCheckData.uniqueCode,
      baseAmount: custCheckData.baseAmount,
      status: custCheckData.bookingStatus,
      bookingStatus: custCheckData.bookingStatus,
      paymentStatus: custCheckData.paymentStatus,
      paidAt: custCheckData.paidAt
    };

    const myBookingRawPayment = (storedBookingFromCheck.paymentStatus || '').trim().toLowerCase();
    const myBookingRawStatus = (storedBookingFromCheck.bookingStatus || storedBookingFromCheck.status || '').trim().toLowerCase();
    const myBookingIsPaid = myBookingRawPayment === 'paid' || myBookingRawStatus === 'confirmed' || Boolean(storedBookingFromCheck.paidAt);
    const myBookingPaymentStatus = myBookingIsPaid ? 'Paid' : 'Pending';
    const myBookingBookingStatus = myBookingRawStatus === 'confirmed' ? 'Confirmed' : 'Pending Payment';
    const myBookingTotalPayable = 
      Number(storedBookingFromCheck.paymentAmount) || 
      Number(storedBookingFromCheck.totalAmountIDR) || 
      Number(storedBookingFromCheck.totalPaid) || 
      Number(storedBookingFromCheck.totalPriceIDR) || 0;

    console.log(`  🔍 [MY BOOKING TAB 2: Tiket Reservasi Saya]`);
    console.log(`     - Kode: ${storedBookingFromCheck.bookingCode}`);
    console.log(`     - paymentStatus: ${myBookingPaymentStatus}`);
    console.log(`     - bookingStatus: ${myBookingBookingStatus}`);
    console.log(`     - Total Tagihan Final: Rp ${myBookingTotalPayable.toLocaleString('id-ID')}`);

    // 7. ASSERTION PARITAS 100% IDENTIK
    assert.strictEqual(custCheckData.paymentStatus, adminPaymentStatus, `paymentStatus di Cek Booking (${custCheckData.paymentStatus}) harus sama dengan Admin (${adminPaymentStatus})`);
    assert.strictEqual(custCheckData.bookingStatus, adminBookingStatus, `bookingStatus di Cek Booking (${custCheckData.bookingStatus}) harus sama dengan Admin (${adminBookingStatus})`);
    assert.strictEqual(custCheckData.paymentAmount, adminTotalAmountIDR, `Total bayar di Cek Booking (${custCheckData.paymentAmount}) harus sama dengan Admin (${adminTotalAmountIDR})`);

    assert.strictEqual(myBookingPaymentStatus, adminPaymentStatus, `paymentStatus di Tiket Reservasi Saya (${myBookingPaymentStatus}) harus sama dengan Admin (${adminPaymentStatus})`);
    assert.strictEqual(myBookingBookingStatus, adminBookingStatus, `bookingStatus di Tiket Reservasi Saya (${myBookingBookingStatus}) harus sama dengan Admin (${adminBookingStatus})`);
    assert.strictEqual(myBookingTotalPayable, adminTotalAmountIDR, `Total bayar di Tiket Reservasi Saya (${myBookingTotalPayable}) harus sama dengan Admin (${adminTotalAmountIDR})`);

    console.log(`  🎉 PARITAS SEMPURNA:`);
    console.log(`     ✓ Status Pembayaran: My Booking (${myBookingPaymentStatus}) === Admin (${adminPaymentStatus}) [OK]`);
    console.log(`     ✓ Status Pemesanan:  My Booking (${myBookingBookingStatus}) === Admin (${adminBookingStatus}) [OK]`);
    console.log(`     ✓ Total Pembayaran:  My Booking (Rp ${myBookingTotalPayable.toLocaleString('id-ID')}) === Admin (Rp ${adminTotalAmountIDR.toLocaleString('id-ID')}) [OK]`);
    
    passedTests++;
  }

  console.log('\n========================================================================');
  console.log(`🎉 SEMUA ${passedTests} PENGUJIAN PARITAS MY BOOKING VS ADMIN BERHASIL 100%!`);
  console.log('   - Booking Paid & Confirmed menampilkan status yang sama persis');
  console.log('   - Booking Paid & Confirmed menampilkan total bayar yang sama persis');
  console.log('========================================================================\n');
}

runMyBookingsAdminParitySuite().catch(err => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
