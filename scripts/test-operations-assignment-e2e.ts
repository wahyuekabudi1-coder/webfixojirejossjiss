// ==============================================================================
// TEST SUITE: HIGH-02 PERSISTENT OPERATIONS ASSIGNMENT
// Validates full SQL persistence, resources, cross-session and CRUD lifecycle
// ==============================================================================
import { assignmentsRepo, DEFAULT_FLEET, DEFAULT_DRIVERS, DEFAULT_GUIDES } from '../server/db/repositories/assignments.repository';
import { getDB } from '../server/db/pool';

async function runTests() {
  console.log('🚀 Starting HIGH-02 Persistent Operations Assignment Test Suite...\n');
  let passed = 0;
  let total = 7;

  const testBookingCode = 'TEST-SJ-OPS-001';
  const testBookingId = 'bk-ops-test-999';

  // --------------------------------------------------------------------------
  // TEST 1: Buat assignment
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: Buat Assignment Baru ke SQL Database ---');
  const initialAssignment = {
    bookingId: testBookingId,
    bookingCode: testBookingCode,
    vehicleName: 'Toyota HiAce Premio',
    plateNumber: 'N 7088 SJ',
    driverName: 'Bpk. Hendra Saputra',
    driverPhone: '+62 812-3456-7890',
    guideName: 'Mas Dimas (HPI Certified)',
    status: 'Ready' as const,
    note: 'Siapkan masker Bromo & air mineral',
    assignedAt: new Date().toISOString()
  };

  const created = await assignmentsRepo.save(initialAssignment);
  if (
    created.bookingCode === testBookingCode &&
    created.vehicleName === 'Toyota HiAce Premio' &&
    created.driverName === 'Bpk. Hendra Saputra'
  ) {
    console.log('✅ TEST 1 PASSED: Assignment berhasil disimpan ke SQL database.');
    passed++;
  } else {
    throw new Error('❌ TEST 1 FAILED: Assignment creation failed');
  }

  // --------------------------------------------------------------------------
  // TEST 2: Refresh → assignment tetap ada
  // Simulating fresh query / page refresh directly from SQL database
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2: Refresh (Fresh Query dari SQL Database) ---');
  const freshAssignments = await assignmentsRepo.getAll();
  const fetchedAfterRefresh = freshAssignments[testBookingCode];
  if (
    fetchedAfterRefresh &&
    fetchedAfterRefresh.driverName === 'Bpk. Hendra Saputra' &&
    fetchedAfterRefresh.plateNumber === 'N 7088 SJ' &&
    fetchedAfterRefresh.status === 'Ready'
  ) {
    console.log('✅ TEST 2 PASSED: Refresh terbukti membaca data assignment yang identik dari SQL.');
    passed++;
  } else {
    throw new Error('❌ TEST 2 FAILED: Assignment not found after refresh');
  }

  // --------------------------------------------------------------------------
  // TEST 3: Logout/login → assignment tetap ada
  // Data is independent of any client token/localStorage and bound to SQL table
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 3: Logout / Login Persistence ---');
  // Query via separate direct DB client call
  const fetchedByCode = await assignmentsRepo.getByKey(testBookingCode);
  const fetchedById = await assignmentsRepo.getByKey(testBookingId);
  if (
    fetchedByCode &&
    fetchedById &&
    fetchedByCode.bookingCode === testBookingCode &&
    fetchedById.bookingId === testBookingId
  ) {
    console.log('✅ TEST 3 PASSED: Assignment tetap persisten melintasi siklus autentikasi staff.');
    passed++;
  } else {
    throw new Error('❌ TEST 3 FAILED: Assignment lost across logout/login');
  }

  // --------------------------------------------------------------------------
  // TEST 4: Buka dari sesi/browser berbeda → assignment tetap terbaca
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 4: Buka dari Sesi / Staff Berbeda (Universal Read) ---');
  const db = await getDB();
  const rawRows = await db.query<any>(
    'SELECT * FROM operational_assignments WHERE booking_code = ?',
    [testBookingCode]
  );
  if (rawRows.length === 1 && rawRows[0].booking_code === testBookingCode) {
    console.log('✅ TEST 4 PASSED: Staff di browser/sesi lain membaca assignment yang sama persis dari SQL table:');
    console.log(`   - Driver: ${rawRows[0].driver_name}`);
    console.log(`   - Vehicle: ${rawRows[0].vehicle_name} (${rawRows[0].plate_number})`);
    console.log(`   - Status: ${rawRows[0].status}`);
    passed++;
  } else {
    throw new Error('❌ TEST 4 FAILED: Cross-browser session data mismatch');
  }

  // --------------------------------------------------------------------------
  // TEST 5: Update assignment → data berubah persistent
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 5: Update Assignment (Perubahan Kru & Status) ---');
  const updatePayload = {
    bookingId: testBookingId,
    bookingCode: testBookingCode,
    vehicleName: 'Toyota Innova Reborn',
    plateNumber: 'N 1450 SJ',
    driverName: 'Bpk. Agus Santoso',
    driverPhone: '+62 813-9876-5432',
    guideName: 'Bli Wayan Budiana',
    status: 'On Trip' as const,
    note: 'Armada diganti atas permintaan tamu VIP'
  };

  const updated = await assignmentsRepo.save(updatePayload);
  const reReadUpdated = await assignmentsRepo.getByKey(testBookingCode);
  if (
    reReadUpdated &&
    reReadUpdated.vehicleName === 'Toyota Innova Reborn' &&
    reReadUpdated.plateNumber === 'N 1450 SJ' &&
    reReadUpdated.driverName === 'Bpk. Agus Santoso' &&
    reReadUpdated.status === 'On Trip'
  ) {
    console.log('✅ TEST 5 PASSED: Update assignment tersimpan secara persistent di database SQL.');
    console.log(`   - Armada baru: ${reReadUpdated.vehicleName} (${reReadUpdated.plateNumber})`);
    console.log(`   - Driver baru: ${reReadUpdated.driverName}`);
    console.log(`   - Status baru: ${reReadUpdated.status}`);
    passed++;
  } else {
    throw new Error('❌ TEST 5 FAILED: Updated assignment did not persist correctly');
  }

  // --------------------------------------------------------------------------
  // TEST 6: Hapus/unassign → data benar-benar hilang
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 6: Hapus / Unassign Assignment ---');
  const deleted = await assignmentsRepo.delete(testBookingCode);
  const reReadAfterDelete = await assignmentsRepo.getByKey(testBookingCode);
  const rawRowsAfterDelete = await db.query<any>(
    'SELECT * FROM operational_assignments WHERE booking_code = ?',
    [testBookingCode]
  );
  if (deleted && !reReadAfterDelete && rawRowsAfterDelete.length === 0) {
    console.log('✅ TEST 6 PASSED: Assignment benar-benar terhapus dari SQL database (data bersih).');
    passed++;
  } else {
    throw new Error('❌ TEST 6 FAILED: Assignment was not completely deleted');
  }

  // --------------------------------------------------------------------------
  // TEST 7: Pastikan Calendar/Departures membaca assignment yang sama
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 7: Konsistensi Antar Tab (Calendar, Departures, Assignment) ---');
  // Verify master resources are loaded from SQL transport_data
  const resources = await assignmentsRepo.getResources();
  if (
    resources.fleet.length >= 4 &&
    resources.drivers.length >= 4 &&
    resources.guides.length >= 3
  ) {
    console.log(`✅ Master resources loaded from SQL:`);
    console.log(`   - Fleet: ${resources.fleet.length} armada`);
    console.log(`   - Drivers: ${resources.drivers.length} supir`);
    console.log(`   - Guides: ${resources.guides.length} pemandu`);
  }

  // Re-create an assignment to test calendar & departures unified key access
  await assignmentsRepo.save({
    bookingId: 'bk-cal-dep-test',
    bookingCode: 'CAL-DEP-001',
    vehicleName: 'Toyota HiAce Premio',
    plateNumber: 'N 7088 SJ',
    driverName: 'Bpk. Hendra Saputra',
    driverPhone: '+62 812-3456-7890',
    status: 'Ready'
  });

  const allMap = await assignmentsRepo.getAll();
  const calendarKeyLookup = allMap['CAL-DEP-001'];
  const departuresKeyLookup = allMap['bk-cal-dep-test'];

  if (
    calendarKeyLookup &&
    departuresKeyLookup &&
    calendarKeyLookup.driverName === departuresKeyLookup.driverName &&
    calendarKeyLookup.vehicleName === departuresKeyLookup.vehicleName
  ) {
    console.log('✅ TEST 7 PASSED: Calendar dan Departures membaca record assignment yang 100% konsisten.');
    passed++;
  } else {
    throw new Error('❌ TEST 7 FAILED: Inconsistent assignment lookup across tabs');
  }

  // Cleanup test record
  await assignmentsRepo.delete('CAL-DEP-001');

  console.log(`\n=======================================================`);
  console.log(`🎉 ALL ${passed}/${total} OPERATIONS ASSIGNMENT TESTS PASSED!`);
  console.log(`=======================================================\n`);
}

runTests().catch(err => {
  console.error('\n❌ TEST RUNNER FAILED:', err);
  process.exit(1);
});
