// ==============================================================================
// TEST SUITE: MEDIUM-01A ARTICLE DATA LAYER & REST ENDPOINTS
// Verifies all 8 mandatory test points specified in the brief
// ==============================================================================

import { getDB } from '../server/db/pool';
import { articlesRepo } from '../server/db/repositories/articles.repository';
import { BLOG_POSTS } from '../src/blogData';

const BASE_URL = 'http://127.0.0.1:3000';
const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY || 'sawahjaya-secret-prod-2026';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function runTests() {
  console.log('\n--- STARTING MEDIUM-01A ARTICLE DATA LAYER TESTS ---\n');

  // Test 1: Verify 12 articles exist in DB
  console.log('[Test 1] Verifying 12 articles seeded into DB...');
  const countInitial = await articlesRepo.count();
  console.log(`Current article count in DB: ${countInitial}`);
  assert(countInitial === 12, `Expected 12 articles in DB, got ${countInitial}`);

  // Test 2: Idempotency & Server Restart simulation
  console.log('\n[Test 2] Testing idempotency (seed re-run simulation)...');
  const reseedResult = await articlesRepo.seedInitialArticles(BLOG_POSTS);
  console.log(`Reseed result: ${reseedResult.seeded} seeded, ${reseedResult.skipped} skipped, ${reseedResult.total} total`);
  assert(reseedResult.seeded === 0, 'No new articles should be seeded on re-run');
  assert(reseedResult.skipped === 12, 'All 12 articles should be recognized and skipped');
  const countAfterReseed = await articlesRepo.count();
  assert(countAfterReseed === 12, `Article count should remain 12 without duplicates, got ${countAfterReseed}`);

  // Test 3: Public GET /api/articles (only published articles)
  console.log('\n[Test 3] Testing public GET /api/articles...');
  const publicRes = await fetch(`${BASE_URL}/api/articles`);
  assert(publicRes.status === 200, `Expected HTTP 200 from GET /api/articles, got ${publicRes.status}`);
  const publicArticles = await publicRes.json();
  assert(Array.isArray(publicArticles), 'Response should be an array of articles');
  assert(publicArticles.length === 12, `Expected 12 published articles, got ${publicArticles.length}`);
  const allPublished = publicArticles.every((a: any) => a.status === 'published');
  assert(allPublished, 'All returned articles must have status "published"');
  
  // Verify structured data fields and content are intact
  const bromoSample = publicArticles.find((a: any) => a.slug === 'mount-bromo-travel-guide');
  assert(Boolean(bromoSample), 'mount-bromo-travel-guide should be present in public list');
  assert(Array.isArray(bromoSample.faq) && bromoSample.faq.length > 0, 'FAQ structured items must be parsed array');
  assert(Array.isArray(bromoSample.gallery) && bromoSample.gallery.length > 0, 'Gallery items must be parsed array');
  assert(Array.isArray(bromoSample.keywords) && bromoSample.keywords.length > 0, 'Keywords must be parsed array');
  assert(Boolean(bromoSample.seoRequirements && bromoSample.seoRequirements.primaryKeyword), 'SEO requirements must be parsed object');
  assert(Boolean(bromoSample.introduction && bromoSample.introduction.length > 100), 'Introduction content must be preserved');

  // Test 4: Public GET /api/articles/:slug
  console.log('\n[Test 4] Testing public GET /api/articles/:slug...');
  const singleRes = await fetch(`${BASE_URL}/api/articles/mount-bromo-travel-guide`);
  assert(singleRes.status === 200, `Expected HTTP 200 for mount-bromo-travel-guide, got ${singleRes.status}`);
  const singleArticle = await singleRes.json();
  assert(singleArticle.slug === 'mount-bromo-travel-guide', `Expected slug mount-bromo-travel-guide, got ${singleArticle.slug}`);
  assert(singleArticle.title.includes('Mount Bromo'), 'Title must contain Mount Bromo');

  // Test 4b: Non-existent slug returns 404
  const notFoundRes = await fetch(`${BASE_URL}/api/articles/non-existent-article-slug-xyz`);
  assert(notFoundRes.status === 404, `Expected HTTP 404 for non-existent slug, got ${notFoundRes.status}`);

  // Test 4c: Draft article repository filtering
  console.log('\n[Test 4c] Verifying drafts are hidden from published queries in repository...');
  const draftSlug = `test-draft-${Date.now()}`;
  try {
    await articlesRepo.create({
      id: `draft-test-${Date.now()}`,
      slug: draftSlug,
      title: 'Secret Upcoming Tour Draft',
      status: 'draft'
    });
    
    const publishedCheck = await articlesRepo.getBySlug(draftSlug, { publishedOnly: true });
    assert(publishedCheck === null, 'Draft article must return null when publishedOnly is true');

    const internalDraftCheck = await articlesRepo.getBySlug(draftSlug, { publishedOnly: false });
    assert(internalDraftCheck !== null && internalDraftCheck.status === 'draft', 'Draft article must be found when publishedOnly is false');

    const publishedList = await articlesRepo.getAll({ publishedOnly: true });
    assert(publishedList.length === 12, `Published list must still contain only 12 published articles, got ${publishedList.length}`);

    const allList = await articlesRepo.getAll({ publishedOnly: false });
    assert(allList.length === 13, `All list must contain 13 articles including draft, got ${allList.length}`);
  } finally {
    await articlesRepo.delete(draftSlug);
  }

  const cleanCount = await articlesRepo.count();
  assert(cleanCount === 12, `Article count after draft cleanup must be 12, got ${cleanCount}`);

  // Test 5: Admin GET /api/admin/articles RBAC enforcement
  console.log('\n[Test 5] Testing RBAC on GET /api/admin/articles...');

  // 5a. Unauthenticated request -> 401
  const unauthRes = await fetch(`${BASE_URL}/api/admin/articles`);
  assert(unauthRes.status === 401, `Expected HTTP 401 for unauthenticated request, got ${unauthRes.status}`);

  // 5b. Log in as Finance Officer (does NOT have manageCMS permission)
  const financeLoginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@smartjourney.id', password: 'admin123', role: 'Finance Officer' })
  });
  const financeLoginData = await financeLoginRes.json();
  assert(Boolean(financeLoginData.token), 'Finance Officer login should return session token');

  // Request /api/admin/articles with Finance Officer token -> 403 Forbidden
  const forbiddenRes = await fetch(`${BASE_URL}/api/admin/articles`, {
    headers: {
      Authorization: `Bearer ${financeLoginData.token}`
    }
  });
  assert(forbiddenRes.status === 403, `Expected HTTP 403 Forbidden for Finance Officer role, got ${forbiddenRes.status}`);

  // 5c. Log in as Marketing Executive (HAS manageCMS permission) -> 200 OK
  const marketingLoginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@smartjourney.id', password: 'admin123', role: 'Marketing Executive' })
  });
  const marketingLoginData = await marketingLoginRes.json();
  assert(Boolean(marketingLoginData.token), 'Marketing Executive login should return session token');

  const marketingRes = await fetch(`${BASE_URL}/api/admin/articles`, {
    headers: {
      Authorization: `Bearer ${marketingLoginData.token}`
    }
  });
  assert(marketingRes.status === 200, `Expected HTTP 200 for Marketing Executive, got ${marketingRes.status}`);
  const marketingArticles = await marketingRes.json();
  assert(Array.isArray(marketingArticles) && marketingArticles.length === 12, `Admin list should return 12 articles, got ${marketingArticles.length}`);

  // 5d. Log in as Super Administrator (FULL ACCESS) -> 200 OK
  const superAdminLoginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@smartjourney.id', password: 'admin123', role: 'Super Administrator' })
  });
  const superAdminLoginData = await superAdminLoginRes.json();
  assert(Boolean(superAdminLoginData.token), 'Super Admin login should return session token');

  const superAdminRes = await fetch(`${BASE_URL}/api/admin/articles`, {
    headers: {
      Authorization: `Bearer ${superAdminLoginData.token}`
    }
  });
  assert(superAdminRes.status === 200, `Expected HTTP 200 for Super Administrator, got ${superAdminRes.status}`);

  const finalCount = await articlesRepo.count();
  assert(finalCount === 12, `Final article count in database must be 12, got ${finalCount}`);

  console.log('\n======================================================');
  console.log('🎉 ALL 5 BACKEND DATA LAYER & API TESTS PASSED! 🎉');
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ Test execution failed with error:', err);
  process.exit(1);
});
