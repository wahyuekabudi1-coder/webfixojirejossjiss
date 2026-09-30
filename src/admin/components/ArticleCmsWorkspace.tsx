import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText, Plus, Search, Filter, Trash2, Edit3, CheckCircle, 
  Archive, Clock, Calendar, Tag, MapPin, Eye, RefreshCw, AlertCircle, 
  ExternalLink, Save, Globe, X, ChevronRight, HelpCircle, Image as ImageIcon,
  Sparkles, Layers, ListChecks
} from 'lucide-react';
import { getAdminHeaders, handleAdminResponse } from '../../utils/adminAuth';
import type { BlogPost, FAQItem, SEORequirements } from '../../blogData';
import type { ArticleEntity } from '../../../server/db/repositories/articles.repository';

interface ArticleCmsWorkspaceProps {
  theme: any;
  isDark?: boolean;
  triggerToast: (msg: string) => void;
}

type ArticleStatus = 'published' | 'draft' | 'archived';

interface ArticleFormData {
  id?: string;
  title: string;
  slug: string;
  seoTitle: string;
  seoDescription: string;
  category: string;
  destination: string;
  excerpt: string;
  image: string;
  readTime: string;
  date: string;
  author: string;
  keywords: string[];
  featured: boolean;
  heroImagePrompt: string;
  featuredImageAltText: string;
  status: ArticleStatus;

  // Content Sections
  introduction: string;
  history: string;
  whyVisit: string;
  bestTimeToVisit: string;
  topAttractions: string;
  bestActivities: string;
  travelTips: string;
  weather: string;
  transportation: string;
  nearbyAttractions: string;
  foodToTry: string;
  localCulture: string;
  suggestedItinerary: string;
  conclusion: string;
  callToAction: string;

  // Complex lists & SEO
  faq: FAQItem[];
  gallery: string[];
  seoRequirements: SEORequirements;
}

const DEFAULT_FORM: ArticleFormData = {
  title: '',
  slug: '',
  seoTitle: '',
  seoDescription: '',
  category: 'Adventure',
  destination: 'Mount Bromo',
  excerpt: '',
  image: '',
  readTime: '6 Min Read',
  date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
  author: 'SmartJourney Editorial Team',
  keywords: [],
  featured: false,
  heroImagePrompt: '',
  featuredImageAltText: '',
  status: 'draft',
  introduction: '',
  history: '',
  whyVisit: '',
  bestTimeToVisit: '',
  topAttractions: '',
  bestActivities: '',
  travelTips: '',
  weather: '',
  transportation: '',
  nearbyAttractions: '',
  foodToTry: '',
  localCulture: '',
  suggestedItinerary: '',
  conclusion: '',
  callToAction: '',
  faq: [],
  gallery: [],
  seoRequirements: {
    primaryKeyword: '',
    secondaryKeywords: [],
    metaDescription: '',
    seoTitle: '',
    slug: '',
    h1: '',
    h2: [],
    h3: [],
    imageAlt: '',
    internalLinkingSuggestions: [],
    externalLinkingSuggestions: [],
    schemaMarkupRecommendation: '',
    relatedKeywords: []
  }
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function ArticleCmsWorkspace({
  theme,
  isDark = false,
  triggerToast
}: ArticleCmsWorkspaceProps) {
  const [articles, setArticles] = useState<ArticleEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ArticleStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Modal / Editor State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editorTab, setEditorTab] = useState<'basic' | 'content' | 'seo' | 'faq' | 'gallery'>('basic');
  const [formData, setFormData] = useState<ArticleFormData>(DEFAULT_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<ArticleEntity | null>(null);

  // Fetch articles from backend API
  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/articles', {
        headers: getAdminHeaders()
      });
      const data = await handleAdminResponse<ArticleEntity[]>(res, 'Gagal memuat artikel blog.');
      setArticles(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('[Article CMS] Error loading articles:', err);
      setError(err.message || 'Gagal memuat artikel dari database server.');
      triggerToast(err.message || 'Gagal memuat artikel blog');
    } finally {
      setLoading(false);
    }
  }, [triggerToast]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  // Categories list for filter dropdown
  const categories = useMemo(() => {
    const set = new Set<string>();
    articles.forEach(a => {
      if (a.category) set.add(a.category);
    });
    return Array.from(set);
  }, [articles]);

  // Filtered Articles
  const filteredArticles = useMemo(() => {
    return articles.filter(a => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        a.title.toLowerCase().includes(q) ||
        a.slug.toLowerCase().includes(q) ||
        (a.destination && a.destination.toLowerCase().includes(q)) ||
        (a.category && a.category.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (statusFilter !== 'all' && a.status !== statusFilter) {
        return false;
      }

      if (categoryFilter !== 'all' && a.category !== categoryFilter) {
        return false;
      }

      return true;
    });
  }, [articles, searchQuery, statusFilter, categoryFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = articles.length;
    const published = articles.filter(a => a.status === 'published').length;
    const draft = articles.filter(a => a.status === 'draft').length;
    const archived = articles.filter(a => a.status === 'archived').length;
    return { total, published, draft, archived };
  }, [articles]);

  // Open Create Form
  const handleOpenCreate = () => {
    setEditingSlug(null);
    setFormData({
      ...DEFAULT_FORM,
      date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    });
    setEditorTab('basic');
    setIsEditorOpen(true);
  };

  // Open Edit Form
  const handleOpenEdit = (article: ArticleEntity) => {
    setEditingSlug(article.slug);
    setFormData({
      id: article.id,
      title: article.title || '',
      slug: article.slug || '',
      seoTitle: article.seoTitle || article.title || '',
      seoDescription: article.seoDescription || article.excerpt || '',
      category: article.category || 'Adventure',
      destination: article.destination || 'Mount Bromo',
      excerpt: article.excerpt || '',
      image: article.image || '',
      readTime: article.readTime || '6 Min Read',
      date: article.date || '',
      author: article.author || 'SmartJourney Editorial Team',
      keywords: Array.isArray(article.keywords) ? article.keywords : [],
      featured: Boolean(article.featured),
      heroImagePrompt: article.heroImagePrompt || '',
      featuredImageAltText: article.featuredImageAltText || '',
      status: article.status || 'published',
      introduction: article.introduction || '',
      history: article.history || '',
      whyVisit: article.whyVisit || '',
      bestTimeToVisit: article.bestTimeToVisit || '',
      topAttractions: article.topAttractions || '',
      bestActivities: article.bestActivities || '',
      travelTips: article.travelTips || '',
      weather: article.weather || '',
      transportation: article.transportation || '',
      nearbyAttractions: article.nearbyAttractions || '',
      foodToTry: article.foodToTry || '',
      localCulture: article.localCulture || '',
      suggestedItinerary: article.suggestedItinerary || '',
      conclusion: article.conclusion || '',
      callToAction: article.callToAction || '',
      faq: Array.isArray(article.faq) ? article.faq : [],
      gallery: Array.isArray(article.gallery) ? article.gallery : [],
      seoRequirements: article.seoRequirements || {
        primaryKeyword: '',
        secondaryKeywords: [],
        metaDescription: '',
        seoTitle: '',
        slug: article.slug,
        h1: '',
        h2: [],
        h3: [],
        imageAlt: '',
        internalLinkingSuggestions: [],
        externalLinkingSuggestions: [],
        schemaMarkupRecommendation: '',
        relatedKeywords: []
      }
    });
    setEditorTab('basic');
    setIsEditorOpen(true);
  };

  // Save (Draft or Published)
  const handleSave = async (targetStatus?: ArticleStatus) => {
    if (!formData.title.trim()) {
      triggerToast('Judul artikel wajib diisi');
      setEditorTab('basic');
      return;
    }

    const effectiveSlug = formData.slug.trim() ? slugify(formData.slug) : slugify(formData.title);
    if (!effectiveSlug) {
      triggerToast('Slug URL artikel wajib diisi atau dihasilkan dari judul');
      setEditorTab('basic');
      return;
    }

    const finalStatus = targetStatus || formData.status || 'draft';
    const payload = {
      ...formData,
      slug: effectiveSlug,
      status: finalStatus
    };

    setIsSubmitting(true);
    try {
      if (editingSlug) {
        // Update existing article
        const res = await fetch(`/api/admin/articles/${encodeURIComponent(editingSlug)}`, {
          method: 'PUT',
          headers: getAdminHeaders(),
          body: JSON.stringify(payload)
        });
        const updated = await handleAdminResponse<ArticleEntity>(res, 'Gagal memperbarui artikel');
        triggerToast(`Artikel "${updated.title}" berhasil disimpan (${finalStatus})`);
      } else {
        // Create new article
        const res = await fetch('/api/admin/articles', {
          method: 'POST',
          headers: getAdminHeaders(),
          body: JSON.stringify(payload)
        });
        const created = await handleAdminResponse<ArticleEntity>(res, 'Gagal menerbitkan artikel');
        triggerToast(`Artikel "${created.title}" berhasil dibuat (${finalStatus})`);
      }

      setIsEditorOpen(false);
      await fetchArticles();
    } catch (err: any) {
      console.error('[Article CMS Save Error]:', err);
      triggerToast(err.message || 'Gagal menyimpan artikel ke server');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Status Toggle (from Table)
  const handleQuickStatusChange = async (article: ArticleEntity, nextStatus: ArticleStatus) => {
    try {
      const res = await fetch(`/api/admin/articles/${encodeURIComponent(article.slug)}`, {
        method: 'PUT',
        headers: getAdminHeaders(),
        body: JSON.stringify({ status: nextStatus })
      });
      await handleAdminResponse(res, `Gagal mengubah status artikel ke ${nextStatus}`);
      triggerToast(`Status artikel "${article.title}" diubah menjadi ${nextStatus}`);
      await fetchArticles();
    } catch (err: any) {
      triggerToast(err.message || 'Gagal mengubah status artikel');
    }
  };

  // Execute Delete
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/articles/${encodeURIComponent(deleteTarget.slug)}`, {
        method: 'DELETE',
        headers: getAdminHeaders()
      });
      await handleAdminResponse(res, 'Gagal menghapus artikel');
      triggerToast(`Artikel "${deleteTarget.title}" berhasil dihapus.`);
      setDeleteTarget(null);
      await fetchArticles();
    } catch (err: any) {
      triggerToast(err.message || 'Gagal menghapus artikel dari database');
    } finally {
      setIsSubmitting(false);
    }
  };

  // FAQ Item Helpers
  const handleAddFaq = () => {
    setFormData(prev => ({
      ...prev,
      faq: [...prev.faq, { question: '', answer: '' }]
    }));
  };

  const handleUpdateFaq = (index: number, field: 'question' | 'answer', value: string) => {
    setFormData(prev => {
      const updated = [...prev.faq];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, faq: updated };
    });
  };

  const handleRemoveFaq = (index: number) => {
    setFormData(prev => ({
      ...prev,
      faq: prev.faq.filter((_, i) => i !== index)
    }));
  };

  // Gallery Item Helpers
  const handleAddGalleryItem = () => {
    setFormData(prev => ({
      ...prev,
      gallery: [...prev.gallery, '']
    }));
  };

  const handleUpdateGalleryItem = (index: number, val: string) => {
    setFormData(prev => {
      const updated = [...prev.gallery];
      updated[index] = val;
      return { ...prev, gallery: updated };
    });
  };

  const handleRemoveGalleryItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      gallery: prev.gallery.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------- */}
      {/* HEADER & STATISTICS                                                */}
      {/* ------------------------------------------------------------------- */}
      <div className={`${theme.card} border rounded-2xl p-6 space-y-6`}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-neutral-800">
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest font-mono text-amber-500 flex items-center gap-2">
              <FileText className="h-4 w-4 fill-amber-500/20 text-amber-500" />
              <span>Travel Blog &amp; SEO Article Content Engine</span>
            </h4>
            <p className={`text-xs mt-1 ${theme.textSecondary}`}>
              Pusat kelola artikel panduan destinasi Jawa Timur &amp; Bali, schema structured data, meta SEO, dan publikasi blog.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={fetchArticles}
              disabled={loading}
              className={`p-2.5 rounded-xl border border-neutral-800 ${theme.innerCard} hover:bg-neutral-800/60 text-neutral-300 transition cursor-pointer`}
              title="Refresh Data Artikel"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-amber-500' : ''}`} />
            </button>
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-neutral-950 font-black rounded-xl text-xs uppercase tracking-wider transition cursor-pointer shadow-lg shadow-amber-500/10"
            >
              <Plus className="h-4 w-4 stroke-[3]" />
              <span>Tulis Artikel Baru</span>
            </button>
          </div>
        </div>

        {/* Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className={`p-4 rounded-xl border border-neutral-800 ${theme.innerCard}`}>
            <span className="text-[10px] font-bold text-neutral-400 block font-mono uppercase tracking-wider">Total Artikel</span>
            <span className="text-xl font-black text-white font-mono">{stats.total}</span>
          </div>
          <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20">
            <span className="text-[10px] font-bold text-emerald-400 block font-mono uppercase tracking-wider">Published</span>
            <span className="text-xl font-black text-emerald-500 font-mono">{stats.published}</span>
          </div>
          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-950/20">
            <span className="text-[10px] font-bold text-amber-400 block font-mono uppercase tracking-wider">Draft</span>
            <span className="text-xl font-black text-amber-500 font-mono">{stats.draft}</span>
          </div>
          <div className="p-4 rounded-xl border border-neutral-700/50 bg-neutral-900/40">
            <span className="text-[10px] font-bold text-neutral-400 block font-mono uppercase tracking-wider">Archived</span>
            <span className="text-xl font-black text-neutral-300 font-mono">{stats.archived}</span>
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* SEARCH & FILTERS BAR                                             */}
        {/* ----------------------------------------------------------------- */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Cari judul artikel, slug URL, destinasi, atau kategori..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 text-xs rounded-xl ${theme.input} border focus:outline-none focus:border-amber-500`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Tabs */}
            <div className="flex rounded-xl bg-neutral-900 border border-neutral-800 p-0.5 text-xs">
              {(['all', 'published', 'draft', 'archived'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-lg font-bold text-[11px] capitalize transition cursor-pointer ${
                    statusFilter === status 
                      ? 'bg-amber-500 text-neutral-950 font-black shadow-sm' 
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            {/* Category Filter */}
            {categories.length > 0 && (
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className={`text-xs px-3 py-2 rounded-xl ${theme.input} border focus:outline-none focus:border-amber-500 cursor-pointer`}
              >
                <option value="all">Semua Kategori</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* ARTICLES DATA TABLE                                              */}
        {/* ----------------------------------------------------------------- */}
        {error ? (
          <div className="p-6 rounded-xl border border-red-500/30 bg-red-950/20 text-center space-y-3">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
            <p className="text-xs text-red-400 font-mono">{error}</p>
            <button
              onClick={fetchArticles}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Coba Muat Ulang
            </button>
          </div>
        ) : loading ? (
          <div className="py-12 text-center space-y-3">
            <RefreshCw className="h-8 w-8 text-amber-500 animate-spin mx-auto" />
            <p className="text-xs text-neutral-400 font-mono tracking-wider">Memuat database artikel...</p>
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="py-12 text-center space-y-2 border border-dashed border-neutral-800 rounded-xl">
            <FileText className="h-8 w-8 text-neutral-600 mx-auto" />
            <p className="text-sm font-bold text-neutral-300">Tidak ada artikel yang cocok</p>
            <p className="text-xs text-neutral-500">Coba ganti kata kunci pencarian atau filter status.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-900/90 text-neutral-400 font-mono uppercase tracking-wider text-[10px] border-b border-neutral-800">
                <tr>
                  <th className="py-3 px-4">Artikel &amp; SEO Meta</th>
                  <th className="py-3 px-3">Kategori &amp; Destinasi</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Terakhir Diperbarui</th>
                  <th className="py-3 px-4 text-right">Aksi Manajemen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-850">
                {filteredArticles.map(article => {
                  const statusColors = {
                    published: 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30',
                    draft: 'bg-amber-950/40 text-amber-400 border-amber-500/30',
                    archived: 'bg-neutral-800 text-neutral-400 border-neutral-700'
                  }[article.status || 'published'];

                  return (
                    <tr key={article.id || article.slug} className="hover:bg-neutral-850/40 transition">
                      {/* Title & Slug */}
                      <td className="py-3.5 px-4 max-w-md">
                        <div className="space-y-1">
                          <div className="font-bold text-white text-sm line-clamp-1 hover:text-amber-400 transition cursor-pointer" onClick={() => handleOpenEdit(article)}>
                            {article.title}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] font-mono text-neutral-400">
                            <span className="bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800 text-neutral-400 truncate max-w-[200px]" title={article.slug}>
                              /{article.slug}
                            </span>
                            {article.featured && (
                              <span className="text-[10px] font-black uppercase text-amber-500 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-500/30">
                                Featured
                              </span>
                            )}
                          </div>
                          {article.excerpt && (
                            <p className="text-[11px] text-neutral-400 line-clamp-1">
                              {article.excerpt}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Category & Destination */}
                      <td className="py-3.5 px-3">
                        <div className="space-y-1">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-300 font-medium text-[11px]">
                            {article.category || 'Travel Guide'}
                          </span>
                          <div className="text-[11px] text-neutral-400 flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-amber-500 shrink-0" />
                            <span>{article.destination || 'Indonesia'}</span>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase font-mono border ${statusColors}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            article.status === 'published' ? 'bg-emerald-400' :
                            article.status === 'draft' ? 'bg-amber-400' : 'bg-neutral-400'
                          }`} />
                          {article.status || 'published'}
                        </span>
                      </td>

                      {/* Updated At */}
                      <td className="py-3.5 px-3 font-mono text-[11px] text-neutral-400">
                        {article.updatedAt ? new Date(article.updatedAt).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        }) : article.date || '-'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick Publish / Unpublish Toggle */}
                          {article.status !== 'published' ? (
                            <button
                              onClick={() => handleQuickStatusChange(article, 'published')}
                              title="Publikasikan Artikel Sekarang"
                              className="p-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-400 transition cursor-pointer"
                            >
                              <CheckCircle className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleQuickStatusChange(article, 'archived')}
                              title="Arsipkan / Tarik dari Publik"
                              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-400 hover:text-white transition cursor-pointer"
                            >
                              <Archive className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* Edit Button */}
                          <button
                            onClick={() => handleOpenEdit(article)}
                            title="Edit Artikel Lengkap"
                            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-amber-500/20 hover:border-amber-500/40 border border-neutral-700 text-neutral-300 hover:text-amber-400 transition cursor-pointer"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => setDeleteTarget(article)}
                            title="Hapus Artikel"
                            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-red-950/60 hover:border-red-500/40 border border-neutral-700 text-neutral-400 hover:text-red-400 transition cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* ARTICLE EDITOR MODAL (COMPREHENSIVE ALL-FIELDS CMS)                 */}
      {/* =================================================================== */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-neutral-850 flex items-center justify-between bg-neutral-950/60">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-amber-500" />
                <h3 className="text-base font-black text-white font-mono uppercase tracking-wide">
                  {editingSlug ? 'Edit Artikel Blog & SEO' : 'Buat Artikel Blog Baru'}
                </h3>
              </div>
              <button
                onClick={() => setIsEditorOpen(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Tabs Bar */}
            <div className="flex border-b border-neutral-850 px-6 bg-neutral-900 overflow-x-auto no-scrollbar gap-2 text-xs">
              {[
                { id: 'basic', label: '1. Info Utama & Meta', icon: Sparkles },
                { id: 'content', label: '2. Konten Lengkap', icon: Layers },
                { id: 'seo', label: '3. SEO & Structured Data', icon: Globe },
                { id: 'faq', label: `4. FAQ Builder (${formData.faq.length})`, icon: HelpCircle },
                { id: 'gallery', label: `5. Galeri (${formData.gallery.length})`, icon: ImageIcon }
              ].map(t => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setEditorTab(t.id as any)}
                    className={`flex items-center gap-2 py-3 px-3 border-b-2 font-bold transition cursor-pointer whitespace-nowrap ${
                      editorTab === t.id
                        ? 'border-amber-500 text-amber-500 font-extrabold'
                        : 'border-transparent text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Modal Body / Tab Content */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              {/* TAB 1: BASIC INFO */}
              {editorTab === 'basic' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Title */}
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="font-bold text-neutral-300">
                        Judul Artikel <span className="text-amber-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: The Ultimate Mount Bromo Travel Guide..."
                        value={formData.title}
                        onChange={e => {
                          const val = e.target.value;
                          setFormData(prev => ({
                            ...prev,
                            title: val,
                            // Auto generate slug if creating new
                            slug: !editingSlug ? slugify(val) : prev.slug,
                            seoTitle: !prev.seoTitle ? val : prev.seoTitle
                          }));
                        }}
                        className={`w-full p-2.5 rounded-xl ${theme.input} border focus:outline-none focus:border-amber-500`}
                      />
                    </div>

                    {/* Slug */}
                    <div className="space-y-1.5">
                      <label className="font-bold text-neutral-300 flex items-center justify-between">
                        <span>Slug URL <span className="text-amber-500">*</span></span>
                        <span className="text-[10px] text-neutral-500 font-mono">Unique Identifier</span>
                      </label>
                      <input
                        type="text"
                        placeholder="mount-bromo-travel-guide"
                        value={formData.slug}
                        onChange={e => setFormData(prev => ({ ...prev, slug: slugify(e.target.value) }))}
                        className={`w-full p-2.5 rounded-xl ${theme.input} border font-mono focus:outline-none focus:border-amber-500`}
                      />
                    </div>

                    {/* Status Selection */}
                    <div className="space-y-1.5">
                      <label className="font-bold text-neutral-300">Status Publikasi</label>
                      <select
                        value={formData.status}
                        onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as ArticleStatus }))}
                        className={`w-full p-2.5 rounded-xl ${theme.input} border focus:outline-none focus:border-amber-500`}
                      >
                        <option value="draft">Draft (Tersimpan Privat)</option>
                        <option value="published">Published (Tampil di Frontend)</option>
                        <option value="archived">Archived (Diarsipkan)</option>
                      </select>
                    </div>

                    {/* Category */}
                    <div className="space-y-1.5">
                      <label className="font-bold text-neutral-300">Kategori</label>
                      <input
                        type="text"
                        placeholder="Adventure, Culture, Heritage, dll."
                        value={formData.category}
                        onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
                        className={`w-full p-2.5 rounded-xl ${theme.input} border focus:outline-none focus:border-amber-500`}
                      />
                    </div>

                    {/* Destination */}
                    <div className="space-y-1.5">
                      <label className="font-bold text-neutral-300">Destinasi Terkait</label>
                      <input
                        type="text"
                        placeholder="Mount Bromo, Kawah Ijen, Bali, dll."
                        value={formData.destination}
                        onChange={e => setFormData(prev => ({ ...prev, destination: e.target.value }))}
                        className={`w-full p-2.5 rounded-xl ${theme.input} border focus:outline-none focus:border-amber-500`}
                      />
                    </div>

                    {/* Cover Image URL */}
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="font-bold text-neutral-300">Cover Image URL</label>
                      <input
                        type="text"
                        placeholder="https://images.unsplash.com/... atau /bromo.png"
                        value={formData.image}
                        onChange={e => setFormData(prev => ({ ...prev, image: e.target.value }))}
                        className={`w-full p-2.5 rounded-xl ${theme.input} border focus:outline-none focus:border-amber-500`}
                      />
                    </div>

                    {/* Featured Image Alt Text */}
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="font-bold text-neutral-300">Featured Image Alt Text (SEO)</label>
                      <input
                        type="text"
                        placeholder="Deskripsi gambar untuk optimasi SEO search engine"
                        value={formData.featuredImageAltText}
                        onChange={e => setFormData(prev => ({ ...prev, featuredImageAltText: e.target.value }))}
                        className={`w-full p-2.5 rounded-xl ${theme.input} border focus:outline-none focus:border-amber-500`}
                      />
                    </div>

                    {/* Excerpt */}
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="font-bold text-neutral-300">Ringkasan / Excerpt</label>
                      <textarea
                        rows={3}
                        placeholder="Ringkasan singkat artikel yang memikat pembaca..."
                        value={formData.excerpt}
                        onChange={e => setFormData(prev => ({ ...prev, excerpt: e.target.value }))}
                        className={`w-full p-2.5 rounded-xl ${theme.input} border focus:outline-none focus:border-amber-500`}
                      />
                    </div>

                    {/* Author & Read Time */}
                    <div className="space-y-1.5">
                      <label className="font-bold text-neutral-300">Penulis / Author</label>
                      <input
                        type="text"
                        value={formData.author}
                        onChange={e => setFormData(prev => ({ ...prev, author: e.target.value }))}
                        className={`w-full p-2.5 rounded-xl ${theme.input} border focus:outline-none focus:border-amber-500`}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-neutral-300">Estimasi Waktu Baca</label>
                      <input
                        type="text"
                        placeholder="8 Min Read"
                        value={formData.readTime}
                        onChange={e => setFormData(prev => ({ ...prev, readTime: e.target.value }))}
                        className={`w-full p-2.5 rounded-xl ${theme.input} border focus:outline-none focus:border-amber-500`}
                      />
                    </div>

                    {/* Featured Toggle */}
                    <div className="flex items-center gap-2 pt-2 md:col-span-2">
                      <input
                        type="checkbox"
                        id="featured-check"
                        checked={formData.featured}
                        onChange={e => setFormData(prev => ({ ...prev, featured: e.target.checked }))}
                        className="rounded border-neutral-700 text-amber-500 focus:ring-amber-500"
                      />
                      <label htmlFor="featured-check" className="font-bold text-neutral-200 cursor-pointer">
                        Tandai sebagai Featured Article (Prioritas Headline Beranda/Katalog)
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: DETAILED CONTENT SECTIONS */}
              {editorTab === 'content' && (
                <div className="space-y-4">
                  <div className="p-3 bg-amber-950/20 border border-amber-500/20 rounded-xl text-amber-400 text-[11px]">
                    Setiap bagian berikut dipetakan secara terstruktur untuk render layout panduan wisata dan semantic search.
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="font-bold text-neutral-300">1. Pendahuluan / Introduction (Min. 250 kata disarankan)</label>
                      <textarea
                        rows={4}
                        placeholder="Pendahuluan mendalam tentang keindahan dan keunikan destinasi..."
                        value={formData.introduction}
                        onChange={e => setFormData(prev => ({ ...prev, introduction: e.target.value }))}
                        className={`w-full p-2.5 rounded-xl ${theme.input} border focus:outline-none focus:border-amber-500`}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-neutral-300">2. Sejarah &amp; Asal-Usul (History)</label>
                      <textarea
                        rows={4}
                        placeholder="Sejarah geologi, pembentukan kawah, atau latar belakang budaya..."
                        value={formData.history}
                        onChange={e => setFormData(prev => ({ ...prev, history: e.target.value }))}
                        className={`w-full p-2.5 rounded-xl ${theme.input} border focus:outline-none focus:border-amber-500`}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="font-bold text-neutral-300">3. Mengapa Wajib Berkunjung (Why Visit)</label>
                        <textarea
                          rows={3}
                          value={formData.whyVisit}
                          onChange={e => setFormData(prev => ({ ...prev, whyVisit: e.target.value }))}
                          className={`w-full p-2.5 rounded-xl ${theme.input} border focus:outline-none focus:border-amber-500`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="font-bold text-neutral-300">4. Waktu Terbaik Berkunjung (Best Time To Visit)</label>
                        <textarea
                          rows={3}
                          value={formData.bestTimeToVisit}
                          onChange={e => setFormData(prev => ({ ...prev, bestTimeToVisit: e.target.value }))}
                          className={`w-full p-2.5 rounded-xl ${theme.input} border focus:outline-none focus:border-amber-500`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="font-bold text-neutral-300">5. Spot &amp; Atraksi Utama (Top Attractions)</label>
                        <textarea
                          rows={3}
                          value={formData.topAttractions}
                          onChange={e => setFormData(prev => ({ ...prev, topAttractions: e.target.value }))}
                          className={`w-full p-2.5 rounded-xl ${theme.input} border focus:outline-none focus:border-amber-500`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="font-bold text-neutral-300">6. Aktivitas Terbaik (Best Activities)</label>
                        <textarea
                          rows={3}
                          value={formData.bestActivities}
                          onChange={e => setFormData(prev => ({ ...prev, bestActivities: e.target.value }))}
                          className={`w-full p-2.5 rounded-xl ${theme.input} border focus:outline-none focus:border-amber-500`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="font-bold text-neutral-300">7. Tips Perjalanan &amp; Perlengkapan (Travel Tips)</label>
                        <textarea
                          rows={3}
                          value={formData.travelTips}
                          onChange={e => setFormData(prev => ({ ...prev, travelTips: e.target.value }))}
                          className={`w-full p-2.5 rounded-xl ${theme.input} border focus:outline-none focus:border-amber-500`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="font-bold text-neutral-300">8. Cuaca &amp; Suhu (Weather)</label>
                        <textarea
                          rows={3}
                          value={formData.weather}
                          onChange={e => setFormData(prev => ({ ...prev, weather: e.target.value }))}
                          className={`w-full p-2.5 rounded-xl ${theme.input} border focus:outline-none focus:border-amber-500`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="font-bold text-neutral-300">9. Akses &amp; Transportasi (Transportation)</label>
                        <textarea
                          rows={3}
                          value={formData.transportation}
                          onChange={e => setFormData(prev => ({ ...prev, transportation: e.target.value }))}
                          className={`w-full p-2.5 rounded-xl ${theme.input} border focus:outline-none focus:border-amber-500`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="font-bold text-neutral-300">10. Rekomendasi Kuliner (Food To Try)</label>
                        <textarea
                          rows={3}
                          value={formData.foodToTry}
                          onChange={e => setFormData(prev => ({ ...prev, foodToTry: e.target.value }))}
                          className={`w-full p-2.5 rounded-xl ${theme.input} border focus:outline-none focus:border-amber-500`}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-neutral-300">11. Saran Itinerary (Suggested Itinerary)</label>
                      <textarea
                        rows={3}
                        value={formData.suggestedItinerary}
                        onChange={e => setFormData(prev => ({ ...prev, suggestedItinerary: e.target.value }))}
                        className={`w-full p-2.5 rounded-xl ${theme.input} border focus:outline-none focus:border-amber-500`}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="font-bold text-neutral-300">12. Kesimpulan (Conclusion)</label>
                        <textarea
                          rows={2}
                          value={formData.conclusion}
                          onChange={e => setFormData(prev => ({ ...prev, conclusion: e.target.value }))}
                          className={`w-full p-2.5 rounded-xl ${theme.input} border focus:outline-none focus:border-amber-500`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="font-bold text-neutral-300">13. Ajakan Bertindak (Call To Action)</label>
                        <textarea
                          rows={2}
                          value={formData.callToAction}
                          onChange={e => setFormData(prev => ({ ...prev, callToAction: e.target.value }))}
                          className={`w-full p-2.5 rounded-xl ${theme.input} border focus:outline-none focus:border-amber-500`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: SEO STRUCTURED DATA */}
              {editorTab === 'seo' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="font-bold text-neutral-300">SEO Meta Title (Maks 60 karakter)</label>
                      <input
                        type="text"
                        placeholder="Judul khusus untuk Google Search SERP..."
                        value={formData.seoTitle}
                        onChange={e => setFormData(prev => ({ ...prev, seoTitle: e.target.value }))}
                        className={`w-full p-2.5 rounded-xl ${theme.input} border focus:outline-none focus:border-amber-500`}
                      />
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <label className="font-bold text-neutral-300">SEO Meta Description (Maks 160 karakter)</label>
                      <textarea
                        rows={2}
                        placeholder="Deskripsi cuplikan Google SERP yang mendongkrak CTR..."
                        value={formData.seoDescription}
                        onChange={e => setFormData(prev => ({ ...prev, seoDescription: e.target.value }))}
                        className={`w-full p-2.5 rounded-xl ${theme.input} border focus:outline-none focus:border-amber-500`}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-neutral-300">Kata Kunci Utama (Primary Keyword)</label>
                      <input
                        type="text"
                        placeholder="Contoh: Mount Bromo Travel Guide"
                        value={formData.seoRequirements?.primaryKeyword || ''}
                        onChange={e => setFormData(prev => ({
                          ...prev,
                          seoRequirements: { ...prev.seoRequirements, primaryKeyword: e.target.value }
                        }))}
                        className={`w-full p-2.5 rounded-xl ${theme.input} border focus:outline-none focus:border-amber-500`}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-neutral-300">Heading 1 (H1 Tag)</label>
                      <input
                        type="text"
                        placeholder="H1 Page Heading"
                        value={formData.seoRequirements?.h1 || ''}
                        onChange={e => setFormData(prev => ({
                          ...prev,
                          seoRequirements: { ...prev.seoRequirements, h1: e.target.value }
                        }))}
                        className={`w-full p-2.5 rounded-xl ${theme.input} border focus:outline-none focus:border-amber-500`}
                      />
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <label className="font-bold text-neutral-300">
                        Keywords / Tags (Pisahkan dengan koma)
                      </label>
                      <input
                        type="text"
                        placeholder="Mount Bromo, Bromo Sunrise Tour, Tengger Caldera, ..."
                        value={Array.isArray(formData.keywords) ? formData.keywords.join(', ') : ''}
                        onChange={e => {
                          const tags = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                          setFormData(prev => ({ ...prev, keywords: tags }));
                        }}
                        className={`w-full p-2.5 rounded-xl ${theme.input} border focus:outline-none focus:border-amber-500`}
                      />
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <label className="font-bold text-neutral-300">Schema Markup Recommendation</label>
                      <input
                        type="text"
                        placeholder="TravelGuide / Article / FAQPage"
                        value={formData.seoRequirements?.schemaMarkupRecommendation || ''}
                        onChange={e => setFormData(prev => ({
                          ...prev,
                          seoRequirements: { ...prev.seoRequirements, schemaMarkupRecommendation: e.target.value }
                        }))}
                        className={`w-full p-2.5 rounded-xl ${theme.input} border focus:outline-none focus:border-amber-500`}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: FAQ BUILDER */}
              {editorTab === 'faq' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white text-sm">FAQ Structured Data (Google Rich Snippets)</h4>
                      <p className="text-[11px] text-neutral-400">Tanya jawab terstruktur yang otomatis didukung schema FAQPage.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddFaq}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Tambah Pertanyaan</span>
                    </button>
                  </div>

                  {formData.faq.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-neutral-800 rounded-xl space-y-2">
                      <HelpCircle className="h-6 w-6 text-neutral-600 mx-auto" />
                      <p className="text-neutral-400">Belum ada item FAQ.</p>
                      <button
                        type="button"
                        onClick={handleAddFaq}
                        className="text-amber-500 underline text-xs font-bold"
                      >
                        Klik untuk menambahkan pertanyaan pertama
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {formData.faq.map((item, idx) => (
                        <div key={idx} className="p-3.5 rounded-xl border border-neutral-800 bg-neutral-950/40 space-y-2 relative group">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[10px] text-amber-500 font-bold">Q{idx + 1}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveFaq(idx)}
                              className="text-neutral-500 hover:text-red-400 p-1"
                              title="Hapus Pertanyaan Ini"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <input
                            type="text"
                            placeholder="Contoh: Kapan waktu terbaik melihat Blue Fire di Ijen?"
                            value={item.question}
                            onChange={e => handleUpdateFaq(idx, 'question', e.target.value)}
                            className={`w-full p-2 text-xs rounded-lg ${theme.input} border focus:outline-none focus:border-amber-500 font-bold`}
                          />
                          <textarea
                            rows={2}
                            placeholder="Jawaban komprehensif dan akurat..."
                            value={item.answer}
                            onChange={e => handleUpdateFaq(idx, 'answer', e.target.value)}
                            className={`w-full p-2 text-xs rounded-lg ${theme.input} border focus:outline-none focus:border-amber-500`}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: GALLERY PROMPTS / IMAGES */}
              {editorTab === 'gallery' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white text-sm">Galeri Foto &amp; Image Prompts</h4>
                      <p className="text-[11px] text-neutral-400">Daftar foto pendukung destinasi untuk slider atau galeri artikel.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddGalleryItem}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Tambah Item Galeri</span>
                    </button>
                  </div>

                  {formData.gallery.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-neutral-800 rounded-xl space-y-2">
                      <ImageIcon className="h-6 w-6 text-neutral-600 mx-auto" />
                      <p className="text-neutral-400">Belum ada foto galeri.</p>
                      <button
                        type="button"
                        onClick={handleAddGalleryItem}
                        className="text-amber-500 underline text-xs font-bold"
                      >
                        Tambah URL foto atau prompt galeri
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {formData.gallery.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="font-mono text-neutral-500 text-[10px] w-6 text-right">#{idx + 1}</span>
                          <input
                            type="text"
                            placeholder="URL Gambar atau Prompt Fotografi..."
                            value={item}
                            onChange={e => handleUpdateGalleryItem(idx, e.target.value)}
                            className={`flex-1 p-2 text-xs rounded-lg ${theme.input} border focus:outline-none focus:border-amber-500`}
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveGalleryItem(idx)}
                            className="p-2 text-neutral-500 hover:text-red-400"
                            title="Hapus"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer / Actions */}
            <div className="px-6 py-4 border-t border-neutral-850 flex flex-col sm:flex-row items-center justify-between gap-3 bg-neutral-950/60">
              <div className="flex items-center gap-2 text-neutral-400 text-[11px] font-mono">
                <span>Slug:</span>
                <span className="text-amber-400 font-bold">/{formData.slug || 'untitled'}</span>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl border border-neutral-800 text-neutral-300 hover:bg-neutral-800 text-xs font-bold transition cursor-pointer"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={() => handleSave('draft')}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Draft'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSave('published')}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-neutral-950 text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-amber-500/20"
                >
                  <Globe className="h-3.5 w-3.5" />
                  <span>{isSubmitting ? 'Memproses...' : 'Terbitkan (Publish)'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* DELETE CONFIRMATION MODAL                                          */}
      {/* =================================================================== */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-red-500/30 w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-950/60 border border-red-500/40 flex items-center justify-center mx-auto text-red-500">
              <Trash2 className="h-6 w-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-black text-white font-mono">
                Hapus Artikel Blog?
              </h3>
              <p className="text-xs text-neutral-300 font-bold">
                "{deleteTarget.title}"
              </p>
              <p className="text-[11px] text-neutral-400">
                Tindakan ini akan menghapus data artikel secara permanen dari database SQL backend.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isSubmitting}
                className="flex-1 py-2.5 rounded-xl border border-neutral-800 text-neutral-300 hover:bg-neutral-800 text-xs font-bold transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isSubmitting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black transition cursor-pointer shadow-lg shadow-red-600/30"
              >
                {isSubmitting ? 'Menghapus...' : 'Ya, Hapus Artikel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
