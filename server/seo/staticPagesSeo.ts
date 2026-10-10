// ==============================================================================
// SMART JOURNEY SERVER-SIDE STATIC PAGES SEO & CANONICAL INJECTION
// Injects Title, Meta Description, Canonical, OpenGraph, & Twitter Cards
// for all non-blog public routes before JavaScript execution.
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { escapeHtml } from './blogSeo';

const BASE_URL = (process.env.PRODUCTION_URL || 'https://smartjourney.id').replace(/\/+$/, '');

export interface PageSeoConfig {
  canonicalUrl: string;
  title: string;
  description: string;
  keywords?: string;
  ogType?: 'website' | 'article';
  ogImage?: string;
}

export const STATIC_PAGES_SEO: Record<string, PageSeoConfig> = {
  '/': {
    canonicalUrl: `${BASE_URL}/`,
    title: 'Smart Journey | Bromo, Ijen & East Java Private Tours',
    description: 'Smart Journey menyediakan layanan tur privat Bromo, Kawah Ijen, dan Jawa Timur, serta sewa mobil, taksi privat, dan transfer bandara resmi dengan pelayanan profesional.',
    keywords: 'smart journey, paket tour bromo, tour kawah ijen, sewa mobil surabaya, rental hiace malang, transfer bandara juanda, taksi privat jawa timur',
    ogType: 'website',
  },
  '/tours': {
    canonicalUrl: `${BASE_URL}/tours`,
    title: 'Paket Tour Wisata Bromo, Ijen, Malang & Bali | Smart Journey',
    description: 'Pesan paket tour privat Bromo 4x4 Jeep sunrise, Kawah Ijen blue fire, Malang Batu highland, dan Tumpak Sewu dengan jaminan harga terbaik & pengemudi berpengalaman.',
    keywords: 'paket tour bromo sunrise, kawah ijen midnight tour, paket wisata malang batu, tumpaksewu tour, tour bali private, booking tour indonesia',
    ogType: 'website',
  },
  '/rental': {
    canonicalUrl: `${BASE_URL}/car-rental`,
    title: 'Sewa Mobil Surabaya, Malang & Bali (Lepas Kunci & Driver) | Smart Journey',
    description: 'Rental mobil harian Innova Zenix, Avanza, HiAce Commuter, dan Premio dengan kondisi prima, AC dingin, dan harga bersahabat.',
    keywords: 'sewa mobil surabaya, rental hiace malang, rental innova reborn surabaya, sewa hiace premio bali, car rental east java',
    ogType: 'website',
  },
  '/car-rental': {
    canonicalUrl: `${BASE_URL}/car-rental`,
    title: 'Sewa Mobil Surabaya, Malang & Bali (Lepas Kunci & Driver) | Smart Journey',
    description: 'Rental mobil harian Innova Zenix, Avanza, HiAce Commuter, dan Premio dengan kondisi prima, AC dingin, dan harga bersahabat.',
    keywords: 'sewa mobil surabaya, rental hiace malang, rental innova reborn surabaya, sewa hiace premio bali, car rental east java',
    ogType: 'website',
  },
  '/airport': {
    canonicalUrl: `${BASE_URL}/airport`,
    title: 'Layanan Transfer Bandara Surabaya, Bali, Jogja, Jakarta 24 Jam | Smart Journey',
    description: 'Antar jemput bandara Juanda (SUB), Ngurah Rai (DPS), YIA, dan CGK tepat waktu dengan armada ber-AC bersih dan gratis pelacakan delay pesawat.',
    keywords: 'transfer bandara juanda, antar jemput airport surabaya, drop off bandara bali, airport transfer ngurah rai, taksi bandara yia',
    ogType: 'website',
  },
  '/taxi': {
    canonicalUrl: `${BASE_URL}/taxi`,
    title: 'Taksi Privat Antar Kota Surabaya, Malang, Bromo, Banyuwangi, Bali | Smart Journey',
    description: 'Layanan taksi privat antar kota door-to-door dengan harga flat transparan. Bebas repot tanpa gabung penumpang lain, sudah termasuk tol dan BBM.',
    keywords: 'taksi surabaya malang, travel surabaya bromo, drop banyuwangi surabaya, taksi privat antar kota jawa timur, sewa mobil drop off',
    ogType: 'website',
  },
  '/share-tour': {
    canonicalUrl: `${BASE_URL}/share-tour`,
    title: 'Open Trip & Share Tour Bromo Kawah Ijen | Smart Journey',
    description: 'Gabung open trip hemat dan share tour Bromo sunrise, Kawah Ijen blue fire, dan Malang. Berangkat setiap hari dengan fasilitas lengkap dan tour guide profesional.',
    keywords: 'open trip bromo, share tour ijen, open trip kawah ijen, gabung tour bromo murah, open trip malang',
    ogType: 'website',
  },
  '/about': {
    canonicalUrl: `${BASE_URL}/about`,
    title: 'Tentang Kami - PT Sawah Jaya Trans (Smart Journey)',
    description: 'Profil PT Sawah Jaya Trans, legalitas izin pariwisata resmi, visi keselamatan berkendara, dan komitmen layanan prima Smart Journey Indonesia.',
    keywords: 'tentang smart journey, pt sawah jaya trans, legalitas travel jawa timur, profil perusahaan tour malang',
    ogType: 'website',
  },
  '/bookings': {
    canonicalUrl: `${BASE_URL}/bookings`,
    title: 'Cek Status Pesanan & E-Voucher | Smart Journey',
    description: 'Pantau status pemesanan tur dan transportasi Anda secara real-time, unduh tiket digital dan lakukan pelunasan dengan aman.',
    keywords: 'cek booking smart journey, download voucher tour bromo, status pesanan rental mobil',
    ogType: 'website',
  },
  '/partnerships': {
    canonicalUrl: `${BASE_URL}/partnerships`,
    title: 'Kemitraan Bisnis B2B Travel Agent & Hotel | Smart Journey',
    description: 'Program kerjasama B2B untuk travel agent, hotel concierge, dan korporat dengan komisi menarik dan jaminan alokasi armada prioritas.',
    keywords: 'kemitraan travel agent bromo, b2b tour operator malang, kerjasama hotel surabaya, rental mobil korporat',
    ogType: 'website',
  },
  '/event-gathering': {
    canonicalUrl: `${BASE_URL}/event-gathering`,
    title: 'Paket Event & Gathering Perusahaan Bromo Malang | Smart Journey',
    description: 'Layanan paket corporate gathering, outing kantor, outbound, dan gala dinner di Bromo, Malang, dan Batu dengan manajemen acara profesional.',
    keywords: 'event gathering bromo, outing kantor malang, corporate travel east java, family gathering batu',
    ogType: 'website',
  },
};

export const SUPPORTED_STATIC_PAGE_PATHS = [
  '/',
  '/tours', '/tours/',
  '/rental', '/rental/',
  '/car-rental', '/car-rental/',
  '/airport', '/airport/',
  '/taxi', '/taxi/',
  '/share-tour', '/share-tour/',
  '/about', '/about/',
  '/bookings', '/bookings/',
  '/partnerships', '/partnerships/',
  '/event-gathering', '/event-gathering/'
];

export function getPageSeoForPath(reqPath: string): PageSeoConfig {
  const normalized = reqPath.split('?')[0].replace(/\/+$/, '') || '/';
  if (STATIC_PAGES_SEO[normalized]) {
    return STATIC_PAGES_SEO[normalized];
  }
  if (normalized === '/sharetour') {
    return STATIC_PAGES_SEO['/share-tour'];
  }
  return STATIC_PAGES_SEO['/'];
}

export function injectStaticPageSeo(rawHtml: string, pageSeo: PageSeoConfig): string {
  let html = rawHtml;
  const safeCanonical = escapeHtml(pageSeo.canonicalUrl);
  const safeTitle = escapeHtml(pageSeo.title);
  const safeDesc = escapeHtml(pageSeo.description);

  // 1. Replace Canonical
  html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${safeCanonical}" />`);

  // 2. Replace Title & Meta Title
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${safeTitle}</title>`);
  html = html.replace(/<meta\s+name=["']title["'][^>]*>/i, `<meta name="title" content="${safeTitle}" />`);

  // 3. Replace Description & Keywords
  html = html.replace(/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${safeDesc}" />`);
  if (pageSeo.keywords) {
    const safeKeywords = escapeHtml(pageSeo.keywords);
    html = html.replace(/<meta\s+name=["']keywords["'][^>]*>/i, `<meta name="keywords" content="${safeKeywords}" />`);
  }

  // 4. Replace OpenGraph Tags
  html = html.replace(/<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${safeCanonical}" />`);
  html = html.replace(/<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${safeTitle}" />`);
  html = html.replace(/<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${safeDesc}" />`);
  if (pageSeo.ogType) {
    html = html.replace(/<meta\s+property=["']og:type["'][^>]*>/i, `<meta property="og:type" content="${pageSeo.ogType}" />`);
  }
  if (pageSeo.ogImage) {
    const safeOgImage = escapeHtml(pageSeo.ogImage);
    html = html.replace(/<meta\s+property=["']og:image["'][^>]*>/i, `<meta property="og:image" content="${safeOgImage}" />`);
  }

  // 5. Replace Twitter Cards
  html = html.replace(/<meta\s+name=["']twitter:url["'][^>]*>/i, `<meta name="twitter:url" content="${safeCanonical}" />`);
  html = html.replace(/<meta\s+name=["']twitter:title["'][^>]*>/i, `<meta name="twitter:title" content="${safeTitle}" />`);
  html = html.replace(/<meta\s+name=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${safeDesc}" />`);
  if (pageSeo.ogImage) {
    const safeOgImage = escapeHtml(pageSeo.ogImage);
    html = html.replace(/<meta\s+name=["']twitter:image["'][^>]*>/i, `<meta name="twitter:image" content="${safeOgImage}" />`);
  }

  return html;
}

export function createStaticPagesSeoHandlers(options: {
  projectRoot: string;
  getViteServer?: () => any;
}) {
  const { projectRoot, getViteServer } = options;

  const loadBaseHtml = async (reqUrl: string): Promise<string> => {
    const isProd = process.env.NODE_ENV === 'production';
    if (!isProd) {
      const templatePath = path.join(projectRoot, 'index.html');
      let template = fs.readFileSync(templatePath, 'utf8');
      const vite = getViteServer ? getViteServer() : null;
      if (vite && typeof vite.transformIndexHtml === 'function') {
        template = await vite.transformIndexHtml(reqUrl, template);
      }
      return template;
    }

    const distIndexPath = path.join(projectRoot, 'dist', 'index.html');
    if (fs.existsSync(distIndexPath)) {
      return fs.readFileSync(distIndexPath, 'utf8');
    }
    return fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  };

  const handleStaticPage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const normalizedPath = req.path.replace(/\/+$/, '') || '/';
      if (normalizedPath === '/rental') {
        const queryIdx = (req.originalUrl || req.url).indexOf('?');
        const queryString = queryIdx !== -1 ? (req.originalUrl || req.url).slice(queryIdx) : '';
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.redirect(301, `/car-rental${queryString}`);
      }

      const pageSeo = getPageSeoForPath(req.path);
      const rawHtml = await loadBaseHtml(req.originalUrl || req.url);
      const modifiedHtml = injectStaticPageSeo(rawHtml, pageSeo);

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.status(200).send(modifiedHtml);
    } catch (err) {
      console.error('[StaticSeo] Error rendering static page SEO:', err);
      next(err);
    }
  };

  const handleCatchAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      const isProd = process.env.NODE_ENV === 'production';
      if (isProd) {
        const distIndexPath = path.join(projectRoot, 'dist', 'index.html');
        if (fs.existsSync(distIndexPath)) {
          return res.sendFile(distIndexPath);
        }
      }
      const rawHtml = await loadBaseHtml(req.originalUrl || req.url);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(200).send(rawHtml);
    } catch (err) {
      next(err);
    }
  };

  return {
    handleStaticPage,
    handleCatchAll,
    loadBaseHtml,
  };
}
