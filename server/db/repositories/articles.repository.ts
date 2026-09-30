// ==============================================================================
// SMART JOURNEY ARTICLES REPOSITORY (MEDIUM-01A DATA LAYER)
// Pure Relational SQL implementation (MySQL 8 / SQLite 3) for SEO Blog Articles
// ==============================================================================

import type { BlogPost, FAQItem, SEORequirements } from '../../../src/blogData';
import { DatabaseClient, ArticleRow } from '../types';
import { getDB } from '../pool';

export interface ArticleEntity extends BlogPost {
  status: 'published' | 'draft' | 'archived';
  createdAt: string;
  updatedAt: string;
}

function parseJson<T>(val: any, fallback: T): T {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val !== 'string') return val as T;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

function rowToArticle(row: ArticleRow): ArticleEntity {
  const statusStr = (row.status || 'published').toLowerCase();
  const normalizedStatus = (statusStr === 'published' || statusStr === 'draft' || statusStr === 'archived')
    ? (statusStr as 'published' | 'draft' | 'archived')
    : 'published';

  return {
    id: row.id,
    title: row.title,
    seoTitle: row.seo_title || row.title,
    seoDescription: row.seo_description || row.excerpt || '',
    slug: row.slug,
    category: row.category || 'Travel Guide',
    destination: row.destination || 'Indonesia',
    excerpt: row.excerpt || '',
    image: row.image || '',
    readTime: row.read_time || '5 Min Read',
    date: row.date || '',
    author: row.author || 'SmartJourney Editorial Team',
    keywords: parseJson<string[]>(row.keywords, []),
    featured: Boolean(row.featured),
    heroImagePrompt: row.hero_image_prompt || '',
    featuredImageAltText: row.featured_image_alt_text || '',
    introduction: row.introduction || '',
    history: row.history || '',
    whyVisit: row.why_visit || '',
    bestTimeToVisit: row.best_time_to_visit || '',
    topAttractions: row.top_attractions || '',
    bestActivities: row.best_activities || '',
    travelTips: row.travel_tips || '',
    weather: row.weather || '',
    transportation: row.transportation || '',
    nearbyAttractions: row.nearby_attractions || '',
    foodToTry: row.food_to_try || '',
    localCulture: row.local_culture || '',
    suggestedItinerary: row.suggested_itinerary || '',
    faq: parseJson<FAQItem[]>(row.faq, []),
    conclusion: row.conclusion || '',
    callToAction: row.call_to_action || '',
    gallery: parseJson<string[]>(row.gallery, []),
    seoRequirements: parseJson<SEORequirements>(row.seo_requirements, {
      primaryKeyword: '',
      secondaryKeywords: [],
      metaDescription: '',
      seoTitle: '',
      slug: row.slug,
      h1: '',
      h2: [],
      h3: [],
      imageAlt: '',
      internalLinkingSuggestions: [],
      externalLinkingSuggestions: [],
      schemaMarkupRecommendation: '',
      relatedKeywords: []
    }),
    content: parseJson<{ sectionTitle: string; text: string }[]>(row.content, []),
    status: normalizedStatus,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString()
  };
}

export class ArticlesRepository {
  private async db(): Promise<DatabaseClient> {
    return await getDB();
  }

  async getAll(options: {
    publishedOnly?: boolean;
    status?: string;
    category?: string;
    destination?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<ArticleEntity[]> {
    const client = await this.db();
    let sql = 'SELECT * FROM articles WHERE 1=1';
    const params: any[] = [];

    if (options.publishedOnly) {
      sql += ' AND status = ?';
      params.push('published');
    } else if (options.status) {
      sql += ' AND status = ?';
      params.push(options.status);
    }

    if (options.category) {
      sql += ' AND category = ?';
      params.push(options.category);
    }

    if (options.destination) {
      sql += ' AND destination = ?';
      params.push(options.destination);
    }

    sql += ' ORDER BY created_at DESC';

    if (typeof options.limit === 'number' && options.limit > 0) {
      sql += ' LIMIT ?';
      params.push(options.limit);
      if (typeof options.offset === 'number' && options.offset >= 0) {
        sql += ' OFFSET ?';
        params.push(options.offset);
      }
    }

    const rows = await client.query<ArticleRow>(sql, params);
    return rows.map(rowToArticle);
  }

  async getBySlug(slug: string, options: { publishedOnly?: boolean } = {}): Promise<ArticleEntity | null> {
    const client = await this.db();
    let sql = 'SELECT * FROM articles WHERE slug = ?';
    const params: any[] = [slug];

    if (options.publishedOnly) {
      sql += ' AND status = ?';
      params.push('published');
    }

    sql += ' LIMIT 1';
    const rows = await client.query<ArticleRow>(sql, params);
    if (!rows || rows.length === 0) return null;
    return rowToArticle(rows[0]);
  }

  async getById(id: string): Promise<ArticleEntity | null> {
    const client = await this.db();
    const rows = await client.query<ArticleRow>('SELECT * FROM articles WHERE id = ? LIMIT 1', [id]);
    if (!rows || rows.length === 0) return null;
    return rowToArticle(rows[0]);
  }

  async create(article: Partial<ArticleEntity> & { slug: string; title: string }): Promise<ArticleEntity> {
    const client = await this.db();
    const id = article.id || `article-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const createdAt = article.createdAt || now;
    const updatedAt = article.updatedAt || now;
    const status = article.status || 'published';

    const sql = `
      INSERT INTO articles (
        id, slug, title, seo_title, seo_description, category, destination, excerpt, image,
        read_time, date, author, keywords, featured, hero_image_prompt, featured_image_alt_text,
        introduction, history, why_visit, best_time_to_visit, top_attractions, best_activities,
        travel_tips, weather, transportation, nearby_attractions, food_to_try, local_culture,
        suggested_itinerary, faq, conclusion, call_to_action, gallery, seo_requirements, content,
        status, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?
      )
    `;

    const params = [
      id,
      article.slug,
      article.title,
      article.seoTitle || null,
      article.seoDescription || null,
      article.category || null,
      article.destination || null,
      article.excerpt || null,
      article.image || null,
      article.readTime || null,
      article.date || null,
      article.author || null,
      JSON.stringify(article.keywords || []),
      article.featured ? 1 : 0,
      article.heroImagePrompt || null,
      article.featuredImageAltText || null,
      article.introduction || null,
      article.history || null,
      article.whyVisit || null,
      article.bestTimeToVisit || null,
      article.topAttractions || null,
      article.bestActivities || null,
      article.travelTips || null,
      article.weather || null,
      article.transportation || null,
      article.nearbyAttractions || null,
      article.foodToTry || null,
      article.localCulture || null,
      article.suggestedItinerary || null,
      JSON.stringify(article.faq || []),
      article.conclusion || null,
      article.callToAction || null,
      JSON.stringify(article.gallery || []),
      JSON.stringify(article.seoRequirements || null),
      JSON.stringify(article.content || []),
      status,
      createdAt,
      updatedAt
    ];

    await client.execute(sql, params);
    const created = await this.getBySlug(article.slug, { publishedOnly: false });
    if (!created) {
      throw new Error(`Failed to retrieve newly created article with slug ${article.slug}`);
    }
    return created;
  }

  async update(slug: string, updates: Partial<ArticleEntity>): Promise<ArticleEntity | null> {
    const client = await this.db();
    const existing = await this.getBySlug(slug, { publishedOnly: false });
    if (!existing) return null;

    const setClauses: string[] = [];
    const params: any[] = [];

    const fieldMap: Record<string, string> = {
      title: 'title',
      seoTitle: 'seo_title',
      seoDescription: 'seo_description',
      category: 'category',
      destination: 'destination',
      excerpt: 'excerpt',
      image: 'image',
      readTime: 'read_time',
      date: 'date',
      author: 'author',
      heroImagePrompt: 'hero_image_prompt',
      featuredImageAltText: 'featured_image_alt_text',
      introduction: 'introduction',
      history: 'history',
      whyVisit: 'why_visit',
      bestTimeToVisit: 'best_time_to_visit',
      topAttractions: 'top_attractions',
      bestActivities: 'best_activities',
      travelTips: 'travel_tips',
      weather: 'weather',
      transportation: 'transportation',
      nearbyAttractions: 'nearby_attractions',
      foodToTry: 'food_to_try',
      localCulture: 'local_culture',
      suggestedItinerary: 'suggested_itinerary',
      conclusion: 'conclusion',
      callToAction: 'call_to_action',
      status: 'status'
    };

    for (const [key, col] of Object.entries(fieldMap)) {
      if ((updates as any)[key] !== undefined) {
        setClauses.push(`\`${col}\` = ?`);
        params.push((updates as any)[key]);
      }
    }

    if (updates.featured !== undefined) {
      setClauses.push('`featured` = ?');
      params.push(updates.featured ? 1 : 0);
    }

    if (updates.keywords !== undefined) {
      setClauses.push('`keywords` = ?');
      params.push(JSON.stringify(updates.keywords));
    }

    if (updates.faq !== undefined) {
      setClauses.push('`faq` = ?');
      params.push(JSON.stringify(updates.faq));
    }

    if (updates.gallery !== undefined) {
      setClauses.push('`gallery` = ?');
      params.push(JSON.stringify(updates.gallery));
    }

    if (updates.seoRequirements !== undefined) {
      setClauses.push('`seo_requirements` = ?');
      params.push(JSON.stringify(updates.seoRequirements));
    }

    if (updates.content !== undefined) {
      setClauses.push('`content` = ?');
      params.push(JSON.stringify(updates.content));
    }

    if (updates.slug && updates.slug !== slug) {
      setClauses.push('`slug` = ?');
      params.push(updates.slug);
    }

    setClauses.push('`updated_at` = ?');
    params.push(new Date().toISOString());

    if (setClauses.length === 1) {
      // Only updated_at
      return existing;
    }

    params.push(slug);
    const sql = `UPDATE articles SET ${setClauses.join(', ')} WHERE slug = ?`;
    await client.execute(sql, params);

    const targetSlug = updates.slug || slug;
    return await this.getBySlug(targetSlug, { publishedOnly: false });
  }

  async delete(slug: string): Promise<boolean> {
    const client = await this.db();
    const result = await client.execute('DELETE FROM articles WHERE slug = ?', [slug]);
    return result.affectedRows > 0;
  }

  async count(options: { publishedOnly?: boolean; status?: string } = {}): Promise<number> {
    const client = await this.db();
    let sql = 'SELECT COUNT(*) as total FROM articles WHERE 1=1';
    const params: any[] = [];

    if (options.publishedOnly) {
      sql += ' AND status = ?';
      params.push('published');
    } else if (options.status) {
      sql += ' AND status = ?';
      params.push(options.status);
    }

    const rows = await client.query<{ total: number }>(sql, params);
    return Number(rows[0]?.total) || 0;
  }

  async seedInitialArticles(posts: BlogPost[]): Promise<{ seeded: number; skipped: number; total: number }> {
    let seeded = 0;
    let skipped = 0;

    for (const post of posts) {
      if (!post.slug) continue;
      const existing = await this.getBySlug(post.slug, { publishedOnly: false });
      if (existing) {
        skipped++;
        continue;
      }
      const existingById = await this.getById(post.id);
      if (existingById) {
        skipped++;
        continue;
      }

      let parsedDateIso: string;
      try {
        parsedDateIso = post.date ? new Date(post.date).toISOString() : new Date().toISOString();
        if (isNaN(new Date(parsedDateIso).getTime())) {
          parsedDateIso = new Date().toISOString();
        }
      } catch {
        parsedDateIso = new Date().toISOString();
      }

      await this.create({
        ...post,
        status: 'published',
        createdAt: parsedDateIso,
        updatedAt: new Date().toISOString()
      });
      seeded++;
    }

    return { seeded, skipped, total: posts.length };
  }
}

export const articlesRepo = new ArticlesRepository();
