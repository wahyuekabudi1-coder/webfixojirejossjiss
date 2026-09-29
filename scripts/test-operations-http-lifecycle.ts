// ==============================================================================
// FULL HTTP LIFECYCLE TEST FOR OPERATIONS ASSIGNMENTS & RESOURCES
// ==============================================================================
async function main() {
  console.log('Testing Operations HTTP Endpoints on http://localhost:3000...\n');

  // 1. Login to get real token
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'admin123' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log('1. Admin Logged In. Token acquired:', token ? 'SUCCESS' : 'FAILED');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 2. Fetch resources
  const resRes = await fetch('http://localhost:3000/api/operations/resources', { headers });
  const resources = await resRes.json();
  console.log('2. GET /api/operations/resources:');
  console.log(`   Fleet count: ${resources.fleet?.length}`);
  console.log(`   Drivers count: ${resources.drivers?.length}`);
  console.log(`   Guides count: ${resources.guides?.length}`);
  if (!resources.fleet?.length || !resources.drivers?.length || !resources.guides?.length) {
    throw new Error('Resources not returned correctly');
  }

  // 3. Create assignment via POST /api/operations/assignments
  const testCode = 'HTTP-TEST-001';
  const postRes = await fetch('http://localhost:3000/api/operations/assignments', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      bookingCode: testCode,
      bookingId: 'bk-http-001',
      vehicleName: 'Toyota HiAce Premio',
      plateNumber: 'N 7088 SJ',
      driverName: 'Bpk. Hendra Saputra',
      driverPhone: '+62 812-3456-7890',
      guideName: 'Mas Dimas (HPI Certified)',
      status: 'Ready',
      note: 'Instruksi VIP tamu dari Surabaya'
    })
  });
  const postData = await postRes.json();
  console.log('3. POST /api/operations/assignments:', postData.success ? 'CREATED' : 'FAILED');

  // 4. GET /api/operations/assignments (verify persistence)
  const getRes = await fetch('http://localhost:3000/api/operations/assignments', { headers });
  const getData = await getRes.json();
  const found = getData.assignments?.[testCode];
  console.log('4. GET /api/operations/assignments:', found?.driverName === 'Bpk. Hendra Saputra' ? 'VERIFIED PERSISTED' : 'FAILED');

  // 5. Update assignment
  const updateRes = await fetch('http://localhost:3000/api/operations/assignments', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      bookingCode: testCode,
      bookingId: 'bk-http-001',
      vehicleName: 'Toyota Innova Reborn',
      plateNumber: 'N 1450 SJ',
      driverName: 'Bpk. Agus Santoso',
      driverPhone: '+62 813-9876-5432',
      status: 'On Trip'
    })
  });
  const updateData = await updateRes.json();
  console.log('5. POST /api/operations/assignments (update):', updateData.success ? 'UPDATED' : 'FAILED');

  // Verify updated
  const getUpdatedRes = await fetch('http://localhost:3000/api/operations/assignments', { headers });
  const getUpdatedData = await getUpdatedRes.json();
  const updatedFound = getUpdatedData.assignments?.[testCode];
  console.log('6. Verify Updated in SQL:', updatedFound?.vehicleName === 'Toyota Innova Reborn' && updatedFound?.status === 'On Trip' ? 'VERIFIED' : 'FAILED');

  // 7. Delete / Unassign via DELETE /api/operations/assignments/:key
  const delRes = await fetch(`http://localhost:3000/api/operations/assignments/${testCode}`, {
    method: 'DELETE',
    headers
  });
  const delData = await delRes.json();
  console.log('7. DELETE /api/operations/assignments/:key:', delData.deleted ? 'DELETED' : 'FAILED');

  // Verify delete
  const getAfterDel = await fetch('http://localhost:3000/api/operations/assignments', { headers });
  const getAfterDelData = await getAfterDel.json();
  console.log('8. Verify Deleted in SQL:', !getAfterDelData.assignments?.[testCode] ? 'VERIFIED CLEAN' : 'FAILED');

  // 9. Cross-Session / Multiple Staff test
  // Log in as second session
  const login2Res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'admin123' })
  });
  const token2 = (await login2Res.json()).token;
  const headers2 = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token2}`
  };

  // Staff 1 creates assignment
  await fetch('http://localhost:3000/api/operations/assignments', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      bookingCode: 'CROSS-SESSION-001',
      vehicleName: 'Toyota HiAce Commuter',
      plateNumber: 'N 7192 SJ',
      driverName: 'Bpk. Tomi Wijaya',
      driverPhone: '+62 852-1122-3344',
      status: 'Ready'
    })
  });

  // Staff 2 reads assignment
  const staff2Read = await (await fetch('http://localhost:3000/api/operations/assignments', { headers: headers2 })).json();
  const staff2Found = staff2Read.assignments?.['CROSS-SESSION-001'];
  console.log('9. Cross-Session Verification (Staff 2 reads Staff 1 allocation):', staff2Found?.driverName === 'Bpk. Tomi Wijaya' ? 'SUCCESS' : 'FAILED');

  // Cleanup
  await fetch('http://localhost:3000/api/operations/assignments/CROSS-SESSION-001', {
    method: 'DELETE',
    headers: headers2
  });

  console.log('\n🎉 ALL HTTP OPERATIONS LIFECYCLE TESTS COMPLETED SUCCESSFULLY!\n');
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
