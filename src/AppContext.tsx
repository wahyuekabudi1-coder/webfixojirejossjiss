import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  ActivePage, Booking, Tour, AirportRoute, Airport, 
  TaxiMasterArea, TaxiMasterDestination, TaxiPricingRule, TaxiAreaRule, TaxiImportHistory,
  OperationalCity, RentalLocation, RentalVehicle, RentalCategory, RentalAddon, ZonePricing,
  Review
} from './types';
import { TOURS, REVIEWS } from './data';
import { EXCHANGE_RATE_USD_TO_IDR, EXCHANGE_RATE_USD_TO_CNY, ENABLE_FOREIGN_CURRENCIES } from './utils/pricingUtils';

interface AppContextProps {
  activePage: ActivePage;
  setPage: (page: ActivePage) => void;
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
  };
  setSearchParams: (params: any) => void;
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

function getAdminHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined'
    ? (localStorage.getItem('smart_journey_admin_token') || localStorage.getItem('smartjourney_admin_token') || '')
    : '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activePage, setActivePageState] = useState<ActivePage>('home');
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

  const [reviews, setReviews] = useState<Review[]>([]);

  const addReview = async (reviewData: Omit<Review, 'id' | 'date'>) => {
    const today = new Date();
    const formattedDate = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const newReview: Review = {
      ...reviewData,
      id: `rev-${Date.now()}`,
      date: formattedDate,
      status: 'pending'
    };
    setReviews(prev => [newReview, ...prev]);
    try {
      await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newReview)
      });
    } catch (err) {
      console.error('Failed to persist review to server:', err);
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
  
  // Authoritative server state for bookings - initialized empty, populated exclusively via API
  const [bookings, setBookings] = useState<Booking[]>([]);

  const [searchParams, setSearchParams] = useState<any>({});
  
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
        if (Array.isArray(data)) {
          setReviews(data);
        }
      }
    } catch (err) {
      console.warn('Could not fetch reviews from server:', err);
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
    refreshServiceLimits();
  }, [refreshTours, refreshBookings, refreshRentals, refreshAirports, refreshTaxi, refreshSchedules, refreshReviews, refreshServiceLimits]);

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

  // Sync with URL hash

  useEffect(() => {
    const handleHashChange = () => {
      let hash = window.location.hash.split('?')[0].replace(/^#\/?/, '');
      if (!hash && typeof window !== 'undefined' && window.location.pathname && window.location.pathname !== '/') {
        hash = window.location.pathname.replace(/^\/+|\/+$/g, '');
      }
      if (hash === 'rental') {
        hash = 'car-rental';
      }
      const validPages: ActivePage[] = ['home', 'tours', 'share-tour', 'airport', 'taxi', 'partnerships', 'contact', 'bookings', 'car-rental', 'about', 'admin'];
      if (validPages.includes(hash as ActivePage)) {
        setActivePageState(hash as ActivePage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (hash === '') {
        setActivePageState('home');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // Run once on mount

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const setPage = (page: ActivePage) => {
    setActivePageState(page);
    window.location.hash = `#/${page}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addBooking = (bookingData: Omit<Booking, 'id' | 'bookingDate' | 'status'>): Booking => {
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
    
    const newBooking: Booking = {
      ...bookingData,
      id,
      bookingDate,
      status: 'Pending',
      paymentStatus: 'Pending'
    };

    const updated = [newBooking, ...bookings];
    setBookings(updated);
    addLog(`New booking ${id} received for ${bookingData.serviceName} (Status: Pending Payment)`);

    // Post to server DB for ArtoPay webhook tracking and persistent storage
    fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        bookingCode: id,
        bookingType: 'private',
        tourBookingType: 'private',
        type: bookingData.type,
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
    })
    .then(async res => {
      if (res.ok) {
        const saved = await res.json();
        setBookings(prev => [saved, ...prev.filter(b => b.id !== id && b.id !== saved.id)]);
      }
    })
    .catch(err => {
      console.warn('Server booking sync warning:', err);
    });

    return newBooking;
  };

  const updateBookingStatus = async (
    id: string, 
    status: string, 
    paymentStatus?: string
  ) => {
    const updated = bookings.map(b => {
      if (b.id === id || b.bookingCode === id) {
        return { 
          ...b, 
          status, 
          paymentStatus: paymentStatus !== undefined ? paymentStatus : b.paymentStatus 
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
        setBookings(prev => prev.map(b => (b.id === serverUpdated.id || b.bookingCode === serverUpdated.bookingCode) ? { ...b, ...serverUpdated } : b));
      } else {
        console.error('Failed to persist booking status update to server:', await res.text());
      }
    } catch (err) {
      console.error('Error persisting booking status update to server:', err);
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

    try {
      const res = await fetch('/api/main-tours', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify(tourWithStatus)
      });
      if (res.ok) {
        const saved: Tour = await res.json();
        if (!saved || !saved.id) {
          throw new Error('Format respon server tidak valid saat menyimpan paket tour.');
        }
        // Authoritative server state update only after verified server response
        setTours(prev => [saved, ...prev.filter(t => t.id !== saved.id)]);
        addLog(`Paket tour baru berhasil disimpan di database server: ${saved.name} (${saved.id})`);
        return saved;
      } else {
        const errText = await res.text();
        console.error('Failed to persist tour to server database:', errText);
        throw new Error(errText || 'Gagal menyimpan tour ke server database.');
      }
    } catch (err) {
      console.error('Network or server error saving tour to database:', err);
      throw err;
    }
  };

  const updateTour = async (updatedTour: Tour): Promise<Tour> => {
    const tourWithTimestamp: Tour = {
      ...updatedTour,
      updatedAt: new Date().toISOString()
    };

    try {
      const res = await fetch(`/api/main-tours/${encodeURIComponent(tourWithTimestamp.id)}`, {
        method: 'PUT',
        headers: getAdminHeaders(),
        body: JSON.stringify(tourWithTimestamp)
      });
      if (res.ok) {
        const saved: Tour = await res.json();
        if (!saved || !saved.id) {
          throw new Error('Format respon server tidak valid saat memperbarui paket tour.');
        }
        // Authoritative server state update
        setTours(prev => prev.map(t => t.id === saved.id ? saved : t));
        addLog(`Paket tour ${saved.id} (${saved.name}) berhasil diperbarui di database server`);
        return saved;
      } else {
        const errText = await res.text();
        console.error('Failed to update tour on server database:', errText);
        throw new Error(errText || 'Gagal memperbarui tour pada database server.');
      }
    } catch (err) {
      console.error('Network or server error updating tour on server:', err);
      throw err;
    }
  };

  const deleteTour = async (id: string): Promise<void> => {
    try {
      const res = await fetch(`/api/main-tours/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getAdminHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        // If soft-deleted / archived on server to protect bookings, keep state in sync
        if (data.mode === 'archived') {
          setTours(prev => prev.map(t => t.id === id ? { ...t, status: 'archived', isDeleted: true } : t));
        } else {
          setTours(prev => prev.filter(t => t.id !== id));
        }
        addLog(`Paket tour ${id} berhasil dihapus dari database server`);
      } else {
        const errText = await res.text();
        console.error('Failed to delete tour from server database:', errText);
        throw new Error(errText || 'Gagal menghapus tour pada database server.');
      }
    } catch (err) {
      console.error('Network error deleting tour from server:', err);
      throw err;
    }
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
        rejectReview
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
