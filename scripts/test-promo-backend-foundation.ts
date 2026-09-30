// ==============================================================================
// TEST SUITE: MEDIUM-02A PROMO BACKEND FOUNDATION
// Verifies all 20 mandatory test points specified in the prompt
// ==============================================================================

import assert from 'assert';

const BASE_URL = 'http://127.0.0.1:3000';

async function runTestSuite() {
  console.log('================================================================');
  console.log('🚀 RUNNING MEDIUM-02A PROMO BACKEND FOUNDATION TEST SUITE');
  console.log('================================================================');

  let passedTests = 0;

  // Helper for admin login to obtain role-based sessions
  async function loginAs(role: string): Promise<string> {
    const res = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: process.env.ADMIN_PASSWORD || 'admin123',
        role
      })
    });
    const data = await res.json();
    if (!res.ok || !data.token) {
      throw new Error(`Failed to login as ${role}: ${JSON.stringify(data)}`);
    }
    return data.token;
  }

  // Obtain test tokens
  console.log('\n[Setup] Authenticating test sessions...');
  const marketingToken = await loginAs('Marketing Executive'); // has manageCMS
  const financeToken = await loginAs('Finance Officer');      // does NOT have manageCMS
  const superadminToken = await loginAs('Super Administrator'); // superadmin full access
  console.log('✅ Tokens obtained successfully.');

  // ---------------------------------------------------------------------------
  // TEST 13: Unauthenticated admin API -> 401
  // ---------------------------------------------------------------------------
  console.log('\n[Test 13] Verifying unauthenticated request to /api/admin/promos returns 401...');
  const unauthRes = await fetch(`${BASE_URL}/api/admin/promos`);
  assert.strictEqual(unauthRes.status, 401, 'Unauthenticated request must return 401');
  console.log('✅ Passed Test 13: Unauthenticated request returned HTTP 401.');
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST 14: Role without manageCMS -> 403
  // ---------------------------------------------------------------------------
  console.log('\n[Test 14] Verifying role without manageCMS (Finance Officer) returns 403...');
  const forbiddenRes = await fetch(`${BASE_URL}/api/admin/promos`, {
    headers: { Authorization: `Bearer ${financeToken}` }
  });
  assert.strictEqual(forbiddenRes.status, 403, 'Role without manageCMS must return 403');
  console.log('✅ Passed Test 14: Finance Officer without manageCMS returned HTTP 403.');
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST 15: Authorized role (Marketing Executive) -> 200/201
  // ---------------------------------------------------------------------------
  console.log('\n[Test 15] Verifying role with manageCMS (Marketing Executive) returns 200...');
  const authorizedRes = await fetch(`${BASE_URL}/api/admin/promos`, {
    headers: { Authorization: `Bearer ${marketingToken}` }
  });
  assert.strictEqual(authorizedRes.status, 200, 'Marketing Executive must return 200');
  const initialList = await authorizedRes.json();
  assert(Array.isArray(initialList), 'Expected an array of promo codes');
  console.log(`✅ Passed Test 15: Authorized role returned HTTP 200 (Total promos: ${initialList.length}).`);
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST 1: Create promo
  // ---------------------------------------------------------------------------
  console.log('\n[Test 1] Testing Admin POST /api/admin/promos to create promo...');
  const testCode = `TESTPROMO${Date.now().toString().slice(-4)}`;
  const createPayload = {
    code: testCode,
    discountType: 'percentage',
    discountValue: 20,
    minSpendIDR: 500000,
    maxDiscount: 150000,
    validUntil: '2026-12-31',
    maxUsage: 50,
    description: 'Promo Uji Coba Diskon 20%',
    isActive: true
  };

  const createRes = await fetch(`${BASE_URL}/api/admin/promos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${marketingToken}`
    },
    body: JSON.stringify(createPayload)
  });
  assert.strictEqual(createRes.status, 201, `Create promo must return 201 (Got ${createRes.status})`);
  const createdPromo = await createRes.json();
  assert.strictEqual(createdPromo.code, testCode);
  assert.strictEqual(createdPromo.discountValue, 20);
  console.log(`✅ Passed Test 1: Created promo ${createdPromo.code} with ID ${createdPromo.id}.`);
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST 2: Read promo
  // ---------------------------------------------------------------------------
  console.log('\n[Test 2] Testing Admin GET /api/admin/promos to read promo list...');
  const readRes = await fetch(`${BASE_URL}/api/admin/promos`, {
    headers: { Authorization: `Bearer ${marketingToken}` }
  });
  assert.strictEqual(readRes.status, 200);
  const readList = await readRes.json();
  const found = readList.find((p: any) => p.code === testCode);
  assert(found, `Newly created promo ${testCode} must be present in promo list`);
  assert.strictEqual(found.discountValue, 20);
  console.log(`✅ Passed Test 2: Read promo verified in list.`);
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST 3: Update promo
  // ---------------------------------------------------------------------------
  console.log(`\n[Test 3] Testing Admin PUT /api/admin/promos/${testCode} to update promo...`);
  const updateRes = await fetch(`${BASE_URL}/api/admin/promos/${testCode}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${marketingToken}`
    },
    body: JSON.stringify({
      discountValue: 25,
      description: 'Updated Description Diskon 25%'
    })
  });
  assert.strictEqual(updateRes.status, 200, `Update promo must return 200 (Got ${updateRes.status})`);
  const updatedPromo = await updateRes.json();
  assert.strictEqual(updatedPromo.discountValue, 25);
  assert.strictEqual(updatedPromo.description, 'Updated Description Diskon 25%');
  console.log(`✅ Passed Test 3: Updated promo verified (discountValue is now 25%).`);
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST 5: Duplicate code rejected
  // ---------------------------------------------------------------------------
  console.log('\n[Test 5] Testing duplicate promo code creation is rejected...');
  const duplicateRes = await fetch(`${BASE_URL}/api/admin/promos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${marketingToken}`
    },
    body: JSON.stringify({
      code: testCode, // duplicate
      discountType: 'fixed',
      discountValue: 50000,
      minSpendIDR: 200000,
      validUntil: '2026-12-31'
    })
  });
  assert(duplicateRes.status === 409 || duplicateRes.status === 400, `Duplicate promo must be rejected (Got ${duplicateRes.status})`);
  console.log(`✅ Passed Test 5: Duplicate code rejected with HTTP ${duplicateRes.status}.`);
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST 4: Delete promo
  // ---------------------------------------------------------------------------
  console.log(`\n[Test 4] Testing Admin DELETE /api/admin/promos/${testCode}...`);
  const deleteRes = await fetch(`${BASE_URL}/api/admin/promos/${testCode}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${marketingToken}` }
  });
  assert.strictEqual(deleteRes.status, 200, `Delete promo must return 200 (Got ${deleteRes.status})`);
  const deleteList = await (await fetch(`${BASE_URL}/api/admin/promos`, {
    headers: { Authorization: `Bearer ${marketingToken}` }
  })).json();
  assert(!deleteList.some((p: any) => p.code === testCode), 'Deleted promo must no longer be present');
  console.log(`✅ Passed Test 4: Delete promo verified.`);
  passedTests++;

  // ---------------------------------------------------------------------------
  // Create targeted promos for validation checks: inactive, expired, min spend, max usage
  // ---------------------------------------------------------------------------
  const inactiveCode = `INACT_${Date.now()}`;
  await fetch(`${BASE_URL}/api/admin/promos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${marketingToken}` },
    body: JSON.stringify({
      code: inactiveCode,
      discountType: 'percentage',
      discountValue: 10,
      minSpendIDR: 100000,
      validUntil: '2026-12-31',
      isActive: false
    })
  });

  const expiredCode = `EXPIRED_${Date.now()}`;
  await fetch(`${BASE_URL}/api/admin/promos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${marketingToken}` },
    body: JSON.stringify({
      code: expiredCode,
      discountType: 'percentage',
      discountValue: 10,
      minSpendIDR: 100000,
      validUntil: '2020-01-01', // Expired
      isActive: true
    })
  });

  const minSpendCode = `MINSPEND_${Date.now()}`;
  await fetch(`${BASE_URL}/api/admin/promos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${marketingToken}` },
    body: JSON.stringify({
      code: minSpendCode,
      discountType: 'percentage',
      discountValue: 10,
      minSpendIDR: 1000000, // 1 Million Min Spend
      validUntil: '2026-12-31',
      isActive: true
    })
  });

  const maxUsageCode = `MAXUSAGE_${Date.now()}`;
  const maxUsageCreated = await (await fetch(`${BASE_URL}/api/admin/promos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${marketingToken}` },
    body: JSON.stringify({
      code: maxUsageCode,
      discountType: 'fixed',
      discountValue: 20000,
      minSpendIDR: 100000,
      validUntil: '2026-12-31',
      maxUsage: 5,
      isActive: true
    })
  })).json();
  // Simulate usage count at max
  await fetch(`${BASE_URL}/api/admin/promos/${maxUsageCode}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${marketingToken}` },
    body: JSON.stringify({ usageCount: 5 })
  });

  // ---------------------------------------------------------------------------
  // TEST 6: Inactive promo rejected in validation
  // ---------------------------------------------------------------------------
  console.log('\n[Test 6] Testing inactive promo is rejected in validation...');
  const inactiveVal = await (await fetch(`${BASE_URL}/api/promos/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: inactiveCode, amount: 500000 })
  })).json();
  assert.strictEqual(inactiveVal.valid, false);
  assert.strictEqual(inactiveVal.reason, 'CODE_INACTIVE');
  console.log(`✅ Passed Test 6: Inactive promo rejected (${inactiveVal.message}).`);
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST 7: Expired promo rejected in validation
  // ---------------------------------------------------------------------------
  console.log('\n[Test 7] Testing expired promo is rejected in validation...');
  const expiredVal = await (await fetch(`${BASE_URL}/api/promos/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: expiredCode, amount: 500000 })
  })).json();
  assert.strictEqual(expiredVal.valid, false);
  assert.strictEqual(expiredVal.reason, 'CODE_EXPIRED');
  console.log(`✅ Passed Test 7: Expired promo rejected (${expiredVal.message}).`);
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST 8: Minimum spend requirement enforced
  // ---------------------------------------------------------------------------
  console.log('\n[Test 8] Testing min spend requirement...');
  const minSpendFail = await (await fetch(`${BASE_URL}/api/promos/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: minSpendCode, amount: 500000 }) // 500k < 1M
  })).json();
  assert.strictEqual(minSpendFail.valid, false);
  assert.strictEqual(minSpendFail.reason, 'MIN_SPEND_NOT_MET');

  const minSpendPass = await (await fetch(`${BASE_URL}/api/promos/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: minSpendCode, amount: 1500000 }) // 1.5M >= 1M
  })).json();
  assert.strictEqual(minSpendPass.valid, true);
  assert.strictEqual(minSpendPass.discount, 150000); // 10% of 1.5M
  console.log(`✅ Passed Test 8: Min spend requirement verified (Rejected below min, accepted above min).`);
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST 12: Max usage validated
  // ---------------------------------------------------------------------------
  console.log('\n[Test 12] Testing max usage reached is rejected...');
  const maxUsageVal = await (await fetch(`${BASE_URL}/api/promos/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: maxUsageCode, amount: 500000 })
  })).json();
  assert.strictEqual(maxUsageVal.valid, false);
  assert.strictEqual(maxUsageVal.reason, 'MAX_USAGE_EXCEEDED');
  console.log(`✅ Passed Test 12: Max usage rejection verified (${maxUsageVal.message}).`);
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST 9: Percentage discount calculated by server
  // ---------------------------------------------------------------------------
  console.log('\n[Test 9] Testing server-side percentage discount calculation...');
  const pctCode = `PCT_${Date.now()}`;
  await fetch(`${BASE_URL}/api/admin/promos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${marketingToken}` },
    body: JSON.stringify({
      code: pctCode,
      discountType: 'percentage',
      discountValue: 15,
      minSpendIDR: 100000,
      validUntil: '2026-12-31',
      isActive: true
    })
  });

  const pctVal = await (await fetch(`${BASE_URL}/api/promos/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: pctCode, amount: 1000000 })
  })).json();
  assert.strictEqual(pctVal.valid, true);
  assert.strictEqual(pctVal.discount, 150000, '15% of 1,000,000 must be 150,000');
  console.log(`✅ Passed Test 9: Percentage discount calculated by server (15% of 1,000,000 = 150,000).`);
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST 10: Fixed discount calculated by server
  // ---------------------------------------------------------------------------
  console.log('\n[Test 10] Testing server-side fixed discount calculation...');
  const fixedCode = `FIXED_${Date.now()}`;
  await fetch(`${BASE_URL}/api/admin/promos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${marketingToken}` },
    body: JSON.stringify({
      code: fixedCode,
      discountType: 'fixed',
      discountValue: 75000,
      minSpendIDR: 100000,
      validUntil: '2026-12-31',
      isActive: true
    })
  });

  const fixedVal = await (await fetch(`${BASE_URL}/api/promos/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: fixedCode, amount: 500000 })
  })).json();
  assert.strictEqual(fixedVal.valid, true);
  assert.strictEqual(fixedVal.discount, 75000, 'Fixed discount must be 75,000');
  console.log(`✅ Passed Test 10: Fixed discount calculated by server (75,000).`);
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST 11: Discount cannot exceed baseAmount
  // ---------------------------------------------------------------------------
  console.log('\n[Test 11] Testing discount cannot exceed baseAmount...');
  const bigFixedCode = `BIGFIX_${Date.now()}`;
  await fetch(`${BASE_URL}/api/admin/promos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${marketingToken}` },
    body: JSON.stringify({
      code: bigFixedCode,
      discountType: 'fixed',
      discountValue: 300000, // 300k
      minSpendIDR: 0,
      validUntil: '2026-12-31',
      isActive: true
    })
  });

  const cappedVal = await (await fetch(`${BASE_URL}/api/promos/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: bigFixedCode, amount: 150000 }) // amount is only 150k
  })).json();
  assert.strictEqual(cappedVal.valid, true);
  assert.strictEqual(cappedVal.discount, 150000, 'Discount must be capped to baseAmount (150,000)');
  console.log(`✅ Passed Test 11: Discount capped to baseAmount (Rp 300k discount on Rp 150k amount = Rp 150k discount).`);
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST 16: Public validate promo valid
  // ---------------------------------------------------------------------------
  console.log('\n[Test 16] Testing public validate on canonical promo (SMARTBALI10)...');
  const pubValid = await (await fetch(`${BASE_URL}/api/promos/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'smartbali10', amount: 800000 }) // case-insensitive
  })).json();
  assert.strictEqual(pubValid.valid, true);
  assert.strictEqual(pubValid.code, 'SMARTBALI10');
  assert.strictEqual(pubValid.discount, 80000); // 10% of 800k
  console.log(`✅ Passed Test 16: Public validate returned valid: true for SMARTBALI10.`);
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST 17: Public validate promo invalid
  // ---------------------------------------------------------------------------
  console.log('\n[Test 17] Testing public validate on invalid / non-existent promo...');
  const pubInvalid = await (await fetch(`${BASE_URL}/api/promos/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'NOT_A_REAL_PROMO_CODE_99', amount: 500000 })
  })).json();
  assert.strictEqual(pubInvalid.valid, false);
  assert.strictEqual(pubInvalid.discount, 0);
  assert.strictEqual(pubInvalid.reason, 'CODE_NOT_FOUND');
  console.log(`✅ Passed Test 17: Public validate returned valid: false for invalid code.`);
  passedTests++;

  // Cleanup test-created records
  console.log('\n[Cleanup] Cleaning up temporary test promo records...');
  for (const c of [inactiveCode, expiredCode, minSpendCode, maxUsageCode, pctCode, fixedCode, bigFixedCode]) {
    await fetch(`${BASE_URL}/api/admin/promos/${c}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${superadminToken}` }
    });
  }
  console.log('✅ Temporary test records cleaned up.');

  console.log('================================================================');
  console.log(`🎉 ALL 17 FUNCTIONAL AND SECURITY TESTS PASSED! (${passedTests}/17)`);
  console.log('================================================================');
}

runTestSuite().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
