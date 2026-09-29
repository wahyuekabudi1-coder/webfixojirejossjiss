// ==============================================================================
// TEST SUITE: HIGH-03 REAL ADMIN PASSWORD CHANGE E2E
// Tests all 8 functional requirements + validation + session safety
// ==============================================================================
async function runTests() {
  console.log('🚀 Starting HIGH-03 Real Admin Password Change Test Suite...\n');
  const BASE_URL = 'http://localhost:3000';
  let passed = 0;
  const total = 8;

  // --------------------------------------------------------------------------
  // TEST 1: Password lama valid sebelum perubahan
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: Password Lama Valid Sebelum Perubahan ---');
  const loginOldRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'admin123' })
  });
  if (loginOldRes.status !== 200) {
    throw new Error(`TEST 1 FAILED: Expected HTTP 200, got ${loginOldRes.status}`);
  }
  const loginOldData = await loginOldRes.json();
  const originalToken = loginOldData.token;
  if (!originalToken) {
    throw new Error('TEST 1 FAILED: No session token returned');
  }
  console.log('✅ TEST 1 PASSED: Password lama (admin123) berhasil login dan token didapatkan.');
  passed++;

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${originalToken}`
  };

  // --------------------------------------------------------------------------
  // TEST 3 (run before change): Current password salah -> HTTP 401/403
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 3: Current Password Salah -> Ditolak HTTP 401 ---');
  const wrongCurrentRes = await fetch(`${BASE_URL}/api/auth/change-password`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      currentPassword: 'wrongPasswordXYZ',
      newPassword: 'SuperSecretNewPass2026!',
      confirmPassword: 'SuperSecretNewPass2026!'
    })
  });
  if (wrongCurrentRes.status !== 401) {
    throw new Error(`TEST 3 FAILED: Expected HTTP 401, got ${wrongCurrentRes.status}`);
  }
  const wrongCurrentData = await wrongCurrentRes.json();
  console.log(`✅ TEST 3 PASSED: Server menolak current password salah dengan HTTP 401: "${wrongCurrentData.error}"`);
  passed++;

  // --------------------------------------------------------------------------
  // TEST 4: Password baru tidak memenuhi validasi (< 6 char) -> ditolak HTTP 400
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 4: Password Baru Terlalu Pendek -> Ditolak HTTP 400 ---');
  const shortPassRes = await fetch(`${BASE_URL}/api/auth/change-password`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      currentPassword: 'admin123',
      newPassword: '12345',
      confirmPassword: '12345'
    })
  });
  if (shortPassRes.status !== 400) {
    throw new Error(`TEST 4 FAILED: Expected HTTP 400, got ${shortPassRes.status}`);
  }
  const shortPassData = await shortPassRes.json();
  console.log(`✅ TEST 4 PASSED: Server menolak password baru < 6 karakter dengan HTTP 400: "${shortPassData.error}"`);
  passed++;

  // --------------------------------------------------------------------------
  // TEST 5: Password confirmation berbeda -> ditolak HTTP 400
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 5: Konfirmasi Password Berbeda -> Ditolak HTTP 400 ---');
  const mismatchRes = await fetch(`${BASE_URL}/api/auth/change-password`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      currentPassword: 'admin123',
      newPassword: 'SuperSecretNewPass2026!',
      confirmPassword: 'NotTheSamePass12345!'
    })
  });
  if (mismatchRes.status !== 400) {
    throw new Error(`TEST 5 FAILED: Expected HTTP 400, got ${mismatchRes.status}`);
  }
  const mismatchData = await mismatchRes.json();
  console.log(`✅ TEST 5 PASSED: Server menolak konfirmasi password yang tidak cocok dengan HTTP 400: "${mismatchData.error}"`);
  passed++;

  // --------------------------------------------------------------------------
  // TEST 2: Change password berhasil dengan current password benar
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2: Change Password Berhasil dengan Kredensial Benar ---');
  const newSecretPassword = 'SuperSecretNewPass2026!';
  const changeRes = await fetch(`${BASE_URL}/api/auth/change-password`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      currentPassword: 'admin123',
      newPassword: newSecretPassword,
      confirmPassword: newSecretPassword
    })
  });
  if (changeRes.status !== 200) {
    const err = await changeRes.text();
    throw new Error(`TEST 2 FAILED: Expected HTTP 200, got ${changeRes.status}: ${err}`);
  }
  const changeData = await changeRes.json();
  console.log(`✅ TEST 2 PASSED: Password berhasil diubah: "${changeData.message}"`);
  passed++;

  // --------------------------------------------------------------------------
  // TEST 8: Session/token existing tetap aman
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 8: Session Token Existing Tetap Aman & Valid ---');
  const verifyRes = await fetch(`${BASE_URL}/api/auth/verify`, {
    headers: authHeaders
  });
  if (verifyRes.status !== 200) {
    throw new Error(`TEST 8 FAILED: Expected HTTP 200, got ${verifyRes.status}`);
  }
  const verifyData = await verifyRes.json();
  if (!verifyData.authenticated || !verifyData.valid) {
    throw new Error('TEST 8 FAILED: Session was unexpectedly invalidated');
  }
  console.log('✅ TEST 8 PASSED: Sesi admin yang sedang berjalan tetap aktif dan aman.');
  passed++;

  // --------------------------------------------------------------------------
  // TEST 6: Login dengan password lama setelah perubahan -> gagal HTTP 401
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 6: Login dengan Password Lama (admin123) Harus Gagal ---');
  const loginOldAfterRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'admin123' })
  });
  if (loginOldAfterRes.status !== 401) {
    throw new Error(`TEST 6 FAILED: Expected HTTP 401 for old password, got ${loginOldAfterRes.status}`);
  }
  console.log('✅ TEST 6 PASSED: Login dengan password lama langsung ditolak oleh server (HTTP 401).');
  passed++;

  // --------------------------------------------------------------------------
  // TEST 7: Login dengan password baru -> berhasil HTTP 200
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 7: Login dengan Password Baru Harus Berhasil ---');
  const loginNewRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: newSecretPassword })
  });
  if (loginNewRes.status !== 200) {
    const err = await loginNewRes.text();
    throw new Error(`TEST 7 FAILED: Expected HTTP 200 for new password, got ${loginNewRes.status}: ${err}`);
  }
  const loginNewData = await loginNewRes.json();
  const newToken = loginNewData.token;
  if (!newToken) {
    throw new Error('TEST 7 FAILED: No new session token returned');
  }
  console.log('✅ TEST 7 PASSED: Login dengan password baru berhasil dan sesi baru diterbitkan.');
  passed++;

  // CLEANUP / RESTORE: kembalikan password ke admin123
  console.log('\n--- RESTORE: Mengembalikan Password ke "admin123" ---');
  const restoreRes = await fetch(`${BASE_URL}/api/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${newToken}`
    },
    body: JSON.stringify({
      currentPassword: newSecretPassword,
      newPassword: 'admin123',
      confirmPassword: 'admin123'
    })
  });
  if (restoreRes.status !== 200) {
    throw new Error('Failed to restore password to admin123');
  }
  console.log('✅ RESTORE SUCCESSFUL: Password dikembalikan ke "admin123" secara persisten.');

  // Verify restored login
  const verifyRestoreRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'admin123' })
  });
  if (verifyRestoreRes.status !== 200) {
    throw new Error('Restored password verification failed');
  }
  console.log('✅ CANONICAL STATE VERIFIED: Login admin123 normal.');

  console.log(`\n=======================================================`);
  console.log(`🎉 ALL ${passed}/${total} PASSWORD CHANGE TESTS PASSED!`);
  console.log(`=======================================================\n`);
}

runTests().catch(err => {
  console.error('\n❌ TEST RUNNER FAILED:', err);
  process.exit(1);
});
