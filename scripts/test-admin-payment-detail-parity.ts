import assert from 'assert';

const BASE_URL = 'http://localhost:3000';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

async function runAdminPaymentDetailSuite() {
  console.log('========================================================================');
  console.log('🧪 RUNNING: VERIFIKASI ADMIN PAYMENT DETAIL & PARITAS ARTOPAY');
  console.log('    BASE PRICE, DISCOUNT/PROMO, UNIQUE CODE & FINAL PAYMENT AMOUNT      ');
  console.log('========================================================================\n');

  // Step 1: Admin Authentication
  console.log('[Setup] Login sebagai Admin...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@smartjourney.com', password: ADMIN_PASSWORD })
  });
  assert.strictEqual(loginRes.status, 200, 'Admin login harus berhasil (HTTP 200)');
  const { token } = await loginRes.json();
  const adminHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };
  console.log('✅ [Setup] Admin terautentikasi.');

  const testScenarios = [
    {
      title: 'Skenario 1: Private Tour (Standar Base Price + Unique Code)',
      codePrefix: 'SJ-DET-TR',
      basePrice: 2850000,
      discount: 0,
      promoCode: undefined,
      payload: (code: string, id: string, date: string) => ({
        id,
        bookingCode: code,
        tourId: 'tour-bromo-sunrise-safari',
        tripId: 'tour-bromo-sunrise-safari',
        type: 'tour',
        serviceType: 'tour',
        serviceName: 'Bromo Sunrise & Crater Safari',
        fullName: 'Bambang Pamungkas',
        customerName: 'Bambang Pamungkas',
        email: 'bambang@example.com',
        phone: '+6281234567891',
        departureDate: date,
        participantsCount: 2,
        totalPriceIDR: 2850000,
        baseAmount: 2850000,
        discount: 0,
        paymentStatus: 'Pending',
        status: 'Pending Payment',
        details: {
          tourId: 'tour-bromo-sunrise-safari',
          date,
          package: 'Private Exclusive VIP',
          duration: '2 Hari 1 Malam',
          vehicleName: 'Toyota HiAce Premio Luxury',
          pickupLocation: 'Hotel Tugu Malang'
        }
      })
    },
    {
      title: 'Skenario 2: Taxi Service dengan Diskon Promo + Unique Code',
      codePrefix: 'SJ-DET-TX',
      basePrice: 300000,
      discount: 50000,
      promoCode: 'WELCOME2026',
      payload: (code: string, id: string, date: string) => ({
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
        fullName: 'Ratna Sari',
        customerName: 'Ratna Sari',
        email: 'ratna.sari@example.com',
        phone: '+6281355556666',
        departureDate: date,
        participantsCount: 2,
        totalPrice: 16,
        baseAmount: 300000,
        totalPriceIDR: 250000,
        discount: 50000,
        promoCode: 'WELCOME2026',
        paymentStatus: 'Pending',
        status: 'Pending Payment',
        details: {
          pickupLocation: 'Juanda International Airport (SUB), Surabaya',
          destination: 'Malang City Center, East Java',
          date,
          time: '09:00',
          guests: 2,
          vehicleId: 'innova',
          vehicleName: 'Toyota Innova Reborn',
          discountAmount: 50000,
          promoCode: 'WELCOME2026'
        }
      })
    },
    {
      title: 'Skenario 3: Open Trip / Share Tour (Batch 5) + Unique Code',
      codePrefix: 'SJ-DET-OT',
      basePrice: 2250000,
      discount: 0,
      promoCode: undefined,
      payload: (code: string, id: string, date: string) => ({
        id,
        bookingCode: code,
        type: 'sharetour',
        serviceType: 'sharetour',
        serviceName: 'Open Trip Bromo Sunrise Expedition',
        tripTitle: 'Open Trip Bromo Sunrise Expedition',
        tripId: 'trip-2',
        batchId: 'batch-5',
        fullName: 'Gita Gutawa',
        customerName: 'Gita Gutawa',
        email: 'gita@example.com',
        phone: '+6281777778888',
        departureDate: '2026-08-18',
        participantsCount: 1,
        participantsNames: ['Gita Gutawa'],
        nationalityType: 'WNI',
        totalPriceIDR: 2250000,
        baseAmount: 2250000,
        discount: 0,
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

  for (let i = 0; i < testScenarios.length; i++) {
    const sc = testScenarios[i];
    const randNum = Math.floor(1000 + Math.random() * 9000);
    const bookingCode = `${sc.codePrefix}-${randNum}`;
    const bookingId = `bk-${sc.codePrefix.toLowerCase()}-${randNum}`;
    const randDay = Math.floor(1 + Math.random() * 25);
    const dynamicDate = sc.codePrefix.includes('OT') ? '2026-08-18' : `2027-02-${String(randDay).padStart(2, '0')}`;

    console.log(`------------------------------------------------------------------------`);
    console.log(`[Uji ${i + 1}] ${sc.title}`);
    console.log(`------------------------------------------------------------------------`);

    // 1. Buat Booking
    const rawPayload = sc.payload(bookingCode, bookingId, dynamicDate);
    const createRes = await fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rawPayload)
    });
    if (createRes.status !== 201) {
      const errTxt = await createRes.text();
      console.error(`ERROR createRes [${sc.title}]: status=${createRes.status}, body=${errTxt}`);
    }
    assert.strictEqual(createRes.status, 201, `Booking ${bookingCode} harus berhasil dibuat (201)`);
    const createdBooking = await createRes.json();

    // 2. Fetch authoritative payment breakdown
    const checkRes = await fetch(`${BASE_URL}/api/private-tour/check-booking/${bookingCode}`);
    assert.strictEqual(checkRes.status, 200, `Check booking ${bookingCode} harus berhasil (200)`);
    const checkData = await checkRes.json();

    const expectedBasePrice = sc.basePrice;
    const expectedDiscount = sc.discount;
    const expectedPromoCode = sc.promoCode;
    const expectedUniqueCode = checkData.uniqueCode;
    assert(expectedUniqueCode >= 1 && expectedUniqueCode <= 99, `Kode unik harus 1-99, didapat ${expectedUniqueCode}`);

    // Nominal yang dikirim ke ArtoPay Gateway
    const payableAmountToArtoPay = Math.max(0, expectedBasePrice - expectedDiscount) + expectedUniqueCode;
    assert.strictEqual(checkData.paymentAmount, payableAmountToArtoPay, 'paymentAmount di API harus persis sama dengan nominal ArtoPay');

    console.log(`  1. Booking Dibuat: Code=${bookingCode}`);
    console.log(`     - Base Price:    Rp ${expectedBasePrice.toLocaleString('id-ID')}`);
    console.log(`     - Diskon Promo:  - Rp ${expectedDiscount.toLocaleString('id-ID')} ${expectedPromoCode ? `(${expectedPromoCode})` : ''}`);
    console.log(`     - Kode Unik:     + Rp ${expectedUniqueCode}`);
    console.log(`     - Ke ArtoPay:    Rp ${payableAmountToArtoPay.toLocaleString('id-ID')}`);

    // 3. Admin Fetch Data (melalui /api/bookings dan pemetaan Admin BookingDetailModal)
    const adminFetchRes = await fetch(`${BASE_URL}/api/bookings`, { headers: adminHeaders });
    assert.strictEqual(adminFetchRes.status, 200, 'Admin fetch harus berhasil');
    const adminList = await adminFetchRes.json();
    const adminItem = adminList.find((b: any) => b.bookingCode === bookingCode || b.id === bookingId);
    assert(adminItem, `Booking ${bookingCode} harus ditemukan di daftar Admin`);

    // Mensimulasikan persis field yang dibaca oleh BookingDetailModal.tsx
    const raw = adminItem;
    const modalDiscount = Number(adminItem.discount ?? raw.discount ?? (raw.details?.discountAmount || 0));
    const modalPromoCode = adminItem.promoCode || raw.promoCode || raw.details?.promoCode;
    const modalUniqueCode = Number(adminItem.uniqueCode ?? raw.unique_code ?? raw.uniqueCode ?? 0);
    let modalBaseAmount = Number(adminItem.baseAmount ?? raw.base_amount ?? raw.baseAmount ?? 0);
    if (!modalBaseAmount || modalBaseAmount <= 0) {
      const netBase = Number(adminItem.totalAmountIDR ?? raw.total_price_idr ?? raw.totalPriceIDR ?? adminItem.totalPrice ?? 0);
      modalBaseAmount = (netBase > 0 && modalDiscount > 0) ? (netBase + modalDiscount) : netBase;
    }
    const modalFinalPaymentAmount = 
      Number(adminItem.finalPaymentAmount ?? adminItem.paymentAmount ?? raw.payment_amount ?? raw.paymentAmount ?? adminItem.totalAmountIDR ?? raw.total_price_idr ?? 0) ||
      (modalBaseAmount > 0 ? (Math.max(0, modalBaseAmount - modalDiscount) + modalUniqueCode) : 0);

    console.log(`  2. Verifikasi Komponen Admin BookingDetailModal:`);
    console.log(`     ✓ [1. Base Price]          Rp ${modalBaseAmount.toLocaleString('id-ID')}`);
    console.log(`     ✓ [2. Discount / Promo]    - Rp ${modalDiscount.toLocaleString('id-ID')} ${modalPromoCode ? `(${modalPromoCode})` : ''}`);
    console.log(`     ✓ [3. Unique Code]         + Rp ${modalUniqueCode}`);
    console.log(`     ✓ [4. Final Payment Arto]  Rp ${modalFinalPaymentAmount.toLocaleString('id-ID')}`);

    // 4. Assertion Paritas Lengkap:
    // a. Base Price harus persis sama
    assert.strictEqual(modalBaseAmount, expectedBasePrice, `Base Price di Admin Detail (${modalBaseAmount}) harus sama dengan catalog base price (${expectedBasePrice})`);
    
    // b. Discount & Promo harus persis sama
    assert.strictEqual(modalDiscount, expectedDiscount, `Discount di Admin Detail (${modalDiscount}) harus sama dengan expected discount (${expectedDiscount})`);
    if (expectedPromoCode) {
      assert.strictEqual(modalPromoCode, expectedPromoCode, `Promo code di Admin Detail (${modalPromoCode}) harus sama dengan ${expectedPromoCode}`);
    }

    // c. Unique Code harus persis sama
    assert.strictEqual(modalUniqueCode, expectedUniqueCode, `Unique Code di Admin Detail (${modalUniqueCode}) harus sama dengan booking uniqueCode (${expectedUniqueCode})`);

    // d. Final Payment Amount harus persis sama dengan yang dikirim ke ArtoPay
    assert.strictEqual(modalFinalPaymentAmount, payableAmountToArtoPay, `Final Payment Amount di Admin (${modalFinalPaymentAmount}) harus persis sama dengan nominal ArtoPay (${payableAmountToArtoPay})`);

    console.log(`  🎉 PARITAS ARTOPAY TERVERIFIKASI SEMPURNA:`);
    console.log(`     Modal Admin (Rp ${modalFinalPaymentAmount.toLocaleString('id-ID')}) === ArtoPay Payload (Rp ${payableAmountToArtoPay.toLocaleString('id-ID')})\n`);
  }

  console.log('========================================================================');
  console.log('🎉 SEMUA PENGUJIAN ADMIN PAYMENT DETAIL BERHASIL 100%!');
  console.log('   - Base Price terlihat akurat');
  console.log('   - Discount / Promo terlihat akurat');
  console.log('   - Unique Code terlihat akurat');
  console.log('   - Final Payment Amount persis sama dengan nominal ArtoPay');
  console.log('========================================================================\n');
}

runAdminPaymentDetailSuite().catch(err => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
