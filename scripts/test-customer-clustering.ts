// ==============================================================================
// TEST SUITE: HIGH-04 CUSTOMER CLUSTERING VERIFICATION
// Validates multi-contact clustering, secondary email/phone mapping, and zero duplicate profiles
// ==============================================================================
import { UnifiedBookingDetail } from '../src/components/admin/BookingDetailModal';

// Normalization functions mirror CustomersView.tsx
function normalizePhone(phone?: string): string {
  if (!phone || phone === '-') return '';
  let digits = phone.replace(/\D/g, '');
  if (!digits || digits.length < 7) return '';
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  else if (digits.startsWith('8')) digits = '62' + digits;
  return digits;
}

function normalizeEmail(email?: string): string {
  if (!email || email === '-') return '';
  const clean = email.trim().toLowerCase();
  if (clean.length < 5 || !clean.includes('@') || !clean.includes('.')) return '';
  const [local, domain] = clean.split('@');
  if (!local || !domain || domain.length < 3) return '';
  if (['admin', 'test', 'unknown', 'noreply', 'no-reply', 'null', 'undefined', 'dummy'].includes(local)) return '';
  return clean;
}

interface CustomerProfile {
  id: string;
  primaryName: string;
  allNames: string[];
  primaryEmail: string;
  allEmails: string[];
  primaryPhone: string;
  allPhones: string[];
  bookings: UnifiedBookingDetail[];
  totalBookings: number;
}

function clusterCustomers(bookings: UnifiedBookingDetail[]): CustomerProfile[] {
  const emailToId = new Map<string, string>();
  const phoneToId = new Map<string, string>();
  const profiles = new Map<string, CustomerProfile>();

  let idCounter = 1;

  bookings.forEach((b) => {
    const rawEmail = (b.customerEmail || (b as any).email || '').trim();
    const cleanEmail = normalizeEmail(rawEmail);

    const rawPhone = (b.customerPhone || (b as any).phone || '').trim();
    const cleanPhone = normalizePhone(rawPhone);

    const rawName = (b.customerName || (b as any).name || '').trim();

    if (!rawName && !cleanEmail && !cleanPhone) return;

    const emailMatchId = cleanEmail ? emailToId.get(cleanEmail) : undefined;
    const phoneMatchId = cleanPhone ? phoneToId.get(cleanPhone) : undefined;

    let targetId: string | undefined;

    if (emailMatchId && phoneMatchId && emailMatchId !== phoneMatchId) {
      targetId = emailMatchId;
      const sourceId = phoneMatchId;
      const primaryProf = profiles.get(targetId);
      const sourceProf = profiles.get(sourceId);

      if (primaryProf && sourceProf) {
        primaryProf.bookings.push(...sourceProf.bookings);
        primaryProf.totalBookings += sourceProf.totalBookings;

        sourceProf.allNames.forEach(n => {
          if (!primaryProf.allNames.includes(n)) primaryProf.allNames.push(n);
        });
        sourceProf.allEmails.forEach(e => {
          if (!primaryProf.allEmails.includes(e)) primaryProf.allEmails.push(e);
        });
        sourceProf.allPhones.forEach(p => {
          if (!primaryProf.allPhones.includes(p)) primaryProf.allPhones.push(p);
        });

        sourceProf.allEmails.forEach(e => {
          const ce = normalizeEmail(e);
          if (ce) emailToId.set(ce, targetId!);
        });
        sourceProf.allPhones.forEach(p => {
          const cp = normalizePhone(p);
          if (cp) phoneToId.set(cp, targetId!);
        });

        profiles.delete(sourceId);
      }
    } else {
      targetId = emailMatchId || phoneMatchId;
    }

    if (!targetId) {
      targetId = `CUST-${String(idCounter++).padStart(4, '0')}`;
      const newProf: CustomerProfile = {
        id: targetId,
        primaryName: rawName || 'Tamu Smart Journey',
        allNames: rawName ? [rawName] : [],
        primaryEmail: b.customerEmail || cleanEmail || rawEmail || '-',
        allEmails: (b.customerEmail && b.customerEmail !== '-') ? [b.customerEmail] : (cleanEmail ? [cleanEmail] : []),
        primaryPhone: b.customerPhone || rawPhone || '-',
        allPhones: (b.customerPhone && b.customerPhone !== '-') ? [b.customerPhone] : (rawPhone && rawPhone !== '-' ? [rawPhone] : []),
        bookings: [b],
        totalBookings: 1
      };

      profiles.set(targetId, newProf);
      if (cleanEmail) emailToId.set(cleanEmail, targetId);
      if (cleanPhone) phoneToId.set(cleanPhone, targetId);
    } else {
      const prof = profiles.get(targetId)!;
      prof.bookings.push(b);
      prof.totalBookings += 1;

      if (rawName && !prof.allNames.includes(rawName)) {
        prof.allNames.push(rawName);
      }

      const displayEmail = b.customerEmail || rawEmail;
      if (displayEmail && displayEmail !== '-' && !prof.allEmails.includes(displayEmail)) {
        prof.allEmails.push(displayEmail);
      }
      if (cleanEmail) {
        emailToId.set(cleanEmail, targetId);
      }

      const displayPhone = b.customerPhone || rawPhone;
      if (displayPhone && displayPhone !== '-' && !prof.allPhones.includes(displayPhone)) {
        prof.allPhones.push(displayPhone);
      }
      if (cleanPhone) {
        phoneToId.set(cleanPhone, targetId);
      }

      if (cleanEmail) emailToId.set(cleanEmail, targetId);
      if (cleanPhone) phoneToId.set(cleanPhone, targetId);
    }
  });

  return Array.from(profiles.values());
}

async function runTests() {
  console.log('🚀 Running HIGH-04 Customer Clustering Test Suite...\n');
  let passed = 0;
  const total = 7;

  // Mock Bookings
  // Booking 1: Customer A with Primary Email & Primary Phone
  const booking1: any = {
    id: 'bk-1',
    bookingCode: 'SJ-001',
    customerName: 'Ahmad Dahlan',
    customerEmail: 'ahmad@gmail.com',
    customerPhone: '+62 812-1111-2222',
    serviceType: 'tour',
    serviceTitle: 'Bromo Sunrise Tour',
    date: '2026-10-01',
    paymentStatus: 'Paid',
    bookingStatus: 'Confirmed',
    totalAmountIDR: 1500000
  };

  // Booking 2: Customer A with Secondary Email & Same Phone
  const booking2: any = {
    id: 'bk-2',
    bookingCode: 'SJ-002',
    customerName: 'Ahmad Dahlan',
    customerEmail: 'ahmad.office@corporate.co.id',
    customerPhone: '+62 812-1111-2222',
    serviceType: 'sharetour',
    serviceTitle: 'Open Trip Ijen Blue Fire',
    date: '2026-10-05',
    paymentStatus: 'Paid',
    bookingStatus: 'Confirmed',
    totalAmountIDR: 850000
  };

  // Booking 3: Customer A with Primary Email & Secondary Phone
  const booking3: any = {
    id: 'bk-3',
    bookingCode: 'SJ-003',
    customerName: 'Ahmad Dahlan',
    customerEmail: 'ahmad@gmail.com',
    customerPhone: '0899-7777-8888',
    serviceType: 'airport',
    serviceTitle: 'Airport Transfer Juanda',
    date: '2026-10-10',
    paymentStatus: 'Paid',
    bookingStatus: 'Confirmed',
    totalAmountIDR: 450000
  };

  // Booking 4: Customer A with Secondary Email + Secondary Phone ONLY (neither primary is present!)
  const booking4: any = {
    id: 'bk-4',
    bookingCode: 'SJ-004',
    customerName: 'Ahmad Dahlan',
    customerEmail: 'ahmad.office@corporate.co.id',
    customerPhone: '+62 899-7777-8888',
    serviceType: 'car-rental',
    serviceTitle: 'Rental HiAce Premio 2 Hari',
    date: '2026-10-15',
    paymentStatus: 'Paid',
    bookingStatus: 'Confirmed',
    totalAmountIDR: 2400000
  };

  // Booking 5: Customer B with completely distinct email and phone
  const booking5: any = {
    id: 'bk-5',
    bookingCode: 'SJ-005',
    customerName: 'Siti Rahma',
    customerEmail: 'siti.rahma@yahoo.com',
    customerPhone: '+62 856-3333-4444',
    serviceType: 'tour',
    serviceTitle: 'Malang Batu City Tour',
    date: '2026-10-20',
    paymentStatus: 'Paid',
    bookingStatus: 'Confirmed',
    totalAmountIDR: 1200000
  };

  // --- RUN CLUSTERING ---
  const initialCluster = clusterCustomers([booking1]);
  console.log('--- TEST 1: Customer A Booking dengan Phone + Email Utama ---');
  if (initialCluster.length === 1 && initialCluster[0].id === 'CUST-0001') {
    console.log(`✅ TEST 1 PASSED: Profile awal Customer A terbentuk (${initialCluster[0].id}, ${initialCluster[0].primaryName}).`);
    passed++;
  } else {
    throw new Error('TEST 1 FAILED');
  }

  console.log('\n--- TEST 2: Booking Berikutnya Memakai Email Berbeda tetapi Phone Sama ---');
  const cluster2 = clusterCustomers([booking1, booking2]);
  if (
    cluster2.length === 1 && 
    cluster2[0].id === 'CUST-0001' && 
    cluster2[0].allEmails.includes('ahmad.office@corporate.co.id')
  ) {
    console.log('✅ TEST 2 PASSED: Profile tetap Customer A, email sekunder berhasil ditambahkan dan dipetakan.');
    passed++;
  } else {
    throw new Error(`TEST 2 FAILED: Expected 1 profile, got ${cluster2.length}`);
  }

  console.log('\n--- TEST 3: Booking Berikutnya Memakai Phone Berbeda tetapi Email Sama ---');
  const cluster3 = clusterCustomers([booking1, booking2, booking3]);
  if (
    cluster3.length === 1 && 
    cluster3[0].id === 'CUST-0001' && 
    cluster3[0].allPhones.length >= 2
  ) {
    console.log('✅ TEST 3 PASSED: Profile tetap Customer A, phone sekunder berhasil ditambahkan dan dipetakan.');
    passed++;
  } else {
    throw new Error(`TEST 3 FAILED: Expected 1 profile, got ${cluster3.length}`);
  }

  console.log('\n--- TEST 4: Booking Berikutnya Memakai Email Sekunder + Phone Sekunder ---');
  const cluster4 = clusterCustomers([booking1, booking2, booking3, booking4]);
  if (
    cluster4.length === 1 && 
    cluster4[0].id === 'CUST-0001' && 
    cluster4[0].bookings.length === 4
  ) {
    console.log('✅ TEST 4 PASSED: Booking dengan email & phone sekunder tetap masuk ke profile Customer A (tidak ada duplicate profile).');
    passed++;
  } else {
    throw new Error(`TEST 4 FAILED: Expected 1 profile with 4 bookings, got ${cluster4.length} profiles`);
  }

  console.log('\n--- TEST 5: Customer Berbeda dengan Email + Phone Berbeda ---');
  const cluster5 = clusterCustomers([booking1, booking2, booking3, booking4, booking5]);
  if (
    cluster5.length === 2 && 
    cluster5.some(c => c.primaryName === 'Ahmad Dahlan' && c.bookings.length === 4) &&
    cluster5.some(c => c.primaryName === 'Siti Rahma' && c.bookings.length === 1)
  ) {
    console.log('✅ TEST 5 PASSED: Customer B membentuk profile terpisah secara rapi (total 2 profiles).');
    passed++;
  } else {
    throw new Error(`TEST 5 FAILED: Expected 2 distinct profiles, got ${cluster5.length}`);
  }

  console.log('\n--- TEST 6: Pastikan Seluruh Booking History Tetap Muncul ---');
  const ahmadProfile = cluster5.find(c => c.primaryName === 'Ahmad Dahlan')!;
  const expectedCodes = ['SJ-001', 'SJ-002', 'SJ-003', 'SJ-004'];
  const actualCodes = ahmadProfile.bookings.map(b => b.bookingCode);
  const allHistoryPresent = expectedCodes.every(code => actualCodes.includes(code));
  if (allHistoryPresent && ahmadProfile.bookings.length === 4) {
    console.log(`✅ TEST 6 PASSED: Seluruh ${ahmadProfile.bookings.length} booking history Ahmad Dahlan lengkap: [${actualCodes.join(', ')}]`);
    passed++;
  } else {
    throw new Error('TEST 6 FAILED: Missing booking history');
  }

  console.log('\n--- TEST 7: Cross-Cluster Merge (Mencegah Duplicate Profile Jika Terhubung di Kemudian Hari) ---');
  // Two bookings originally disconnected:
  const bookingX: any = {
    id: 'bk-x',
    bookingCode: 'SJ-X',
    customerName: 'Joko Widodo',
    customerEmail: 'joko@work.com',
    customerPhone: '+62 811-0000-1111'
  };
  const bookingY: any = {
    id: 'bk-y',
    bookingCode: 'SJ-Y',
    customerName: 'Joko Widodo',
    customerEmail: 'joko.personal@gmail.com',
    customerPhone: '+62 822-0000-2222'
  };
  // Third booking links them:
  const bookingZ: any = {
    id: 'bk-z',
    bookingCode: 'SJ-Z',
    customerName: 'Joko Widodo',
    customerEmail: 'joko@work.com',
    customerPhone: '+62 822-0000-2222'
  };
  const mergedCluster = clusterCustomers([bookingX, bookingY, bookingZ]);
  if (mergedCluster.length === 1 && mergedCluster[0].bookings.length === 3) {
    console.log(`✅ TEST 7 PASSED: Dua profil terpisah berhasil digabungkan (merged) tanpa duplikasi saat terhubung oleh booking ke-3.`);
    passed++;
  } else {
    throw new Error(`TEST 7 FAILED: Expected 1 merged profile, got ${mergedCluster.length}`);
  }

  console.log(`\n=======================================================`);
  console.log(`🎉 ALL ${passed}/${total} CUSTOMER CLUSTERING TESTS PASSED!`);
  console.log(`=======================================================\n`);
}

runTests().catch(err => {
  console.error('\n❌ TEST RUNNER FAILED:', err);
  process.exit(1);
});
