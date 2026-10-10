import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  ActivePage, Booking, Tour, AirportRoute, Airport, 
  TaxiMasterArea, TaxiMasterDestination, TaxiPricingRule, TaxiAreaRule, TaxiImportHistory,
  OperationalCity, RentalLocation, RentalVehicle, RentalCategory, RentalAddon, ZonePricing,
  Review,
  GoogleReviewsData
} from './types';
import { TOURS, REVIEWS } from './data';
import { EXCHANGE_RATE_USD_TO_IDR, EXCHANGE_RATE_USD_TO_CNY, ENABLE_FOREIGN_CURRENCIES } from './utils/pricingUtils';
import { getAdminHeaders, handleAdminResponse, getAdminToken } from './utils/adminAuth';
import type { BlogPost } from './blogData';

interface AppContextProps {
  activePage: ActivePage;
  setPage: (page: ActivePage, articleSlug?: string) => void;
  navigateToBlog: (slug?: string) => void;
  currency: 'USD' | 'IDR' | 'CNY';
  setCurrency: (currency: 'USD' | 'IDR' | 'CNY') => void;
  isPrivacyOpen: boolean;
  setPrivacyOpen: (open: boolean) => void;
  isTermsOpen: boolean;
  setTermsOpen: (open: boolean) => void;
  isComingSoonOpen: boolean;
  setComingSoonOpen: (open: boolean) => void;
  comingSoonService: 'tours' | 'airport' | 'taxi' | null;
  setComingSoonService: (service: 'tours' | 'airport' | 'taxi' | null) => void;
  bookings: Booking[];
  refreshBookings: () => Promise<void>;
  addBooking: (booking: Omit<Booking, 'id' | 'bookingDate' | 'status'>) => Promise<Booking> | Booking;
  updateBookingStatus: (id: string, status: string, paymentStatus?: string) => Promise<void> | void;
  formatPrice: (usdPrice: number, idrPrice: number) => string;
  tours: Tour[];
  addTour: (tour: Tour) => Promise<void> | void;
  updateTour: (tour: Tour) => Promise<void> | void;
  deleteTour: (id: string) => Promise<void> | void;
  setTourStatus: (id: string, status: 'published' | 'draft' | 'unpublished') => Promise<void> | void;
  refreshTours: () => Promise<void>;
  schedules: any[];
  addSchedule: (schedule: any) => void;
  updateSchedule: (schedule: any) => void;
  deleteSchedule: (id: string) => void;
  logs: any[];
  addLog: (message: string, type?: 'tour' | 'rental' | 'taxi' | 'airport' | 'system') => void;
  searchParams: {
    destination?: string;
    date?: string;
    guests?: number;
    tourType?: string;
    airport?: string;
    pickupLocation?: string;
    pickupTime?: string;
    returnDate?: string;
    vehicleType?: string;
    withDriver?: boolean;
    selectedTourId?: string;
    selectedArticleSlug?: string;
    selectedGatheringPackageId?: string;
  };
  setSearchParams: (params: any) => void;
  activeArticle: BlogPost | null;
  setActiveArticle: React.Dispatch<React.SetStateAction<BlogPost | null>>;
  maxBookingsPerDay: number;
  setMaxBookingsPerDay: (limit: number) => void;
  airportRoutes: AirportRoute[];
  setAirportRoutes: React.Dispatch<React.SetStateAction<AirportRoute[]>>;
  airports: Airport[];
  setAirports: React.Dispatch<React.SetStateAction<Airport[]>>;
  taxiMasterAreas: TaxiMasterArea[];
  setTaxiMasterAreas: React.Dispatch<React.SetStateAction<TaxiMasterArea[]>>;
  taxiMasterDestinations: TaxiMasterDestination[];
  setTaxiMasterDestinations: React.Dispatch<React.SetStateAction<TaxiMasterDestination[]>>;
  taxiPricingRules: TaxiPricingRule[];
  setTaxiPricingRules: React.Dispatch<React.SetStateAction<TaxiPricingRule[]>>;
  taxiAreaRules: TaxiAreaRule[];
  setTaxiAreaRules: React.Dispatch<React.SetStateAction<TaxiAreaRule[]>>;
  taxiImportHistory: TaxiImportHistory[];
  setTaxiImportHistory: React.Dispatch<React.SetStateAction<TaxiImportHistory[]>>;
  rentalCities: OperationalCity[];
  setRentalCities: React.Dispatch<React.SetStateAction<OperationalCity[]>>;
  rentalLocations: RentalLocation[];
  setRentalLocations: React.Dispatch<React.SetStateAction<RentalLocation[]>>;
  rentalVehicles: RentalVehicle[];
  setRentalVehicles: React.Dispatch<React.SetStateAction<RentalVehicle[]>>;
  rentalCategories: RentalCategory[];
  setRentalCategories: React.Dispatch<React.SetStateAction<RentalCategory[]>>;
  rentalAddons: RentalAddon[];
  setRentalAddons: React.Dispatch<React.SetStateAction<RentalAddon[]>>;
  rentalZonePricing: ZonePricing[];
  setRentalZonePricing: React.Dispatch<React.SetStateAction<ZonePricing[]>>;
  serviceLimits: {
    tour: number;
    airport: number;
    taxi: number;
    rental: number;
  };
  setServiceLimit: (type: 'tour' | 'airport' | 'taxi' | 'rental', limit: number) => void;
  reviews: Review[];
  setReviews: React.Dispatch<React.SetStateAction<Review[]>>;
  addReview: (reviewData: Omit<Review, 'id' | 'date'>) => void;
  approveReview: (id: string) => void;
  rejectReview: (id: string) => void;
  googleReviews: GoogleReviewsData | null;
  isLoadingGoogleReviews: boolean;
  refreshGoogleReviews: () => Promise<void>;
}


const AppContext = createContext<AppContextProps | undefined>(undefined);

// Clean Admin State migration: purge legacy dummy seeds
const CLEAN_STATE_KEY = 'sj_clean_state_v1';
if (typeof window !== 'undefined' && localStorage.getItem(CLEAN_STATE_KEY) !== 'true') {
  const dummyKeys = [
    'smartjourney_tours',
    'smartjourney_bookings',
    'smartjourney_reviews',
    'smartjourney_logs',
    'sj_airport_routes',
    'sj_taxi_master_areas',
    'sj_taxi_master_destinations',
    'sj_taxi_pricing_rules',
    'sj_taxi_area_rules',
    'sj_taxi_import_history',
    'sj_rental_cities',
    'sj_rental_locations',
    'sj_rental_categories_v3',
    'sj_rental_vehicles_v3',
    'sj_rental_addons',
    'sj_rental_zone_pricing',
    'sj_promo_coupons',
    'sj_finance_ledger',
    'sj_fleet_vehicles',
    'sj_driver_profiles',
    'sj_tour_guides',
    'sj_customer_profiles',
    'sj_custom_ledger_tours',
    'smartjourney_schedules'
  ];
  dummyKeys.forEach(k => {
    try { localStorage.removeItem(k); } catch(e){}
  });
  try { localStorage.setItem(CLEAN_STATE_KEY, 'true'); } catch(e){}
}

/**
 * Safe parser and normalizer for clean blog pathnames
 * Recognizes /blog, /blog/, /blog/:slug, /blog/:slug/
 * Normalizes trailing slash and safely decodes / sanitizes slugs
 */
export function parseBlogPathname(pathname: string): {
  isBlog: boolean;
  slug?: string;
  canonicalPath?: string;
} {
  const isBlog = pathname === '/blog' || pathname.startsWith('/blog/');
  if (!isBlog) return { isBlog: false };

  const trimmedPath = pathname.replace(/^\/+|\/+$/g, '');
  const pathSegments = trimmedPath ? trimmedPath.split('/').filter(Boolean) : [];
  let articleSlug = '';

  if (pathSegments.length > 1 && pathSegments[1]) {
    try {
      articleSlug = decodeURIComponent(pathSegments[1]).trim();
    } catch {
      articleSlug = pathSegments[1].trim();
    }
    // Sanitize slug: strip XSS/control characters, query/hash residuals, trailing slashes
    articleSlug = articleSlug
      .replace(/[<>"'`\\]/g, '')
      .replace(/[?#].*$/, '')
      .replace(/\/+$/, '')
      .trim();
  }

  const slug = articleSlug || undefined;
  const canonicalPath = slug ? `/blog/${encodeURIComponent(slug)}/` : '/blog/';
  return { isBlog: true, slug, canonicalPath };
}

function getInitialActivePage(): ActivePage {
  if (typeof window === 'undefined') return 'home';
  const pathname = window.location.pathname || '';
  const fullHash = window.location.hash || '';
  const hash = fullHash.split('?')[0].replace(/^#\/?/, '');
  const isAnchorOnly = hash === 'main-content' || hash === '' || fullHash === '#' || fullHash === '#main-content';

  const blogInfo = parseBlogPathname(pathname);
  if (blogInfo.isBlog && (!hash || hash === 'blog' || hash.startsWith('blog/') || isAnchorOnly)) {
    return 'blog';
  }
  if (hash === 'blog' || hash.startsWith('blog/')) {
    return 'blog';
  }
  if (pathname.startsWith('/event-gathering') || hash.startsWith('event-gathering')) {
    return 'event-gathering';
  }
  if (hash.startsWith('trip=') || hash.includes('trip=') || hash.startsWith('share-tour') || hash.startsWith('sharetour') || pathname.startsWith('/share-tour') || pathname.startsWith('/sharetour')) {
    return 'share-tour';
  }
  const cleanPath = pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  if (cleanPath === 'rental' || cleanPath === 'car-rental') {
    return 'car-rental';
  }
  if (cleanPath === 'tours') {
    return 'tours';
  }
  if (cleanPath === 'airport') {
    return 'airport';
  }
  if (cleanPath === 'taxi') {
    return 'taxi';
  }
  if (cleanPath === 'about') {
    return 'about';
  }
  if (cleanPath === 'partnerships') {
    return 'partnerships';
  }
  if (cleanPath === 'bookings') {
    return 'bookings';
  }
  const validPages: ActivePage[] = ['home', 'tours', 'share-tour', 'event-gathering', 'airport', 'taxi', 'partnerships', 'contact', 'bookings', 'car-rental', 'about', 'admin', 'blog'];
  if (validPages.includes(hash as ActivePage)) {
    return hash as ActivePage;
  }
  return 'home';
}

function getInitialSearchParams(): any {
  if (typeof window === 'undefined') return {};
  const pathname = window.location.pathname || '';
  const fullHash = window.location.hash || '';
  const hash = fullHash.split('?')[0].replace(/^#\/?/, '');
  const isAnchorOnly = hash === 'main-content' || hash === '' || fullHash === '#' || fullHash === '#main-content';

  const blogInfo = parseBlogPathname(pathname);
  if (blogInfo.isBlog && (!hash || hash === 'blog' || hash.startsWith('blog/') || isAnchorOnly)) {
    if (blogInfo.slug) {
      return { selectedArticleSlug: blogInfo.slug };
    }
  }
  return {};
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activePage, setActivePageState] = useState<ActivePage>(getInitialActivePage);
  const [currency, setCurrencyState] = useState<'USD' | 'IDR' | 'CNY'>(() => {
    // Tombol mata uang Dolar ($) dan Yen/Yuan (¥) sementara dimatikan (jangan dihapus)
    if (!ENABLE_FOREIGN_CURRENCIES) {
      try { localStorage.setItem('sj_currency', 'IDR'); } catch(e){}
      return 'IDR';
    }
    return (localStorage.getItem('sj_currency') as 'USD' | 'IDR' | 'CNY') || 'IDR';
  });

  const setCurrency = (curr: 'USD' | 'IDR' | 'CNY') => {
    // Jika mata uang asing dimatikan, cegah perubahan ke USD atau CNY
    if (!ENABLE_FOREIGN_CURRENCIES && curr !== 'IDR') {
      return;
    }
    setCurrencyState(curr);
    localStorage.setItem('sj_currency', curr);
  };
  const [isPrivacyOpen, setPrivacyOpen] = useState(false);
  const [isTermsOpen, setTermsOpen] = useState(false);
  const [isComingSoonOpen, setComingSoonOpen] = useState(false);
  const [comingSoonService, setComingSoonService] = useState<'tours' | 'airport' | 'taxi' | null>(null);
  const [maxBookingsPerDay, setMaxBookingsPerDayState] = useState<number>(5);

  const setMaxBookingsPerDay = async (limit: number) => {
    setMaxBookingsPerDayState(limit);
    try {
      await fetch('/api/service-limits', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ tour: limit })
      });
    } catch (e) {
      console.warn('Failed to persist max bookings per day limit:', e);
    }
  };

  const [serviceLimits, setServiceLimits] = useState<{
    tour: number;
    airport: number;
    taxi: number;
    rental: number;
  }>({
    tour: 5,
    airport: 5,
    taxi: 5,
    rental: 5,
  });

  const setServiceLimit = async (type: 'tour' | 'airport' | 'taxi' | 'rental', limit: number) => {
    const updated = { ...serviceLimits, [type]: limit };
    setServiceLimits(updated);
    if (type === 'tour') {
      setMaxBookingsPerDayState(limit);
    }
    try {
      await fetch('/api/service-limits', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify(updated)
      });
    } catch (err) {
      console.error('Failed to persist service limits to server:', err);
    }
  };

  const [reviews, setReviews] = useState<Review[]>(REVIEWS);

  const addReview = async (reviewData: Omit<Review, 'id' | 'date'>) => {
    const today = new Date();
    const formattedDate = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const newReview: Review = {
      ...reviewData,
      id: `rev-${Date.now()}`,
      date: formattedDate,
      status: 'pending'
    };
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newReview)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Gagal menyimpan ulasan ke server.');
      }
      const savedReview = await res.json();
      setReviews(prev => [savedReview || newReview, ...prev]);
      return { success: true, review: savedReview || newReview };
    } catch (err: any) {
      console.error('Failed to persist review to server:', err);
      throw err;
    }
  };

  const approveReview = async (id: string) => {
    setReviews(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' as const } : r));
    try {
      await fetch(`/api/reviews/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        headers: getAdminHeaders(),
        body: JSON.stringify({ status: 'approved' })
      });
    } catch (err) {
      console.error('Failed to update review status on server:', err);
    }
  };

  const rejectReview = async (id: string) => {
    setReviews(prev => prev.filter(r => r.id !== id));
    try {
      await fetch(`/api/reviews/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        headers: getAdminHeaders(),
        body: JSON.stringify({ status: 'rejected' })
      });
    } catch (err) {
      console.error('Failed to update review status on server:', err);
    }
  };

  // Google Places Reviews authoritative server state
  const [googleReviews, setGoogleReviews] = useState<GoogleReviewsData | null>(null);
  const [isLoadingGoogleReviews, setIsLoadingGoogleReviews] = useState<boolean>(true);
  
  // Authoritative server state for bookings - initialized empty, populated exclusively via API
  const [bookings, setBookings] = useState<Booking[]>([]);

  const [searchParams, setSearchParams] = useState<any>(getInitialSearchParams);
  const [activeArticle, setActiveArticle] = useState<BlogPost | null>(null);
  
  // Authoritative server state for Tours - initialized empty, populated exclusively via API
  const [tours, setTours] = useState<Tour[]>([]);

  // Server fetch for Main Website Tours (authoritative source)
  const refreshTours = useCallback(async () => {
    try {
      const adminToken = typeof window !== 'undefined'
        ? (localStorage.getItem('smart_journey_admin_token') || localStorage.getItem('smartjourney_admin_token') || '')
        : '';
      const headers: Record<string, string> = {};
      if (adminToken) {
        headers['Authorization'] = `Bearer ${adminToken}`;
      }
      const url = adminToken ? '/api/main-tours?all=true' : '/api/main-tours';
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          // Authoritative server data: directly set state, no fallback
          setTours(data);
          return;
        } else {
          console.error('[API Error] Server returned non-array for main tours:', data);
        }
      } else if (adminToken && (res.status === 401 || res.status === 403)) {
        // Stale or expired admin token in localStorage must not block customer/public tour visibility
        console.warn(`[Auth Notice] Admin request with ?all=true returned HTTP ${res.status}. Falling back to public published tours.`);
        const pubRes = await fetch('/api/main-tours');
        if (pubRes.ok) {
          const pubData = await pubRes.json();
          if (Array.isArray(pubData)) {
            setTours(pubData);
            return;
          }
        } else {
          console.error(`[API Error] Public tours fallback request failed: HTTP ${pubRes.status}`);
        }
      } else {
        console.error(`[API Error] Failed to fetch tours from server: HTTP ${res.status}`);
        // Do not clear tours state on error
      }
    } catch (err) {
      console.error('[Network Error] Could not fetch tours from server API, preserving existing state:', err);
    }
  }, []);

  // Server fetch for Bookings (authoritative source)
  const refreshBookings = useCallback(async () => {
    const token = getAdminToken();
    if (!token) return;

    try {
      const headers = getAdminHeaders();
      const res = await fetch('/api/bookings', { headers });
      if (res.ok) {
        const serverBookings = await res.json();
        if (Array.isArray(serverBookings)) {
          setBookings(serverBookings);
        }
      } else if (res.status === 401 || res.status === 403) {
        // Expected for unauthenticated public customers: full bookings list is admin-only
      } else {
        console.error(`[API Error] Failed to fetch bookings from server: HTTP ${res.status}`);
      }
    } catch (err) {
      console.error('[Network Error] Could not fetch bookings from server API:', err);
    }
  }, []);

  // Server fetch for Reviews
  const refreshReviews = useCallback(async () => {
    try {
      const res = await fetch('/api/reviews', {
        headers: getAdminHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setReviews(data);
        } else if (Array.isArray(data) && data.length === 0) {
          setReviews(prev => prev.length > 0 ? prev : REVIEWS);
        }
      }
    } catch (err) {
      console.warn('Could not fetch reviews from server:', err);
    }
  }, []);

  // Server fetch for Google Places Reviews
  const refreshGoogleReviews = useCallback(async (force = false) => {
    setIsLoadingGoogleReviews(true);
    try {
      const res = await fetch(`/api/reviews/google${force ? '?refresh=true' : ''}`);
      if (res.ok) {
        const data: GoogleReviewsData = await res.json();
        setGoogleReviews(data);
      }
    } catch (err) {
      console.warn('Could not fetch google reviews from server:', err);
    } finally {
      setIsLoadingGoogleReviews(false);
    }
  }, []);

  // Server fetch for Service Limits
  const refreshServiceLimits = useCallback(async () => {
    try {
      const res = await fetch('/api/service-limits');
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object') {
          setServiceLimits(prev => ({ ...prev, ...data }));
          if (data.tour) setMaxBookingsPerDayState(data.tour);
        }
      }
    } catch (err) {
      console.warn('Could not fetch service limits from server:', err);
    }
  }, []);

  // Authoritative server state for Schedules
  const [schedules, setSchedules] = useState<any[]>([]);

  const [logs, setLogs] = useState<any[]>(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('smartjourney_logs') : null;
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse logs', e);
      }
    }
    return [];
  });

  // Airport Transfer states
  const [airportRoutes, setAirportRoutes] = useState<AirportRoute[]>([]);

  const [airports, setAirports] = useState<Airport[]>([
    { code: 'DPS', name: 'Ngurah Rai International Airport (DPS - Bali)', description: 'Bandara Internasional utama Bali di Tuban, Kuta. Melayani rute pariwisata premium internasional & domestik.', status: 'Active', surchargeUSD: 5, surchargeIDR: 75000 },
    { code: 'SUB', name: 'Juanda International Airport (SUB - Surabaya)', description: 'Bandara Internasional Jawa Timur berlokasi di Sidoarjo, melayani rute bisnis & wisata regional.', status: 'Active', surchargeUSD: 3, surchargeIDR: 45000 },
    { code: 'YIA', name: 'Yogyakarta International Airport (YIA)', description: 'Bandara megah modern di Kulon Progo, melayani pariwisata Candi Borobudur, Prambanan dan DIY Yogyakarta.', status: 'Active', surchargeUSD: 4, surchargeIDR: 60000 },
    { code: 'CGK', name: 'Soekarno-Hatta International Airport (CGK - Jakarta)', description: 'Bandara Internasional metropolitan tersibuk di Indonesia berlokasi di Tangerang, gerbang utama ibukota Jakarta.', status: 'Active', surchargeUSD: 5, surchargeIDR: 75000 }
  ]);

  // Taxi Service States
  const [taxiMasterAreas, setTaxiMasterAreas] = useState<TaxiMasterArea[]>([]);
  const [taxiMasterDestinations, setTaxiMasterDestinations] = useState<TaxiMasterDestination[]>([]);
  const [taxiPricingRules, setTaxiPricingRules] = useState<TaxiPricingRule[]>([]);
  const [taxiAreaRules, setTaxiAreaRules] = useState<TaxiAreaRule[]>([]);
  const [taxiImportHistory, setTaxiImportHistory] = useState<TaxiImportHistory[]>([]);

  // Car Rental States
  const [rentalCities, setRentalCities] = useState<OperationalCity[]>([]);
  const [rentalLocations, setRentalLocations] = useState<RentalLocation[]>([]);
  const [rentalCategories, setRentalCategories] = useState<RentalCategory[]>([]);
  const [rentalVehicles, setRentalVehicles] = useState<RentalVehicle[]>([]);
  const [rentalAddons, setRentalAddons] = useState<RentalAddon[]>([]);
  const [rentalZonePricing, setRentalZonePricing] = useState<ZonePricing[]>([]);

  // Server Fetchers for all services
  const isRentalsLoaded = useRef(false);
  const isAirportsLoaded = useRef(false);
  const isTaxiLoaded = useRef(false);

  const refreshRentals = useCallback(async () => {
    try {
      const res = await fetch('/api/rentals?all=true');
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object') {
          if (Array.isArray(data.cities)) setRentalCities(data.cities);
          if (Array.isArray(data.locations)) setRentalLocations(data.locations);
          if (Array.isArray(data.categories)) setRentalCategories(data.categories);
          if (Array.isArray(data.vehicles)) setRentalVehicles(data.vehicles);
          if (Array.isArray(data.addons)) setRentalAddons(data.addons);
          if (Array.isArray(data.zonePricing)) setRentalZonePricing(data.zonePricing);
        }
      }
    } catch (err) {
      console.warn('Could not fetch rentals from server API:', err);
    } finally {
      setTimeout(() => { isRentalsLoaded.current = true; }, 600);
    }
  }, []);

  const refreshAirports = useCallback(async () => {
    try {
      const [resAirports, resRoutes] = await Promise.all([
        fetch('/api/airports'),
        fetch('/api/airport-routes?all=true')
      ]);
      if (resAirports.ok) {
        const dataAirports = await resAirports.json();
        if (Array.isArray(dataAirports)) {
          setAirports(dataAirports);
        }
      }
      if (resRoutes.ok) {
        const dataRoutes = await resRoutes.json();
        if (Array.isArray(dataRoutes)) {
          setAirportRoutes(dataRoutes);
        }
      }
    } catch (err) {
      console.warn('Could not fetch airport data from server API:', err);
    } finally {
      setTimeout(() => { isAirportsLoaded.current = true; }, 600);
    }
  }, []);

  const refreshTaxi = useCallback(async () => {
    try {
      const res = await fetch('/api/taxi/all');
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object') {
          if (Array.isArray(data.masterAreas)) setTaxiMasterAreas(data.masterAreas);
          if (Array.isArray(data.destinations)) setTaxiMasterDestinations(data.destinations);
          if (Array.isArray(data.pricingRules)) setTaxiPricingRules(data.pricingRules);
          if (Array.isArray(data.areaRules)) setTaxiAreaRules(data.areaRules);
          if (Array.isArray(data.importHistory)) setTaxiImportHistory(data.importHistory);
        }
      }
    } catch (err) {
      console.warn('Could not fetch taxi data from server API:', err);
    } finally {
      setTimeout(() => { isTaxiLoaded.current = true; }, 600);
    }
  }, []);

  const refreshSchedules = useCallback(async () => {
    try {
      const res = await fetch('/api/schedules');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setSchedules(data);
        }
      }
    } catch (err) {
      console.warn('Could not fetch schedules from server API:', err);
    }
  }, []);

  // Mount effect: Fetch authoritative data from server for all services
  useEffect(() => {
    refreshTours();
    refreshBookings();
    refreshRentals();
    refreshAirports();
    refreshTaxi();
    refreshSchedules();
    refreshReviews();
    refreshGoogleReviews();
    refreshServiceLimits();
  }, [refreshTours, refreshBookings, refreshRentals, refreshAirports, refreshTaxi, refreshSchedules, refreshReviews, refreshGoogleReviews, refreshServiceLimits]);

  // Automated persistence sync effects to backend server
  useEffect(() => {
    if (!isRentalsLoaded.current) return;
    const timer = setTimeout(() => {
      fetch('/api/rentals/sync', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          cities: rentalCities,
          locations: rentalLocations,
          categories: rentalCategories,
          vehicles: rentalVehicles,
          addons: rentalAddons,
          zonePricing: rentalZonePricing
        })
      }).catch(err => console.warn('Rental background sync error:', err));
    }, 1000);
    return () => clearTimeout(timer);
  }, [rentalCities, rentalLocations, rentalCategories, rentalVehicles, rentalAddons, rentalZonePricing]);

  useEffect(() => {
    if (!isTaxiLoaded.current) return;
    const timer = setTimeout(() => {
      fetch('/api/taxi/sync', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          masterAreas: taxiMasterAreas,
          destinations: taxiMasterDestinations,
          pricingRules: taxiPricingRules,
          areaRules: taxiAreaRules,
          importHistory: taxiImportHistory
        })
      }).catch(err => console.warn('Taxi background sync error:', err));
    }, 1000);
    return () => clearTimeout(timer);
  }, [taxiMasterAreas, taxiMasterDestinations, taxiPricingRules, taxiAreaRules, taxiImportHistory]);

  useEffect(() => {
    if (!isAirportsLoaded.current) return;
    const timer = setTimeout(() => {
      fetch('/api/airport-transfers/sync', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          airports,
          routes: airportRoutes
        })
      }).catch(err => console.warn('Airport transfers background sync error:', err));
    }, 1000);
    return () => clearTimeout(timer);
  }, [airports, airportRoutes]);

  // Sync with URL hash and browser history (popstate / deep-linking)
  useEffect(() => {
    const handleLocationChange = () => {
      const fullHash = typeof window !== 'undefined' ? (window.location.hash || '') : '';
      const pathname = typeof window !== 'undefined' ? (window.location.pathname || '') : '';
      let hash = fullHash.split('?')[0].replace(/^#\/?/, '');

      const isAnchorOnly = hash === 'main-content' || hash === '' || fullHash === '#' || fullHash === '#main-content';

      // 1. Blog route recognition via clean pathname (/blog, /blog/, /blog/:slug, /blog/:slug/)
      const blogInfo = parseBlogPathname(pathname);
      const isBlogHash = hash === 'blog' || hash.startsWith('blog/');

      // If user is accessing a blog pathname and not explicitly jumping to a hash route like #/tours
      if (blogInfo.isBlog && (!hash || isBlogHash || isAnchorOnly)) {
        setActivePageState('blog');
        let articleSlug = blogInfo.slug || '';

        // Query param fallback e.g. /blog?slug=mount-bromo-travel-guide
        if (!articleSlug) {
          const searchParamsObj = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
          const qSlug = searchParamsObj.get('slug') || searchParamsObj.get('article');
          if (qSlug) {
            try {
              articleSlug = decodeURIComponent(qSlug).trim();
            } catch {
              articleSlug = qSlug.trim();
            }
            articleSlug = articleSlug
              .replace(/[<>"'`\\]/g, '')
              .replace(/[?#].*$/, '')
              .replace(/\/+$/, '')
              .trim();
          }
        }

        if (articleSlug) {
          setSearchParams((prev: any) => ({ ...prev, selectedArticleSlug: articleSlug }));
        } else {
          setSearchParams((prev: any) => ({ ...prev, selectedArticleSlug: undefined }));
          setActiveArticle(null);
        }

        // Consistent trailing slash normalization in browser address bar without reload
        if (typeof window !== 'undefined') {
          const canonicalBlogPath = articleSlug
            ? `/blog/${encodeURIComponent(articleSlug)}/`
            : '/blog/';
          if (window.location.pathname !== canonicalBlogPath) {
            const searchPart = window.location.search || '';
            const hashPart = window.location.hash && !isAnchorOnly && !isBlogHash ? window.location.hash : '';
            try {
              window.history.replaceState(null, '', `${canonicalBlogPath}${searchPart}${hashPart}`);
            } catch {}
          }
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      // Hash fallback for blog (e.g. #/blog or #/blog/mount-bromo-travel-guide)
      if (isBlogHash) {
        setActivePageState('blog');
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
        } else {
          const articleMatch = fullHash.match(/[?&#](?:article|articleSlug|slug)=([^&]+)/i);
          if (articleMatch) {
            try {
              articleSlug = decodeURIComponent(articleMatch[1]).trim();
            } catch {
              articleSlug = articleMatch[1].trim();
            }
          }
        }

        if (articleSlug) {
          setSearchParams((prev: any) => ({ ...prev, selectedArticleSlug: articleSlug }));
        } else {
          setSearchParams((prev: any) => ({ ...prev, selectedArticleSlug: undefined }));
          setActiveArticle(null);
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      // If user came from a blog pathname but clicked a distinct hash route (e.g. #/tours while on /blog/)
      if (typeof window !== 'undefined' && pathname.startsWith('/blog') && hash && !isAnchorOnly) {
        try {
          window.history.replaceState(null, '', `/#/${hash}`);
        } catch {}
      }

      if (!hash && typeof window !== 'undefined' && pathname && pathname !== '/') {
        hash = pathname.replace(/^\/+|\/+$/g, '');
      }
      if (hash === 'rental') {
        hash = 'car-rental';
      }
      if (hash.startsWith('trip=') || hash.includes('trip=') || hash.startsWith('share-tour') || hash.startsWith('sharetour')) {
        setActivePageState('share-tour');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (hash === 'tours') {
        setActivePageState('tours');
        const tourMatch = fullHash.match(/[?&#](?:tour|tourId|id)=([^&]+)/i);
        const explicitTourId = tourMatch ? decodeURIComponent(tourMatch[1]).trim() : '';
        if (explicitTourId) {
          setSearchParams((prev: any) => ({ ...prev, selectedTourId: explicitTourId }));
        } else {
          // NO TOUR IDENTIFIER -> CLEAR selectedTourId to ensure LIST is shown
          setSearchParams((prev: any) => ({ ...prev, selectedTourId: undefined }));
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (hash === 'about') {
        setActivePageState('about');
        const articleMatch = fullHash.match(/[?&#](?:article|articleSlug|slug)=([^&]+)/i);
        const explicitArticleSlug = articleMatch ? decodeURIComponent(articleMatch[1]).trim() : '';
        if (explicitArticleSlug) {
          setSearchParams((prev: any) => ({ ...prev, selectedArticleSlug: explicitArticleSlug }));
        } else {
          setSearchParams((prev: any) => ({ ...prev, selectedArticleSlug: undefined }));
          setActiveArticle(null);
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      // Event & Gathering deep link handler (handles /event-gathering, /event-gathering/:slug, #/event-gathering, #/event-gathering/:slug, etc.)
      if (pathname.startsWith('/event-gathering') || hash.startsWith('event-gathering') || fullHash.includes('event-gathering')) {
        setActivePageState('event-gathering');
        let pkgIdentifier = '';

        // Check pathname: /event-gathering/<slug-or-id>
        const pathSegments = pathname.replace(/^\/+|\/+$/g, '').split('/');
        if (pathSegments[0] === 'event-gathering' && pathSegments[1]) {
          pkgIdentifier = decodeURIComponent(pathSegments[1]).trim();
        }

        // Check hash path: #/event-gathering/<slug-or-id>
        if (!pkgIdentifier && hash.startsWith('event-gathering/')) {
          const hashSegments = hash.split('/');
          if (hashSegments[1]) {
            pkgIdentifier = decodeURIComponent(hashSegments[1]).trim();
          }
        }

        // Check query params
        if (!pkgIdentifier) {
          const searchParamsObj = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
          const hashParamsObj = new URLSearchParams(fullHash.includes('?') ? fullHash.split('?')[1] : '');
          const qParam = searchParamsObj.get('package') || searchParamsObj.get('pkg') || searchParamsObj.get('id') ||
                         hashParamsObj.get('package') || hashParamsObj.get('pkg') || hashParamsObj.get('id');
          if (qParam) {
            pkgIdentifier = decodeURIComponent(qParam).trim();
          }
        }

        if (pkgIdentifier) {
          setSearchParams((prev: any) => ({ ...prev, selectedGatheringPackageId: pkgIdentifier }));
        } else {
          setSearchParams((prev: any) => ({ ...prev, selectedGatheringPackageId: undefined }));
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const validPages: ActivePage[] = ['home', 'tours', 'share-tour', 'event-gathering', 'airport', 'taxi', 'partnerships', 'contact', 'bookings', 'car-rental', 'about', 'admin', 'blog'];
      if (validPages.includes(hash as ActivePage)) {
        setActivePageState(hash as ActivePage);
        setActiveArticle(null);
        setSearchParams((prev: any) => ({ ...prev, selectedArticleSlug: undefined }));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (hash === '') {
        setActivePageState('home');
        setActiveArticle(null);
        setSearchParams((prev: any) => ({ ...prev, selectedArticleSlug: undefined }));
      }
    };

    window.addEventListener('hashchange', handleLocationChange);
    window.addEventListener('popstate', handleLocationChange);
    handleLocationChange(); // Run once on mount

    return () => {
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  const setPage = (page: ActivePage, articleSlug?: string) => {
    setActivePageState(page);

    if (page === 'blog') {
      const cleanSlug = articleSlug ? articleSlug.trim() : undefined;
      setSearchParams((prev: any) => ({ ...prev, selectedArticleSlug: cleanSlug }));
      if (!cleanSlug) {
        setActiveArticle(null);
      }
      const targetUrl = cleanSlug ? `/blog/${encodeURIComponent(cleanSlug)}/` : '/blog/';
      if (typeof window !== 'undefined') {
        try {
          window.history.pushState(null, '', targetUrl);
        } catch {
          window.location.hash = cleanSlug ? `#/blog/${cleanSlug}` : '#/blog';
        }
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (page === 'tours') {
      setSearchParams((prev: any) => ({ ...prev, selectedTourId: undefined }));
    }
    if (page === 'event-gathering') {
      setSearchParams((prev: any) => ({ ...prev, selectedGatheringPackageId: undefined }));
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/event-gathering')) {
        try {
          window.history.pushState(null, '', '/event-gathering');
        } catch {}
      }
    }
    if (page !== 'about') {
      setActiveArticle(null);
      setSearchParams((prev: any) => ({ ...prev, selectedArticleSlug: undefined }));
    }

    if (typeof window !== 'undefined') {
      // Transition cleanly from non-root pathname (e.g. /blog/ or /blog/:slug/) to hash without conflict
      if (window.location.pathname !== '/' && (window.location.pathname.startsWith('/blog') || window.location.pathname.startsWith('/event-gathering'))) {
        try {
          window.history.pushState(null, '', page === 'home' ? '/' : `/#/${page}`);
        } catch {
          window.location.hash = page === 'home' ? '' : `#/${page}`;
        }
      } else {
        if (page === 'home') {
          if (window.location.hash) {
            window.location.hash = '';
          }
        } else {
          window.location.hash = `#/${page}`;
        }
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToBlog = (slug?: string) => {
    setPage('blog', slug);
  };

  const addBooking = async (bookingData: Omit<Booking, 'id' | 'bookingDate' | 'status'>): Promise<Booking> => {
    const targetDate = bookingData.details?.date;
    // Private Trips (type === 'tour') are free from calendar batch/availability restrictions
    if (targetDate && bookingData.type !== 'tour') {
      const isBlocked = (schedules || []).some(s => s.date === targetDate && s.type === 'blocked');
      const confirmedCount = bookings.filter(b => 
        b.details && 
        b.details.date === targetDate && 
        b.type === bookingData.type &&
        (b.status === 'Confirmed' || b.status === 'Completed')
      ).length;
      
      if (isBlocked) {
        throw new Error('Maaf, tanggal ini telah ditutup oleh pihak operasional (Blackout Date).');
      }
      const currentLimit = serviceLimits[bookingData.type] ?? 5;
      if (confirmedCount >= currentLimit) {
        throw new Error(`Maaf, kuota pemesanan harian (${currentLimit} slot) untuk layanan ini pada tanggal ini telah penuh.`);
      }
    }

    const id = `SJ-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date();
    const bookingDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    let resolvedBooking: Booking = {
      ...bookingData,
      id,
      bookingDate,
      status: 'Pending',
      paymentStatus: 'Pending'
    };

    const updated = [resolvedBooking, ...bookings];
    setBookings(updated);
    addLog(`New booking ${id} received for ${bookingData.serviceName} (Status: Pending Payment)`);

    // Post to server DB for ArtoPay webhook tracking and persistent storage
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          bookingCode: id,
          bookingType: 'private',
          tourBookingType: 'private',
          type: bookingData.type,
          serviceType: (bookingData as any).serviceType || bookingData.type,
          serviceId: (bookingData as any).serviceId || (bookingData as any).routeId || (bookingData as any).ruleId || (bookingData.details as any)?.routeId || (bookingData.details as any)?.ruleId,
          routeId: (bookingData as any).routeId || (bookingData as any).serviceId || (bookingData as any).ruleId || (bookingData.details as any)?.routeId || (bookingData.details as any)?.ruleId,
          ruleId: (bookingData as any).ruleId || (bookingData as any).serviceId || (bookingData.details as any)?.ruleId || (bookingData.details as any)?.serviceId,
          source_id: (bookingData as any).source_id || (bookingData.details as any)?.source_id || (bookingData as any).pickupAreaId || (bookingData.details as any)?.pickupAreaId,
          destination_id: (bookingData as any).destination_id || (bookingData.details as any)?.destination_id || (bookingData as any).destAreaId || (bookingData.details as any)?.destAreaId,
          pickupAreaId: (bookingData as any).pickupAreaId || (bookingData.details as any)?.pickupAreaId,
          destAreaId: (bookingData as any).destAreaId || (bookingData.details as any)?.destAreaId,
          pickup: (bookingData as any).pickup || (bookingData.details as any)?.pickup || (bookingData as any).pickupLocation || (bookingData.details as any)?.pickupLocation,
          airport: (bookingData as any).airport || (bookingData.details as any)?.airport,
          city: (bookingData as any).city || (bookingData.details as any)?.city || (bookingData as any).destinationCity || (bookingData.details as any)?.destinationCity,
          destinationCity: (bookingData as any).destinationCity || (bookingData.details as any)?.destinationCity || (bookingData as any).city || (bookingData.details as any)?.city,
          destination: (bookingData as any).destination || (bookingData.details as any)?.destination,
          pickupLocation: (bookingData as any).pickupLocation || (bookingData.details as any)?.pickupLocation,
          vehicleId: (bookingData as any).vehicleId || (bookingData.details as any)?.vehicleId,
          vehicleName: (bookingData as any).vehicleName || (bookingData.details as any)?.vehicleName,
          vehicleType: (bookingData as any).vehicleType || (bookingData.details as any)?.vehicleType,
          routeType: (bookingData as any).routeType || (bookingData.details as any)?.routeType,
          childSeat: (bookingData as any).childSeat ?? (bookingData.details as any)?.childSeat,
          meetAndGreet: (bookingData as any).meetAndGreet ?? (bookingData.details as any)?.meetAndGreet,
          promoCode: (bookingData as any).promoCode || (bookingData as any).promo_code || (bookingData.details as any)?.promoCode,
          promo_code: (bookingData as any).promoCode || (bookingData as any).promo_code || (bookingData.details as any)?.promoCode,
          discount: (bookingData as any).discount ?? (bookingData as any).discountAmount ?? (bookingData.details as any)?.discountAmount ?? (bookingData.details as any)?.verifiedDiscount,
          baseAmount: (bookingData as any).baseAmount || bookingData.totalPriceIDR,
          serviceName: bookingData.serviceName,
          tripId: bookingData.details?.tourId || (bookingData.details as any)?.tripId || (bookingData as any).tripId || (bookingData as any).tourId || (bookingData.type === 'tour' ? 'tour-private' : ''),
          tourId: bookingData.details?.tourId || (bookingData.details as any)?.tripId || (bookingData as any).tourId || (bookingData as any).tripId || '',
          departureDate: bookingData.details?.date || '',
          customerName: bookingData.customerName,
          fullName: bookingData.customerName,
          customerEmail: bookingData.customerEmail,
          email: bookingData.customerEmail,
          customerPhone: bookingData.customerPhone,
          phone: bookingData.customerPhone,
          totalPrice: bookingData.totalPrice,
          totalPriceIDR: bookingData.totalPriceIDR || bookingData.totalPrice,
          status: 'Pending',
          paymentStatus: 'Pending',
          details: bookingData.details || {}
        })
      });
      if (res.ok) {
        const saved = await res.json();
        setBookings(prev => [saved, ...prev.filter(b => b.id !== id && b.id !== saved.id)]);
        resolvedBooking = { ...resolvedBooking, ...saved };
      }
    } catch (err) {
      console.warn('Server booking sync warning:', err);
    }

    return resolvedBooking;
  };

  const updateBookingStatus = async (
    id: string, 
    status: string, 
    paymentStatus?: string
  ) => {
    const targetBooking = bookings.find(b => b.id === id || b.bookingCode === id);
    const effectivePayment = paymentStatus !== undefined ? paymentStatus : targetBooking?.paymentStatus;
    const isPaid = (effectivePayment || '').toLowerCase() === 'paid' || Boolean(targetBooking?.paidAt);
    if (status === 'Confirmed' && !isPaid) {
      console.warn(`[Admin Security] Blocked confirmation for booking ${id}: paymentStatus is "${effectivePayment}", must be "Paid".`);
      return;
    }

    const updated = bookings.map(b => {
      if (b.id === id || b.bookingCode === id) {
        return { 
          ...b, 
          status, 
          bookingStatus: status,
          confirmedAt: status === 'Confirmed' ? (b.confirmedAt || new Date().toISOString()) : b.confirmedAt,
          paymentStatus: paymentStatus !== undefined ? paymentStatus : (isPaid ? 'Paid' : b.paymentStatus) 
        };
      }
      return b;
    });
    setBookings(updated);
    addLog(`Booking ${id} status updated to ${status}${paymentStatus ? ` (${paymentStatus})` : ''}`);

    try {
      const payload: any = { status };
      if (paymentStatus !== undefined) payload.paymentStatus = paymentStatus;
      let res = await fetch(`/api/bookings/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        headers: getAdminHeaders(),
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        // Fallback to PUT /api/bookings/:id if needed
        res = await fetch(`/api/bookings/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: getAdminHeaders(),
          body: JSON.stringify(payload)
        });
      }
      if (res.ok) {
        const serverUpdated = await res.json();
        const resolved = serverUpdated.booking || serverUpdated;
        setBookings(prev => prev.map(b => 
          (b.id === id || b.bookingCode === id || b.id === resolved.id || b.bookingCode === resolved.bookingCode) 
            ? { 
                ...b, 
                ...resolved, 
                status: resolved.status || status, 
                bookingStatus: resolved.status || status,
                confirmedAt: resolved.confirmedAt || (status === 'Confirmed' ? (b.confirmedAt || new Date().toISOString()) : b.confirmedAt)
              } 
            : b
        ));
        window.dispatchEvent(new CustomEvent('sj_booking_updated', { detail: { id, status } }));
      } else {
        console.error('Failed to persist booking status update to server:', await res.text());
        // Refresh authoritative list from server
        refreshBookings();
      }
    } catch (err) {
      console.error('Error persisting booking status update to server:', err);
      refreshBookings();
    }
  };

  // Tours actions with Server-Side Authoritative Persistence (Strictly Server-Authoritative)
  const addTour = async (tour: Tour): Promise<Tour> => {
    const tourWithStatus: Tour = {
      ...tour,
      id: tour.id && tour.id.trim() !== '' ? tour.id.trim() : `tour-${Date.now()}`,
      status: tour.status || 'published',
      createdAt: tour.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const res = await fetch('/api/main-tours', {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify(tourWithStatus)
    });
    const saved = await handleAdminResponse<Tour>(res, 'Gagal menyimpan paket tour ke server database.');
    if (!saved || !saved.id) {
      throw new Error('Format respon server tidak valid saat menyimpan paket tour.');
    }
    // Authoritative server state update only after verified server response
    setTours(prev => [saved, ...prev.filter(t => t.id !== saved.id)]);
    addLog(`Paket tour baru berhasil disimpan di database server: ${saved.name} (${saved.id})`);
    return saved;
  };

  const updateTour = async (updatedTour: Tour): Promise<Tour> => {
    const tourWithTimestamp: Tour = {
      ...updatedTour,
      updatedAt: new Date().toISOString()
    };

    const res = await fetch(`/api/main-tours/${encodeURIComponent(tourWithTimestamp.id)}`, {
      method: 'PUT',
      headers: getAdminHeaders(),
      body: JSON.stringify(tourWithTimestamp)
    });
    const saved = await handleAdminResponse<Tour>(res, 'Gagal memperbarui tour pada database server.');
    if (!saved || !saved.id) {
      throw new Error('Format respon server tidak valid saat memperbarui paket tour.');
    }
    // Authoritative server state update
    setTours(prev => prev.map(t => t.id === saved.id ? saved : t));
    addLog(`Paket tour ${saved.id} (${saved.name}) berhasil diperbarui di database server`);
    return saved;
  };

  const deleteTour = async (id: string): Promise<void> => {
    const res = await fetch(`/api/main-tours/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAdminHeaders()
    });
    const data = await handleAdminResponse<{ success: boolean; id: string; mode: string }>(res, 'Gagal menghapus tour pada database server.');
    // If soft-deleted / archived on server to protect bookings, keep state in sync
    if (data && data.mode === 'archived') {
      setTours(prev => prev.map(t => t.id === id ? { ...t, status: 'archived', isDeleted: true } : t));
    } else {
      setTours(prev => prev.filter(t => t.id !== id));
    }
    addLog(`Paket tour ${id} berhasil dihapus dari database server`);
  };

  const setTourStatus = async (id: string, status: 'published' | 'draft' | 'unpublished') => {
    const target = tours.find(t => t.id === id);
    if (!target) return;
    const updated: Tour = { ...target, status, updatedAt: new Date().toISOString() };
    await updateTour(updated);
  };

  // Schedules with Persistent Backend API
  const addSchedule = async (schedule: any) => {
    const newSchedule = { ...schedule, id: `sc-${Date.now()}` };
    const updated = [newSchedule, ...schedules];
    setSchedules(updated);
    addLog(`Added schedule rule: ${schedule.type} on ${schedule.date}`);
    try {
      await fetch('/api/schedules', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify(newSchedule)
      });
    } catch (err) {
      console.error('Failed to sync new schedule to server:', err);
    }
  };

  const updateSchedule = async (updatedSchedule: any) => {
    const updated = schedules.map(s => s.id === updatedSchedule.id ? updatedSchedule : s);
    setSchedules(updated);
    addLog(`Updated schedule rule ${updatedSchedule.id}`);
    try {
      await fetch(`/api/schedules/${encodeURIComponent(updatedSchedule.id)}`, {
        method: 'PUT',
        headers: getAdminHeaders(),
        body: JSON.stringify(updatedSchedule)
      });
    } catch (err) {
      console.error('Failed to sync updated schedule to server:', err);
    }
  };

  const deleteSchedule = async (id: string) => {
    const updated = schedules.filter(s => s.id !== id);
    setSchedules(updated);
    addLog(`Deleted schedule rule ${id}`);
    try {
      await fetch(`/api/schedules/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getAdminHeaders()
      });
    } catch (err) {
      console.error('Failed to delete schedule on server:', err);
    }
  };

  // Logs
  const addLog = (event: string, type?: 'tour' | 'rental' | 'taxi' | 'airport' | 'system') => {
    const now = new Date();
    const time = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    // Auto-detect type if not provided
    let detectedType = type;
    if (!detectedType) {
      const ev = event.toLowerCase();
      if (ev.includes('tour') || ev.includes('wisata') || ev.includes('bromo') || ev.includes('katalog')) {
        detectedType = 'tour';
      } else if (ev.includes('rental') || ev.includes('sewa') || ev.includes('mobil') || ev.includes('fleet') || ev.includes('chauffeur')) {
        detectedType = 'rental';
      } else if (ev.includes('taxi') || ev.includes('taksi') || ev.includes('rute')) {
        detectedType = 'taxi';
      } else if (ev.includes('airport') || ev.includes('bandara') || ev.includes('jemput')) {
        detectedType = 'airport';
      } else {
        detectedType = 'system';
      }
    }

    const newLog = { time, event, type: detectedType };
    setLogs(prev => {
      const updated = [newLog, ...prev].slice(0, 100); // keep last 100 logs
      localStorage.setItem('smartjourney_logs', JSON.stringify(updated));
      return updated;
    });
  };

  const formatPrice = useCallback((usdPrice: number, idrPrice: number) => {
    if (currency === 'USD') {
      return `$${usdPrice}`;
    } else if (currency === 'CNY') {
      const cny = Math.round(usdPrice * EXCHANGE_RATE_USD_TO_CNY);
      return `¥${cny.toLocaleString('zh-CN')}`;
    } else {
      // Clean IDR formatting: Rp X.XXX.XXX (no confusing M suffix)
      const validIDR = idrPrice > 0 ? idrPrice : Math.round(usdPrice * EXCHANGE_RATE_USD_TO_IDR);
      return `IDR ${validIDR.toLocaleString('id-ID')}`;
    }
  }, [currency]);

  return (
    <AppContext.Provider
      value={{
        activePage,
        setPage,
        navigateToBlog,
        currency,
        setCurrency,
        isPrivacyOpen,
        setPrivacyOpen,
        isTermsOpen,
        setTermsOpen,
        isComingSoonOpen,
        setComingSoonOpen,
        comingSoonService,
        setComingSoonService,
        bookings,
        refreshBookings,
        addBooking,
        updateBookingStatus,
        formatPrice,
        tours,
        addTour,
        updateTour,
        deleteTour,
        setTourStatus,
        refreshTours,
        schedules,
        addSchedule,
        updateSchedule,
        deleteSchedule,
        logs,
        addLog,
        searchParams,
        setSearchParams,
        activeArticle,
        setActiveArticle,
        maxBookingsPerDay,
        setMaxBookingsPerDay,
        airportRoutes,
        setAirportRoutes,
        airports,
        setAirports,
        taxiMasterAreas,
        setTaxiMasterAreas,
        taxiMasterDestinations,
        setTaxiMasterDestinations,
        taxiPricingRules,
        setTaxiPricingRules,
        taxiAreaRules,
        setTaxiAreaRules,
        taxiImportHistory,
        setTaxiImportHistory,
        rentalCities,
        setRentalCities,
        rentalLocations,
        setRentalLocations,
        rentalVehicles,
        setRentalVehicles,
        rentalCategories,
        setRentalCategories,
        rentalAddons,
        setRentalAddons,
        rentalZonePricing,
        setRentalZonePricing,
        serviceLimits,
        setServiceLimit,
        reviews,
        setReviews,
        addReview,
        approveReview,
        rejectReview,
        googleReviews,
        isLoadingGoogleReviews,
        refreshGoogleReviews
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
