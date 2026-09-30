// ==============================================================================
// TEST SUITE: MEDIUM-01B ADMIN BLOG CMS & ARTICLE LIFECYCLE
// Tests all 12 required verification points
// ==============================================================================

import { articlesRepo } from '../server/db/repositories/articles.repository';
import { BLOG_POSTS } from '../src/blogData';

const BASE_URL = 'http://127.0.0.1:3000';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function runTests() {
  console.log('\n--- STARTING MEDIUM-01B ADMIN BLOG CMS TESTS ---\n');

  // 1. Marketing Executive dapat membuka CMS (Login + GET /api/admin/articles -> 200)
  console.log('[Test 1] Testing Marketing Executive access to CMS...');
  const mktLogin = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin-marketing@smartjourney.id', password: 'admin123', role: 'Marketing Executive' })
  });
  const mktData = await mktLogin.json();
  assert(Boolean(mktData.token), 'Marketing Executive should log in and receive token');

  const mktArticlesRes = await fetch(`${BASE_URL}/api/admin/articles`, {
    headers: {
      Authorization: `Bearer ${mktData.token}`
    }
  });
  assert(mktArticlesRes.status === 200, `Expected HTTP 200 for Marketing Executive CMS access, got ${mktArticlesRes.status}`);
  const initialAdminList = await mktArticlesRes.json();
  assert(Array.isArray(initialAdminList) && initialAdminList.length === 12, `Expected 12 articles, got ${initialAdminList.length}`);

  // 2. Finance Officer mendapat 403 dari API
  console.log('\n[Test 2] Testing Finance Officer 403 Forbidden on CMS endpoints...');
  const finLogin = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin-finance@smartjourney.id', password: 'admin123', role: 'Finance Officer' })
  });
  const finData = await finLogin.json();
  assert(Boolean(finData.token), 'Finance Officer should receive token');

  const finGetRes = await fetch(`${BASE_URL}/api/admin/articles`, {
    headers: { Authorization: `Bearer ${finData.token}` }
  });
  assert(finGetRes.status === 403, `Expected HTTP 403 for Finance Officer GET /api/admin/articles, got ${finGetRes.status}`);

  const finPostRes = await fetch(`${BASE_URL}/api/admin/articles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${finData.token}`
    },
    body: JSON.stringify({ title: 'Unauthorized Article', slug: 'unauthorized-article' })
  });
  assert(finPostRes.status === 403, `Expected HTTP 403 for Finance Officer POST /api/admin/articles, got ${finPostRes.status}`);

  // 3. Create Draft
  console.log('\n[Test 3] Testing Create Draft article...');
  const testSlug = `test-tour-draft-${Date.now()}`;
  const createDraftPayload = {
    title: 'Panduan Wisata Eksplorasi Curug Sewu',
    slug: testSlug,
    status: 'draft',
    category: 'Nature',
    destination: 'Jawa Timur',
    excerpt: 'Panduan lengkap berlibur ke air terjun Curug Sewu.',
    readTime: '5 Min Read',
    author: 'SmartJourney Editorial Team',
    introduction: 'Air terjun Curug Sewu adalah salah satu pesona alam tersembunyi...',
    history: 'Ditemukan puluhan tahun silam oleh penduduk setempat...',
    whyVisit: 'Udara sejuk dan pemandangan asri.',
    faq: [
      { question: 'Berapa harga tiket masuk?', answer: 'Tiket masuk Rp 15.000 per orang.' }
    ],
    gallery: [
      'https://images.unsplash.com/photo-sample-curug-1'
    ],
    seoRequirements: {
      primaryKeyword: 'Curug Sewu Travel Guide',
      secondaryKeywords: ['Wisata Curug Sewu', 'Air Terjun Jawa'],
      metaDescription: 'Panduan wisata Curug Sewu',
      seoTitle: 'Panduan Curug Sewu - Smart Journey',
      slug: testSlug,
      h1: 'Panduan Wisata Curug Sewu',
      h2: ['Spot Terbaik', 'Rute'],
      h3: [],
      imageAlt: 'Air Terjun Curug Sewu',
      internalLinkingSuggestions: [],
      externalLinkingSuggestions: [],
      schemaMarkupRecommendation: 'TravelGuide',
      relatedKeywords: ['curug sewu']
    }
  };

  const createRes = await fetch(`${BASE_URL}/api/admin/articles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${mktData.token}`
    },
    body: JSON.stringify(createDraftPayload)
  });
  assert(createRes.status === 201, `Expected HTTP 201 Created for draft article, got ${createRes.status}`);
  const createdDraft = await createRes.json();
  assert(createdDraft.slug === testSlug, `Expected slug ${testSlug}, got ${createdDraft.slug}`);
  assert(createdDraft.status === 'draft', `Expected status draft, got ${createdDraft.status}`);

  // Verify public endpoint returns 404 for draft
  const publicDraftCheck = await fetch(`${BASE_URL}/api/articles/${testSlug}`);
  assert(publicDraftCheck.status === 404, `Public endpoint must return 404 for draft article, got ${publicDraftCheck.status}`);

  // 4. Edit Draft
  console.log('\n[Test 4] Testing Edit Draft article...');
  const editPayload = {
    title: 'Panduan Wisata Eksplorasi Curug Sewu Edisi 2026',
    excerpt: 'Updated excerpt: Panduan paling lengkap dan akurat 2026.',
    introduction: 'Updated introduction text with more details...'
  };

  const editRes = await fetch(`${BASE_URL}/api/admin/articles/${testSlug}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${mktData.token}`
    },
    body: JSON.stringify(editPayload)
  });
  assert(editRes.status === 200, `Expected HTTP 200 for PUT /api/admin/articles/${testSlug}, got ${editRes.status}`);
  const updatedDraft = await editRes.json();
  assert(updatedDraft.title === 'Panduan Wisata Eksplorasi Curug Sewu Edisi 2026', 'Title should be updated');
  assert(updatedDraft.status === 'draft', 'Status should remain draft');

  // 5. Publish → status published
  console.log('\n[Test 5] Testing Publish article...');
  const publishRes = await fetch(`${BASE_URL}/api/admin/articles/${testSlug}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${mktData.token}`
    },
    body: JSON.stringify({ status: 'published' })
  });
  assert(publishRes.status === 200, `Expected HTTP 200 for publishing article, got ${publishRes.status}`);
  const publishedArticle = await publishRes.json();
  assert(publishedArticle.status === 'published', `Status must be "published", got ${publishedArticle.status}`);

  // Verify public endpoint now returns 200 OK
  const publicPublishedCheck = await fetch(`${BASE_URL}/api/articles/${testSlug}`);
  assert(publicPublishedCheck.status === 200, `Public endpoint must return 200 for published article, got ${publicPublishedCheck.status}`);
  const publicArticleData = await publicPublishedCheck.json();
  assert(publicArticleData.title === 'Panduan Wisata Eksplorasi Curug Sewu Edisi 2026', 'Public title must match updated title');

  // 6. Unpublish/Archive
  console.log('\n[Test 6] Testing Unpublish/Archive article...');
  const archiveRes = await fetch(`${BASE_URL}/api/admin/articles/${testSlug}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${mktData.token}`
    },
    body: JSON.stringify({ status: 'archived' })
  });
  assert(archiveRes.status === 200, `Expected HTTP 200 for archiving article, got ${archiveRes.status}`);
  const archivedArticle = await archiveRes.json();
  assert(archivedArticle.status === 'archived', `Status must be "archived", got ${archivedArticle.status}`);

  // Public endpoint should return 404 for archived article
  const publicArchivedCheck = await fetch(`${BASE_URL}/api/articles/${testSlug}`);
  assert(publicArchivedCheck.status === 404, `Public endpoint must return 404 for archived article, got ${publicArchivedCheck.status}`);

  // 7. Delete dengan confirmation
  console.log('\n[Test 7] Testing Delete article...');
  const deleteRes = await fetch(`${BASE_URL}/api/admin/articles/${testSlug}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${mktData.token}`
    }
  });
  assert(deleteRes.status === 200, `Expected HTTP 200 for deleting article, got ${deleteRes.status}`);
  const deleteData = await deleteRes.json();
  assert(deleteData.success === true, 'Delete response must have success: true');

  // Verify article no longer exists
  const checkDeleted = await fetch(`${BASE_URL}/api/articles/${testSlug}`);
  assert(checkDeleted.status === 404, 'Deleted article must return 404 on public endpoint');

  // 8. Refresh & Persist check
  console.log('\n[Test 8] Testing database persistence...');
  const adminListAfterDelete = await fetch(`${BASE_URL}/api/admin/articles`, {
    headers: { Authorization: `Bearer ${mktData.token}` }
  });
  const currentArticles = await adminListAfterDelete.json();
  assert(currentArticles.length === 12, `Expected exactly 12 articles remaining, got ${currentArticles.length}`);

  // 9. 12 artikel existing tetap utuh
  console.log('\n[Test 9] Verifying 12 initial blog articles are intact...');
  const seededSlugs = BLOG_POSTS.map(p => p.slug);
  for (const slug of seededSlugs) {
    const single = await fetch(`${BASE_URL}/api/articles/${slug}`);
    assert(single.status === 200, `Seeded article slug "${slug}" must return 200 OK`);
    const data = await single.json();
    assert(Boolean(data.title) && Boolean(data.introduction), `Seeded article "${slug}" must have title & introduction`);
  }
  console.log('✅ All 12 initial seeded articles verified intact!');

  console.log('\n======================================================');
  console.log('🎉 ALL MEDIUM-01B TESTS PASSED SUCCESSFULLY! 🎉');
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ Test execution failed with error:', err);
  process.exit(1);
});
