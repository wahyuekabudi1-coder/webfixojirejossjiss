// ==============================================================================
// SMART JOURNEY DYNAMIC XML SITEMAP GENERATOR
// Merges active static website routes + published database articles
// ==============================================================================

import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { articlesRepo } from '../db/repositories/articles.repository';
import { ArticleEntity } from '../db/repositories/articles.repository';

const BASE_URL = (process.env.PRODUCTION_URL || 'https://smartjourney.id').replace(/\/+$/, '');

interface StaticSitemapEntry {
  path: string;
  priority: string;
  changefreq: 'daily' | 'weekly' | 'monthly';
  lastmod?: string;
}

const STATIC_ROUTES: StaticSitemapEntry[] = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/blog/', priority: '0.9', changefreq: 'daily' },
  { path: '/tours', priority: '0.9', changefreq: 'daily' },
  { path: '/share-tour', priority: '0.9', changefreq: 'daily' },
  { path: '/airport', priority: '0.8', changefreq: 'weekly' },
  { path: '/taxi', priority: '0.8', changefreq: 'weekly' },
  { path: '/rental', priority: '0.8', changefreq: 'weekly' },
  { path: '/car-rental', priority: '0.8', changefreq: 'weekly' },
  { path: '/bookings', priority: '0.7', changefreq: 'weekly' },
  { path: '/about', priority: '0.6', changefreq: 'monthly' },
  { path: '/partnerships', priority: '0.6', changefreq: 'monthly' }
];

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatIsoDate(dateStr?: string): string | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  } catch {}
  // Check if string is already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  return null;
}

let cachedSitemapXml: string | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function invalidateSitemapCache(): void {
  cachedSitemapXml = null;
  lastCacheTime = 0;
  console.log('[Sitemap] In-memory sitemap cache invalidated.');
}

export async function generateSitemapXml(): Promise<string> {
  const now = Date.now();
  if (cachedSitemapXml && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedSitemapXml;
  }

  const todayIso = new Date().toISOString().slice(0, 10);

  // 1. Fetch all published articles strictly from database
  let publishedArticles: ArticleEntity[] = [];
  try {
    publishedArticles = await articlesRepo.getAll({ publishedOnly: true });
  } catch (err: any) {
    console.error('[Sitemap Error] Failed to fetch articles from database repository:', err.message);
    throw err;
  }

  // 2. Build XML entries
  const urlEntries: string[] = [];

  // Static routes
  for (const entry of STATIC_ROUTES) {
    const loc = `${BASE_URL}${entry.path}`;
    const lastmod = entry.lastmod || (entry.changefreq === 'daily' ? todayIso : '2026-09-23');
    urlEntries.push(`  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`);
  }

  // Published articles (using canonical clean trailing-slash format)
  for (const article of publishedArticles) {
    if (!article.slug) continue;
    const loc = `${BASE_URL}/blog/${encodeURIComponent(article.slug)}/`;
    const lastmod = formatIsoDate(article.updatedAt) || formatIsoDate(article.createdAt) || todayIso;
    
    urlEntries.push(`  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${urlEntries.join('\n')}
</urlset>`;

  cachedSitemapXml = xml;
  lastCacheTime = now;

  // Persist to public/sitemap.xml and dist/sitemap.xml so reverse-proxy disk cache stays synchronized
  try {
    const publicSitemapPath = path.resolve(process.cwd(), 'public', 'sitemap.xml');
    fs.writeFileSync(publicSitemapPath, xml, 'utf8');
    const distSitemapPath = path.resolve(process.cwd(), 'dist', 'sitemap.xml');
    if (fs.existsSync(path.dirname(distSitemapPath))) {
      fs.writeFileSync(distSitemapPath, xml, 'utf8');
    }
  } catch (fsErr: any) {
    console.warn('[Sitemap Warning] Could not sync to sitemap.xml disk:', fsErr.message);
  }

  return xml;
}

export async function handleSitemapRequest(_req: Request, res: Response): Promise<void> {
  try {
    const xml = await generateSitemapXml();
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=1800');
    res.status(200).send(xml);
  } catch (err: any) {
    console.error('[Sitemap Endpoint Error]:', err);
    res.status(500).type('text/plain').send('Error generating dynamic sitemap.xml');
  }
}
