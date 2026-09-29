// ==============================================================================
// TEST SUITE: MEDIUM-03 COMPLETED BOOKING PDF ACCESS
// Validates locked PDF for Pending and unlocked PDF for Confirmed & Completed
// ==============================================================================
import { bookingsRepo } from '../server/db/repositories/bookings.repository';

// Frontend logic mirror from PrivateTourCheckBooking.tsx
function computeCanDownload(booking: any): boolean {
  const isPaid = (booking?.paymentStatus || '').toLowerCase() === 'paid';
  const isStatusConfirmedOrCompleted = Boolean(
    booking && (
      booking.bookingStatus === 'Confirmed' ||
      booking.bookingStatus === 'Completed' ||
      booking.status === 'Confirmed' ||
      booking.status === 'Completed'
    )
  );
  return Boolean(
    booking && (
      booking.canDownloadFinalSummary ||
      booking.canDownloadInvoice ||
      (isPaid && isStatusConfirmedOrCompleted)
    )
  );
}

async function runTests() {
  console.log('🚀 Running MEDIUM-03 Completed Booking PDF Access Test Suite...\n');
  const BASE_URL = 'http://localhost:3000';
  let passed = 0;
  const total = 4;

  const testCode = 'TEST-PDF-ACCESS-001';
  const testId = 'bk-pdf-test-001';

  // Helper to upsert test booking into repository
  async function setupBooking(paymentStatus: string, bookingStatus: string) {
    const existing = await bookingsRepo.getById(testId);
    if (existing) {
      await bookingsRepo.update(testId, {
        paymentStatus,
        status: bookingStatus
      });
    } else {
      await bookingsRepo.create({
        id: testId,
        bookingCode: testCode,
        bookingType: 'private',
        serviceType: 'tour',
        serviceName: 'Bromo Sunrise Tour Test',
        fullName: 'Budi Santoso',
        customerName: 'Budi Santoso',
        email: 'budi@gmail.com',
        customerEmail: 'budi@gmail.com',
        phone: '+62 812-3456-7890',
        customerPhone: '+62 812-3456-7890',
        totalPrice: 1500000,
        totalPriceIDR: 1500000,
        paymentAmount: 1500000,
        baseAmount: 1500000,
        paymentStatus,
        status: bookingStatus,
        createdAt: new Date().toISOString()
      });
    }
  }

  // --------------------------------------------------------------------------
  // TEST 1: Pending Payment -> PDF locked (HTTP 403 & canDownload = false)
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: Pending Payment -> PDF Locked ---');
  await setupBooking('Pending', 'Pending Payment');

  const check1Res = await fetch(`${BASE_URL}/api/private-tour/check-booking/${testCode}`);
  const check1Data = await check1Res.json();
  const fe1CanDownload = computeCanDownload(check1Data);

  const pdf1Res = await fetch(`${BASE_URL}/api/private-tour/invoice-pdf/${testCode}`);

  if (check1Data.canDownloadFinalSummary === false && fe1CanDownload === false && pdf1Res.status === 403) {
    console.log('✅ TEST 1 PASSED: Pending Payment PDF terkunci sempurna (HTTP 403 Forbidden & Frontend locked).');
    passed++;
  } else {
    throw new Error(`TEST 1 FAILED: Expected 403 and locked, got HTTP ${pdf1Res.status}, feCanDownload: ${fe1CanDownload}`);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Pending Confirmation (Paid) -> PDF locked (HTTP 403 & canDownload = false)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2: Pending Confirmation (Paid) -> PDF Locked ---');
  await setupBooking('Paid', 'Pending Confirmation');

  const check2Res = await fetch(`${BASE_URL}/api/private-tour/check-booking/${testCode}`);
  const check2Data = await check2Res.json();
  const fe2CanDownload = computeCanDownload(check2Data);

  const pdf2Res = await fetch(`${BASE_URL}/api/private-tour/invoice-pdf/${testCode}`);

  if (check2Data.canDownloadFinalSummary === false && fe2CanDownload === false && pdf2Res.status === 403) {
    console.log('✅ TEST 2 PASSED: Pending Confirmation PDF terkunci sempurna (HTTP 403 Forbidden & Frontend locked).');
    passed++;
  } else {
    throw new Error(`TEST 2 FAILED: Expected 403 and locked, got HTTP ${pdf2Res.status}, feCanDownload: ${fe2CanDownload}`);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Confirmed (Paid) -> PDF downloadable (HTTP 200 application/pdf & canDownload = true)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 3: Confirmed (Paid) -> PDF Downloadable ---');
  await setupBooking('Paid', 'Confirmed');

  const check3Res = await fetch(`${BASE_URL}/api/private-tour/check-booking/${testCode}`);
  const check3Data = await check3Res.json();
  const fe3CanDownload = computeCanDownload(check3Data);

  const pdf3Res = await fetch(`${BASE_URL}/api/private-tour/invoice-pdf/${testCode}`);
  const pdf3ContentType = pdf3Res.headers.get('content-type') || '';

  if (
    check3Data.canDownloadFinalSummary === true && 
    fe3CanDownload === true && 
    pdf3Res.status === 200 && 
    pdf3ContentType.includes('pdf')
  ) {
    console.log('✅ TEST 3 PASSED: Confirmed booking dapat mengunduh dokumen PDF (HTTP 200 application/pdf & Frontend unlocked).');
    passed++;
  } else {
    throw new Error(`TEST 3 FAILED: Expected HTTP 200 application/pdf, got ${pdf3Res.status} (${pdf3ContentType})`);
  }

  // --------------------------------------------------------------------------
  // TEST 4: Completed (Paid) -> PDF downloadable (HTTP 200 application/pdf & canDownload = true)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 4: Completed (Paid) -> PDF Downloadable ---');
  await setupBooking('Paid', 'Completed');

  const check4Res = await fetch(`${BASE_URL}/api/private-tour/check-booking/${testCode}`);
  const check4Data = await check4Res.json();
  const fe4CanDownload = computeCanDownload(check4Data);

  const pdf4Res = await fetch(`${BASE_URL}/api/private-tour/invoice-pdf/${testCode}`);
  const pdf4ContentType = pdf4Res.headers.get('content-type') || '';

  if (
    check4Data.canDownloadFinalSummary === true && 
    fe4CanDownload === true && 
    pdf4Res.status === 200 && 
    pdf4ContentType.includes('pdf')
  ) {
    console.log('✅ TEST 4 PASSED: Completed booking tetap dapat mengunduh dokumen PDF (HTTP 200 application/pdf & Frontend unlocked).');
    passed++;
  } else {
    throw new Error(`TEST 4 FAILED: Expected HTTP 200 application/pdf, got ${pdf4Res.status} (${pdf4ContentType})`);
  }

  // Cleanup test booking
  await bookingsRepo.delete(testId);

  console.log(`\n=======================================================`);
  console.log(`🎉 ALL ${passed}/${total} PDF ACCESS TESTS PASSED!`);
  console.log(`=======================================================\n`);
}

runTests().catch(err => {
  console.error('\n❌ TEST RUNNER FAILED:', err);
  process.exit(1);
});
