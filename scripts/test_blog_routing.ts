// Automated verification script for Blog Routing & Navigation Foundation
// Tests:
// 1. Direct pathname recognition for /blog and /blog/ -> activePage='blog', slug=undefined
// 2. Direct pathname recognition for /blog/mount-bromo-travel-guide/ -> activePage='blog', slug='mount-bromo-travel-guide'
// 3. Normalization of trailing slash (including query string preservation)
// 4. Safe slug decoding & invalid URL handling (malformed URI sequence, script tags, whitespace, multiple slashes)
// 5. Preservation of existing legacy hash routes (#/tours, #/car-rental, #/airport, #/taxi, #/share-tour, #/event-gathering, #/about)
// 6. Navigation transition between pathname (/blog/...) and hash routes without state conflict
// 7. HTML5 history popstate simulation (browser back and forward)

import { parseBlogPathname } from '../src/AppContext';

interface MockWindow {
  location: {
    pathname: string;
    hash: string;
    search: string;
  };
  history: {
    pushed: string[];
    replaced: string[];
    pushState: (state: any, title: string, url: string) => void;
    replaceState: (state: any, title: string, url: string) => void;
  };
}

function createMockWindow(pathname = '/', hash = '', search = ''): MockWindow {
  const win: MockWindow = {
    location: { pathname, hash, search },
    history: {
      pushed: [],
      replaced: [],
      pushState(_state: any, _title: string, url: string) {
        win.history.pushed.push(url);
        if (url.startsWith('/#/') || url.startsWith('/#')) {
          win.location.pathname = '/';
          win.location.hash = url.substring(1);
        } else if (url.startsWith('#')) {
          win.location.hash = url;
        } else {
          const [p, h] = url.split('#');
          win.location.pathname = p;
          win.location.hash = h ? `#${h}` : '';
        }
      },
      replaceState(_state: any, _title: string, url: string) {
        win.history.replaced.push(url);
        if (url.startsWith('/#/') || url.startsWith('/#')) {
          win.location.pathname = '/';
          win.location.hash = url.substring(1);
        } else if (url.startsWith('#')) {
          win.location.hash = url;
        } else {
          const [p, h] = url.split('#');
          win.location.pathname = p;
          win.location.hash = h ? `#${h}` : '';
        }
      }
    }
  };
  return win;
}

// Emulate handleLocationChange algorithm from AppContext.tsx using parseBlogPathname
function parseLocation(win: MockWindow) {
  const fullHash = win.location.hash || '';
  const pathname = win.location.pathname || '';
  let hash = fullHash.split('?')[0].replace(/^#\/?/, '');

  const isAnchorOnly = hash === 'main-content' || hash === '' || fullHash === '#' || fullHash === '#main-content';

  const blogInfo = parseBlogPathname(pathname);
  const isBlogHash = hash === 'blog' || hash.startsWith('blog/');

  let activePage = 'home';
  let selectedArticleSlug: string | undefined = undefined;
  let normalizedPath: string | undefined = undefined;

  if (blogInfo.isBlog && (!hash || isBlogHash || isAnchorOnly)) {
    activePage = 'blog';
    let articleSlug = blogInfo.slug || '';

    if (!articleSlug && win.location.search) {
      const sp = new URLSearchParams(win.location.search);
      const q = sp.get('slug') || sp.get('article');
      if (q) articleSlug = decodeURIComponent(q).trim();
    }

    if (articleSlug) {
      selectedArticleSlug = articleSlug;
    }

    const canonicalBlogPath = articleSlug
      ? `/blog/${encodeURIComponent(articleSlug)}/`
      : '/blog/';

    normalizedPath = canonicalBlogPath;
    return { activePage, selectedArticleSlug, normalizedPath };
  }

  if (isBlogHash) {
    activePage = 'blog';
    let articleSlug = '';
    if (hash.startsWith('blog/')) {
      const hashSegments = hash.split('/');
      if (hashSegments.length > 1 && hashSegments[1]) {
        try {
          articleSlug = decodeURIComponent(hashSegments[1]).trim();
        } catch {
          articleSlug = hashSegments[1].trim();
        }
      }
    }
    if (articleSlug) selectedArticleSlug = articleSlug;
    return { activePage, selectedArticleSlug, normalizedPath: undefined };
  }

  if (!hash && pathname && pathname !== '/') {
    hash = pathname.replace(/^\/+|\/+$/g, '');
  }
  if (hash === 'rental') hash = 'car-rental';

  const validPages = ['home', 'tours', 'share-tour', 'event-gathering', 'airport', 'taxi', 'partnerships', 'contact', 'bookings', 'car-rental', 'about', 'admin', 'blog'];
  if (validPages.includes(hash)) {
    activePage = hash;
  } else if (hash === '') {
    activePage = 'home';
  }

  return { activePage, selectedArticleSlug, normalizedPath: undefined };
}

// Run test cases
let passed = 0;
let failed = 0;

function assert(description: string, condition: boolean, extraInfo?: any) {
  if (condition) {
    console.log(`  ✓ PASS: ${description}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${description}`, extraInfo || '');
    failed++;
  }
}

console.log('--- TEST 1: Direct Pathname Access for Blog Index ---');
{
  const w1 = createMockWindow('/blog', '');
  const r1 = parseLocation(w1);
  assert('/blog recognized as activePage: blog', r1.activePage === 'blog');
  assert('/blog has selectedArticleSlug undefined', r1.selectedArticleSlug === undefined);
  assert('/blog trailing slash normalized to /blog/', r1.normalizedPath === '/blog/');

  const w2 = createMockWindow('/blog/', '');
  const r2 = parseLocation(w2);
  assert('/blog/ recognized as activePage: blog', r2.activePage === 'blog');
  assert('/blog/ has selectedArticleSlug undefined', r2.selectedArticleSlug === undefined);
  assert('/blog/ normalized to /blog/', r2.normalizedPath === '/blog/');

  const w3 = createMockWindow('/blog//', '');
  const r3 = parseLocation(w3);
  assert('/blog// extra slashes recognized as blog index', r3.activePage === 'blog' && r3.selectedArticleSlug === undefined);
}

console.log('\n--- TEST 2: Direct Pathname Access for Mount Bromo Article ---');
{
  const w3 = createMockWindow('/blog/mount-bromo-travel-guide/', '');
  const r3 = parseLocation(w3);
  assert('/blog/mount-bromo-travel-guide/ activePage is blog', r3.activePage === 'blog');
  assert('selectedArticleSlug is mount-bromo-travel-guide', r3.selectedArticleSlug === 'mount-bromo-travel-guide');
  assert('Normalized path has trailing slash', r3.normalizedPath === '/blog/mount-bromo-travel-guide/');

  const w4 = createMockWindow('/blog/mount-bromo-travel-guide', '');
  const r4 = parseLocation(w4);
  assert('/blog/mount-bromo-travel-guide without slash extracts slug', r4.selectedArticleSlug === 'mount-bromo-travel-guide');
  assert('Normalizes to trailing slash', r4.normalizedPath === '/blog/mount-bromo-travel-guide/');
}

console.log('\n--- TEST 3: Safe Slug Decoding & Sanitization of Invalid URLs ---');
{
  const w5 = createMockWindow('/blog/tips%20sewa%20mobil%20bromo/', '');
  const r5 = parseLocation(w5);
  assert('Encoded spaces decoded safely', r5.selectedArticleSlug === 'tips sewa mobil bromo');

  const w6 = createMockWindow('/blog/kawah-ijen-blue-fire-guide///', '');
  const r6 = parseLocation(w6);
  assert('Multiple trailing slashes sanitized', r6.selectedArticleSlug === 'kawah-ijen-blue-fire-guide');

  // Test malformed URI sequence that would crash standard decodeURIComponent
  const pMalformed = parseBlogPathname('/blog/%E0%A4%A/');
  assert('Malformed URI does not throw and recovers safely', pMalformed.isBlog === true && typeof pMalformed.slug === 'string');

  // Test XSS attempt sanitization
  const pXss = parseBlogPathname('/blog/<script>alert(1)</script>/');
  assert('Script tags stripped from slug', !pXss.slug?.includes('<') && !pXss.slug?.includes('>'));

  // Test whitespace-only slug falls back to index
  const pWhitespace = parseBlogPathname('/blog/   /');
  assert('Whitespace-only slug treated as index', pWhitespace.isBlog === true && pWhitespace.slug === undefined);
}

console.log('\n--- TEST 4: Preservation of Legacy Hash Routes ---');
{
  const pages = ['tours', 'car-rental', 'airport', 'taxi', 'share-tour', 'event-gathering', 'about', 'partnerships', 'bookings', 'admin'];
  for (const page of pages) {
    const w = createMockWindow('/', `#/${page}`);
    const r = parseLocation(w);
    assert(`Hash route #/${page} resolves to activePage: ${page}`, r.activePage === page);
    assert(`Article slug is not set for #/${page}`, r.selectedArticleSlug === undefined);
  }
}

console.log('\n--- TEST 5: Hash Fallback for Blog (e.g. #/blog and #/blog/:slug) ---');
{
  const w7 = createMockWindow('/', '#/blog');
  const r7 = parseLocation(w7);
  assert('#/blog resolves to activePage: blog', r7.activePage === 'blog');
  assert('#/blog has slug undefined', r7.selectedArticleSlug === undefined);

  const w8 = createMockWindow('/', '#/blog/mount-bromo-travel-guide');
  const r8 = parseLocation(w8);
  assert('#/blog/slug resolves to activePage: blog', r8.activePage === 'blog');
  assert('#/blog/slug has slug mount-bromo-travel-guide', r8.selectedArticleSlug === 'mount-bromo-travel-guide');
}

console.log('\n--- TEST 6: Navigation Transition between Pathname and Hash Routes ---');
{
  // User starts at /blog/mount-bromo-travel-guide/
  const w = createMockWindow('/blog/mount-bromo-travel-guide/', '');
  let r = parseLocation(w);
  assert('Start state is blog detail', r.activePage === 'blog' && r.selectedArticleSlug === 'mount-bromo-travel-guide');

  // User navigates to #/tours via setPage('tours')
  w.history.pushState(null, '', '/#/tours');
  r = parseLocation(w);
  assert('After pushState /#/tours, activePage is tours', r.activePage === 'tours');
  assert('Pathname is reset to / and hash is #/tours', w.location.pathname === '/' && w.location.hash === '#/tours');

  // User navigates to / via setPage('home')
  w.history.pushState(null, '', '/');
  r = parseLocation(w);
  assert('After pushState /, activePage is home', r.activePage === 'home');
  assert('Pathname is / and hash is empty', w.location.pathname === '/' && w.location.hash === '');

  // User navigates to /blog/ via setPage('blog')
  w.history.pushState(null, '', '/blog/');
  r = parseLocation(w);
  assert('After pushState /blog/, activePage is blog', r.activePage === 'blog');
  assert('Pathname is /blog/ and hash is empty', w.location.pathname === '/blog/' && w.location.hash === '');

  // User navigates to /blog/kawah-ijen-blue-fire-guide/
  w.history.pushState(null, '', '/blog/kawah-ijen-blue-fire-guide/');
  r = parseLocation(w);
  assert('ActivePage is blog with kawah-ijen slug', r.activePage === 'blog' && r.selectedArticleSlug === 'kawah-ijen-blue-fire-guide');
}

console.log('\n--- TEST 7: Browser Back/Forward (Popstate) Simulation ---');
{
  const historyStack = ['/blog/', '/blog/mount-bromo-travel-guide/', '/#/tours'];
  let pointer = 2; // currently at /#/tours
  const w = createMockWindow('/', '#/tours');

  // Simulate Back Button
  pointer--;
  const prevUrl = historyStack[pointer];
  const [prevPath, prevHash] = prevUrl.split('#');
  w.location.pathname = prevPath;
  w.location.hash = prevHash ? `#${prevHash}` : '';
  let r = parseLocation(w);
  assert('Popstate back to blog detail restores slug and activePage', r.activePage === 'blog' && r.selectedArticleSlug === 'mount-bromo-travel-guide');

  // Simulate Back Button again to /blog/
  pointer--;
  w.location.pathname = historyStack[pointer];
  w.location.hash = '';
  r = parseLocation(w);
  assert('Popstate back to blog index restores blog activePage without slug', r.activePage === 'blog' && r.selectedArticleSlug === undefined);

  // Simulate Forward Button to detail
  pointer++;
  w.location.pathname = historyStack[pointer];
  w.location.hash = '';
  r = parseLocation(w);
  assert('Popstate forward restores blog detail', r.activePage === 'blog' && r.selectedArticleSlug === 'mount-bromo-travel-guide');
}

console.log(`\n========================================`);
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('ALL ROUTING FOUNDATION TESTS PASSED SUCCESSFULLY!');
}
