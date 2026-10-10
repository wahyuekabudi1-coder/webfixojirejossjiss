// ==============================================================================
// SMART JOURNEY SERVER-SIDE BLOG SEO & CONTENT PRERENDERING
// Injects Title, Meta Description, Canonical, OpenGraph, Twitter Cards, & JSON-LD
// AND renders full article / catalog editorial HTML directly into <div id="root">
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { articlesRepo, ArticleEntity } from '../db/repositories/articles.repository';
import { toursRepo, TourEntity } from '../db/repositories/tours.repository';
import { renderBlogIndexHtml, renderBlogDetailHtml } from './blogPrerender';

const BASE_URL = (process.env.PRODUCTION_URL || 'https://smartjourney.id').replace(/\/+$/, '');

// In-memory HTML prerender cache for sub-millisecond responses
interface CachedHtmlEntry {
  html: string;
  etag: string;
  timestamp: number;
}
const blogPrerenderCache = new Map<string, CachedHtmlEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes fresh TTL

/**
 * Invalidate HTML cache for specific slug or entire blog
 * Called whenever an article is created, updated, or deleted via CMS
 */
export function invalidateBlogPrerenderCache(slug?: string): void {
  if (slug) {
    const cleanSlug = slug.trim().toLowerCase();
    blogPrerenderCache.delete(`/blog/${cleanSlug}/`);
    blogPrerenderCache.delete(`/blog/${cleanSlug}`);
  } else {
    blogPrerenderCache.clear();
  }
  // Also always invalidate the index page cache
  blogPrerenderCache.delete('/blog/');
  blogPrerenderCache.delete('/blog');
  console.log(`[BlogPrerender] Cache invalidated for ${slug ? `slug: ${slug}` : 'all blog routes'}`);
}

export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function safeSerializeJson(data: any): string {
  const json = JSON.stringify(data);
  return json
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function toAbsoluteUrl(urlOrPath: string): string {
  if (!urlOrPath) return `${BASE_URL}/logo.png`;
  if (/^https?:\/\//i.test(urlOrPath)) {
    return urlOrPath;
  }
  return `${BASE_URL}/${urlOrPath.replace(/^\/+/, '')}`;
}

export function formatIsoDate(dateStr?: string): string | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
  } catch {}
  return null;
}

export interface SeoMetadataPayload {
  title: string;
  description: string;
  canonicalUrl: string;
  ogType: 'website' | 'article';
  ogImage: string;
  ogImageAlt?: string;
  robots?: string;
  author?: string;
  datePublished?: string;
  dateModified?: string;
  category?: string;
  keywords?: string;
  schemaGraph: object[];
  bodyHtml?: string;
}

export function injectSeoIntoHtml(rawHtml: string, seo: SeoMetadataPayload): string {
  const safeTitle = escapeHtml(seo.title);
  const safeDesc = escapeHtml(seo.description);
  const safeCanonical = escapeHtml(seo.canonicalUrl);
  const safeOgImage = escapeHtml(seo.ogImage);
  const safeOgImageAlt = escapeHtml(seo.ogImageAlt || seo.title);
  const safeRobots = escapeHtml(seo.robots || 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
  const safeSchemaJson = safeSerializeJson({
    '@context': 'https://schema.org',
    '@graph': seo.schemaGraph
  });

  let html = rawHtml;

  // 1. Replace Title & Meta Title
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${safeTitle}</title>`);
  html = html.replace(/<meta\s+name=["']title["'][^>]*>/i, `<meta name="title" content="${safeTitle}" />`);

  // 2. Replace Description & Keywords
  html = html.replace(/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${safeDesc}" />`);
  if (seo.keywords) {
    const safeKeywords = escapeHtml(seo.keywords);
    html = html.replace(/<meta\s+name=["']keywords["'][^>]*>/i, `<meta name="keywords" content="${safeKeywords}" />`);
  }

  // 3. Replace Canonical
  html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${safeCanonical}" />`);

  // 4. Replace Robots
  html = html.replace(/<meta\s+name=["']robots["'][^>]*>/i, `<meta name="robots" content="${safeRobots}" />`);

  // 5. Replace OpenGraph Tags
  html = html.replace(/<meta\s+property=["']og:type["'][^>]*>/i, `<meta property="og:type" content="${seo.ogType}" />`);
  html = html.replace(/<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${safeCanonical}" />`);
  html = html.replace(/<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${safeTitle}" />`);
  html = html.replace(/<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${safeDesc}" />`);
  html = html.replace(/<meta\s+property=["']og:image["'][^>]*>/i, `<meta property="og:image" content="${safeOgImage}" />`);

  // 6. Replace Twitter Cards
  html = html.replace(/<meta\s+name=["']twitter:title["'][^>]*>/i, `<meta name="twitter:title" content="${safeTitle}" />`);
  html = html.replace(/<meta\s+name=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${safeDesc}" />`);
  html = html.replace(/<meta\s+name=["']twitter:image["'][^>]*>/i, `<meta name="twitter:image" content="${safeOgImage}" />`);
  html = html.replace(/<meta\s+name=["']twitter:url["'][^>]*>/i, `<meta name="twitter:url" content="${safeCanonical}" />`);

  // 7. Inject Article OpenGraph Meta if type is article
  if (seo.ogType === 'article') {
    const articleMetaTags: string[] = [];
    articleMetaTags.push(`<meta property="og:image:alt" content="${safeOgImageAlt}" />`);
    if (seo.datePublished) {
      articleMetaTags.push(`<meta property="article:published_time" content="${escapeHtml(seo.datePublished)}" />`);
    }
    if (seo.dateModified) {
      articleMetaTags.push(`<meta property="article:modified_time" content="${escapeHtml(seo.dateModified)}" />`);
    }
    if (seo.author) {
      articleMetaTags.push(`<meta property="article:author" content="${escapeHtml(seo.author)}" />`);
    }
    if (seo.category) {
      articleMetaTags.push(`<meta property="article:section" content="${escapeHtml(seo.category)}" />`);
    }
    
    // Insert article meta tags right after og:image tag
    html = html.replace(/(<meta\s+property=["']og:image["'][^>]*>)/i, `$1\n    ${articleMetaTags.join('\n    ')}`);
  }

  // 8. Replace / Inject JSON-LD Schema
  const schemaReplacement = `<script id="json-ld-seo-schema" type="application/ld+json">\n    ${safeSchemaJson}\n    </script>`;
  if (/<script[^>]*type=["']application\/ld\+json["'][\s\S]*?<\/script>/i.test(html)) {
    html = html.replace(/<script[^>]*type=["']application\/ld\+json["'][\s\S]*?<\/script>/i, schemaReplacement);
  } else {
    html = html.replace('</head>', `    ${schemaReplacement}\n  </head>`);
  }

  // 9. Prerender Content Injection into <div id="root"></div>
  if (seo.bodyHtml) {
    if (/<div\s+id=["']root["']>\s*<\/div>/i.test(html)) {
      html = html.replace(/<div\s+id=["']root["']>\s*<\/div>/i, `<div id="root">${seo.bodyHtml}</div>`);
    } else if (/<div\s+id=["']root["'][^>]*>/i.test(html)) {
      html = html.replace(/(<div\s+id=["']root["'][^>]*>)([\s\S]*?)(<\/div>)/i, `$1${seo.bodyHtml}$3`);
    }
  }

  return html;
}

export function createBlogSeoHandlers(options: {
  projectRoot: string;
  getViteServer?: () => any;
}) {
  const { projectRoot, getViteServer } = options;

  const loadBaseHtml = async (reqUrl: string): Promise<string> => {
    const isProd = process.env.NODE_ENV === 'production';
    if (!isProd) {
      // In dev mode, read root index.html and transform via Vite
      const templatePath = path.join(projectRoot, 'index.html');
      let template = fs.readFileSync(templatePath, 'utf8');
      const vite = getViteServer ? getViteServer() : null;
      if (vite && typeof vite.transformIndexHtml === 'function') {
        template = await vite.transformIndexHtml(reqUrl, template);
      }
      return template;
    }

    // In prod mode, read compiled dist/index.html
    const distIndexPath = path.join(projectRoot, 'dist', 'index.html');
    if (fs.existsSync(distIndexPath)) {
      return fs.readFileSync(distIndexPath, 'utf8');
    }
    // Fallback to root index.html if dist not yet built
    return fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  };

  // 1. Handler for Blog Index: GET /blog/ and GET /blog
  const handleBlogIndex = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cacheKey = '/blog/';
      const now = Date.now();
      const cached = blogPrerenderCache.get(cacheKey);

      if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
        if (req.headers['if-none-match'] === cached.etag) {
          return void res.status(304).end();
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('ETag', cached.etag);
        res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
        return void res.status(200).send(cached.html);
      }

      // Fetch published articles strictly from database
      const articles = await articlesRepo.getAll({ publishedOnly: true });

      const canonicalUrl = `${BASE_URL}/blog/`;
      const title = 'Blog & Panduan Wisata Bromo Bali | Smart Journey';
      const description = 'Kumpulan artikel, tips perjalanan, panduan wisata Gunung Bromo, Kawah Ijen, Malang, dan layanan transportasi Smart Journey Indonesia.';
      const ogImage = `${BASE_URL}/logo.png`;

      const schemaGraph = [
        {
          '@type': 'TravelAgency',
          '@id': `${BASE_URL}/#organization`,
          'name': 'Smart Journey',
          'alternateName': 'Smart Journey Indonesia',
          'legalName': 'PT Sawah Jaya Trans',
          'url': `${BASE_URL}/`,
          'logo': `${BASE_URL}/logo.png`,
          'telephone': '+6285212347289',
          'address': {
            '@type': 'PostalAddress',
            'streetAddress': 'Jl. Puntadewa No. 192, Tumpang',
            'addressLocality': 'Malang',
            'addressRegion': 'Jawa Timur',
            'postalCode': '65156',
            'addressCountry': 'Indonesia'
          }
        },
        {
          '@type': 'Blog',
          '@id': `${BASE_URL}/blog/#blog`,
          'url': canonicalUrl,
          'name': 'Blog & Panduan Wisata Smart Journey',
          'description': description,
          'publisher': {
            '@id': `${BASE_URL}/#organization`
          },
          'inLanguage': 'id'
        },
        {
          '@type': 'BreadcrumbList',
          'itemListElement': [
            {
              '@type': 'ListItem',
              'position': 1,
              'name': 'Beranda',
              'item': `${BASE_URL}/`
            },
            {
              '@type': 'ListItem',
              'position': 2,
              'name': 'Blog Wisata',
              'item': canonicalUrl
            }
          ]
        }
      ];

      // Prerender full blog catalog body HTML
      const bodyHtml = renderBlogIndexHtml({
        articles,
        baseUrl: BASE_URL
      });

      const baseHtml = await loadBaseHtml('/blog/');
      const enrichedHtml = injectSeoIntoHtml(baseHtml, {
        title,
        description,
        canonicalUrl,
        ogType: 'website',
        ogImage,
        schemaGraph,
        bodyHtml
      });

      const etag = `W/"blog-index-${articles.length}-${Date.now().toString(36)}"`;
      blogPrerenderCache.set(cacheKey, {
        html: enrichedHtml,
        etag,
        timestamp: now
      });

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      res.status(200).send(enrichedHtml);
    } catch (err: any) {
      console.error('[Blog SEO Index Handler Error]:', err);
      next(err);
    }
  };

  // 2. Handler for Article Detail: GET /blog/:slug/ and GET /blog/:slug
  const handleBlogDetail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const rawSlug = req.params.slug;
    const cleanSlug = (rawSlug || '').trim();

    // Slug validation: must be non-empty and alphanumeric with hyphens/underscores
    if (!cleanSlug || !/^[a-zA-Z0-9_-]+$/.test(cleanSlug)) {
      try {
        const notFoundHtml = await loadBaseHtml(req.url);
        const enrichedHtml = injectSeoIntoHtml(notFoundHtml, {
          title: 'Artikel Tidak Ditemukan (404) | Smart Journey',
          description: 'Halaman panduan wisata yang Anda cari tidak ditemukan atau telah dipindahkan.',
          canonicalUrl: `${BASE_URL}/blog/`,
          ogType: 'website',
          ogImage: `${BASE_URL}/logo.png`,
          robots: 'noindex, follow',
          schemaGraph: []
        });
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return void res.status(404).send(enrichedHtml);
      } catch {
        return void res.status(404).send('Artikel tidak ditemukan');
      }
    }

    try {
      const cacheKey = `/blog/${cleanSlug.toLowerCase()}/`;
      const now = Date.now();
      const cached = blogPrerenderCache.get(cacheKey);

      if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
        if (req.headers['if-none-match'] === cached.etag) {
          return void res.status(304).end();
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('ETag', cached.etag);
        res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
        return void res.status(200).send(cached.html);
      }

      // Query published article strictly from database
      const article = await articlesRepo.getBySlug(cleanSlug, { publishedOnly: true });

      // If article does not exist or status is not published -> Genuine HTTP 404
      if (!article || article.status !== 'published') {
        const notFoundHtml = await loadBaseHtml(req.url);
        const enrichedHtml = injectSeoIntoHtml(notFoundHtml, {
          title: 'Artikel Tidak Ditemukan (404) | Smart Journey',
          description: 'Halaman panduan wisata yang Anda cari tidak ditemukan atau telah dipindahkan.',
          canonicalUrl: `${BASE_URL}/blog/`,
          ogType: 'website',
          ogImage: `${BASE_URL}/logo.png`,
          robots: 'noindex, follow',
          schemaGraph: []
        });
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return void res.status(404).send(enrichedHtml);
      }

      // Format Article Metadata
      const canonicalUrl = `${BASE_URL}/blog/${encodeURIComponent(article.slug)}/`;
      const title = article.seoTitle 
        ? `${article.seoTitle} | Smart Journey` 
        : `${article.title} | Smart Journey`;
      const description = article.seoDescription || article.excerpt || article.introduction?.slice(0, 160) || '';
      const ogImage = toAbsoluteUrl(article.image || '/logo.png');
      const ogImageAlt = article.featuredImageAltText || article.title;
      const datePublished = formatIsoDate(article.createdAt) || formatIsoDate(article.date) || undefined;
      const dateModified = formatIsoDate(article.updatedAt) || datePublished || undefined;
      const author = article.author || 'Tim Editorial Smart Journey';

      const schemaGraph: any[] = [
        {
          '@type': 'TravelAgency',
          '@id': `${BASE_URL}/#organization`,
          'name': 'Smart Journey',
          'alternateName': 'Smart Journey Indonesia',
          'legalName': 'PT Sawah Jaya Trans',
          'url': `${BASE_URL}/`,
          'logo': `${BASE_URL}/logo.png`
        },
        {
          '@type': 'Article',
          '@id': `${canonicalUrl}#article`,
          'isPartOf': {
            '@id': `${BASE_URL}/blog/#blog`
          },
          'headline': article.title,
          'description': description,
          'image': ogImage,
          ...(datePublished ? { 'datePublished': datePublished } : {}),
          ...(dateModified ? { 'dateModified': dateModified } : {}),
          'author': {
            '@type': 'Organization',
            'name': author,
            'url': `${BASE_URL}/`
          },
          'publisher': {
            '@id': `${BASE_URL}/#organization`
          },
          'mainEntityOfPage': {
            '@type': 'WebPage',
            '@id': canonicalUrl
          },
          'inLanguage': 'id'
        },
        {
          '@type': 'BreadcrumbList',
          'itemListElement': [
            {
              '@type': 'ListItem',
              'position': 1,
              'name': 'Beranda',
              'item': `${BASE_URL}/`
            },
            {
              '@type': 'ListItem',
              'position': 2,
              'name': 'Blog Wisata',
              'item': `${BASE_URL}/blog/`
            },
            {
              '@type': 'ListItem',
              'position': 3,
              'name': article.title,
              'item': canonicalUrl
            }
          ]
        }
      ];

      // Add FAQPage Schema if article has FAQs
      if (Array.isArray(article.faq) && article.faq.length > 0) {
        schemaGraph.push({
          '@type': 'FAQPage',
          '@id': `${canonicalUrl}#faq`,
          'mainEntity': article.faq.map(f => ({
            '@type': 'Question',
            'name': f.question,
            'acceptedAnswer': {
              '@type': 'Answer',
              'text': f.answer
            }
          }))
        });
      }

      const keywords = Array.isArray(article.keywords) && article.keywords.length > 0
        ? article.keywords.join(', ')
        : `${article.title}, paket tour bromo, panduan wisata indonesia, smart journey`;

      // Fetch relevant tour packages for commercial cross-selling prerendering
      let relevantTours: TourEntity[] = [];
      try {
        const allPublishedTours = await toursRepo.getAll({ all: false });
        const dest = (article.destination || '').toLowerCase();
        const articleTitle = (article.title || '').toLowerCase();

        const matches = allPublishedTours.filter((t: TourEntity) => {
          const tName = (t.name || '').toLowerCase();
          const tDesc = (t.description || '').toLowerCase();
          const tCat = (t.category || '').toLowerCase();

          if (dest.includes('bromo') || articleTitle.includes('bromo')) {
            return tName.includes('bromo') || tDesc.includes('bromo');
          }
          if (dest.includes('ijen') || articleTitle.includes('ijen')) {
            return tName.includes('ijen') || tDesc.includes('ijen');
          }
          if (dest.includes('tumpak') || articleTitle.includes('tumpak')) {
            return tName.includes('tumpak') || tName.includes('malang');
          }
          if (dest.includes('bali')) {
            return tName.includes('bali');
          }
          return tCat.includes('adventure') || tCat.includes('nature') || tCat.includes('private');
        });

        relevantTours = (matches.length > 0 ? matches : allPublishedTours).slice(0, 3);
      } catch (tourErr) {
        console.warn('[BlogPrerender] Could not fetch tours for cross-sell:', tourErr);
      }

      // Generate full semantic HTML for article detail
      const bodyHtml = renderBlogDetailHtml({
        article,
        relevantTours,
        baseUrl: BASE_URL
      });

      const baseHtml = await loadBaseHtml(`/blog/${article.slug}/`);
      const enrichedHtml = injectSeoIntoHtml(baseHtml, {
        title,
        description,
        canonicalUrl,
        ogType: 'article',
        ogImage,
        ogImageAlt,
        author,
        datePublished,
        dateModified,
        category: article.category,
        keywords,
        schemaGraph,
        bodyHtml
      });

      const etag = `W/"blog-${article.slug}-${(article.updatedAt || article.createdAt || '').slice(0, 19)}"`;
      blogPrerenderCache.set(cacheKey, {
        html: enrichedHtml,
        etag,
        timestamp: now
      });

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      res.status(200).send(enrichedHtml);
    } catch (err: any) {
      console.error(`[Blog SEO Detail Handler Error for ${cleanSlug}]:`, err);
      next(err);
    }
  };

  return {
    handleBlogIndex,
    handleBlogDetail
  };
}
