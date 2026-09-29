import React, { Component, useState, useEffect, useRef, useCallback } from "react";
import { Trip, Batch, Booking } from "./types";
import { fetchDB, fetchTripById, fetchBatches } from "./api";
import TripListing from "./components/TripListing";
import TripDetail from "./components/TripDetail";
import BookingForm from "./components/BookingForm";
import BookingSuccess from "./components/BookingSuccess";
import StatusChecker from "./components/StatusChecker";
import AdminLogin from "./components/AdminLogin";
import AdminDashboard from "./components/AdminDashboard";
import { RefreshCw, MapPin, Compass } from "lucide-react";

// Backoff delays for cold-start resilience: 1s, 2s, 3s, 5s, 8s (Total ~19s window)
const RETRY_DELAYS = [1000, 2000, 3000, 5000, 8000];

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback: (error: Error, reset: () => void) => React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ShareTourErrorBoundary extends (Component as any) {
  state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("[ShareTourErrorBoundary] Caught render error:", error, errorInfo);
  }

  reset = () => {
    (this as any).setState({ hasError: false, error: null });
  };

  render() {
    const s = (this as any).state;
    const p = (this as any).props;
    if (s?.hasError && s?.error) {
      return p.fallback(s.error, this.reset);
    }
    return p.children;
  }
}

function abortableSleep(ms: number, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve(false);
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve(true);
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve(false);
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

// Helper to extract explicit trip identifier from URL hash or query params
// Returns empty string if customer is visiting the listing (e.g. #/share-tour)
export function getExplicitTripIdentifier(): string {
  if (typeof window === "undefined") return "";
  const hash = window.location.hash || "";
  const search = window.location.search || "";

  // Check hash for ?trip=, &trip=, #trip=, #/share-tour?trip=, or ?slug=
  const hashMatch = hash.match(/[?&#](?:trip|tripid|slug)=([^&]+)/i) || hash.match(/^#(?:trip|slug)=([^&]+)/i);
  if (hashMatch && hashMatch[1]) {
    return decodeURIComponent(hashMatch[1]).trim();
  }

  // Check search params
  if (search) {
    try {
      const sp = new URLSearchParams(search);
      const val = sp.get("trip") || sp.get("tripId") || sp.get("slug");
      if (val) return val.trim();
    } catch {}
  }
  return "";
}

export default function App() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const tripsRef = useRef<Trip[]>(trips);
  useEffect(() => {
    tripsRef.current = trips;
  }, [trips]);

  const [batches, setBatches] = useState<Batch[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  
  // Navigation Routing State
  // "trips" | "trip-detail" | "book" | "success" | "status" | "admin"
  // DEFAULT IS ALWAYS "trips" (LIST) unless URL explicitly specifies a trip!
  const [currentView, setCurrentView] = useState<string>(() => {
    try {
      const explicitId = getExplicitTripIdentifier();
      if (explicitId) {
        return "trip-detail";
      }
      const hash = window.location.hash.toLowerCase();
      if (hash === "#admin" || window.location.pathname.endsWith("/admin")) return "admin";
      if (hash === "#status" || window.location.pathname.endsWith("/status")) return "status";
    } catch {}
    return "trips";
  });
  
  // Primary identifier: trip.id, with slug for URL/SEO fallback
  // ONLY initialized if URL explicitly contains a trip identifier!
  const [selectedTripId, setSelectedTripId] = useState<string>(() => {
    return getExplicitTripIdentifier() || "";
  });
  const [selectedTripSlug, setSelectedTripSlug] = useState<string>(() => {
    return getExplicitTripIdentifier() || "";
  });
  const [activeTripOverride, setActiveTripOverride] = useState<Trip | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string>("");

  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [selectedNationality, setSelectedNationality] = useState<'WNI' | 'WNA' | 'WNA_CHINA' | 'WNA_EUROPE' | null>(null);
  const [recentlyBooked, setRecentlyBooked] = useState<Booking | null>(null);

  // Admin authentication state
  const [adminToken, setAdminToken] = useState<string>(() => {
    return localStorage.getItem("smart_journey_admin_token") || localStorage.getItem("smartjourney_admin_token") || "";
  });

  // Database Loader State
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  // Race condition & cancellation references
  const activeRequestIdRef = useRef(0);
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  const refreshDatabase = useCallback(async (isManual = false, isBackgroundRecovery = false) => {
    // Invalidate and cancel previous active request/loop
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
    }

    const requestId = ++activeRequestIdRef.current;
    const controller = new AbortController();
    activeAbortControllerRef.current = controller;

    const isCurrent = () => requestId === activeRequestIdRef.current && !controller.signal.aborted;

    if (isManual) {
      setLoading(true);
      setErrorMsg("");
      setRetryCount(0);
    } else if (!isBackgroundRecovery) {
      setLoading(true);
      setErrorMsg("");
      setRetryCount(0);
    }

    const maxRetries = RETRY_DELAYS.length;
    let lastErr: any = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (!isCurrent()) return;

      if (attempt > 0) {
        const delay = RETRY_DELAYS[attempt - 1];
        if (!isBackgroundRecovery) {
          setRetryCount(attempt);
        }
        console.warn(`[ShareTour DB Sync #${requestId}] Attempt ${attempt}/${maxRetries} failed, retrying in ${delay}ms...`, lastErr);
        const ok = await abortableSleep(delay, controller.signal);
        if (!ok || !isCurrent()) return;
      }

      try {
        const db = await fetchDB(0, 1000, controller.signal);
        if (!isCurrent()) return;

        // Success: only the active request updates state and clears errors
        setTrips(Array.isArray(db.trips) ? db.trips : []);
        setBatches(Array.isArray(db.batches) ? db.batches : []);
        setBookings(Array.isArray(db.bookings) ? db.bookings : []);
        setErrorMsg("");
        setLoading(false);
        setRetryCount(0);
        return;
      } catch (err: any) {
        if (!isCurrent() || err.name === "AbortError" || controller.signal.aborted) {
          return;
        }
        lastErr = err;
      }
    }

    if (!isCurrent()) return;

    console.error(`[ShareTour DB Sync #${requestId}] Database sync final failure:`, lastErr);
    setErrorMsg(lastErr?.message || "Failed to connect to ShareTour server database.");
    setLoading(false);
    setRetryCount(0);
  }, []);

  // Save current view to sessionStorage (only 'trips' list view to prevent stale detail restore)
  useEffect(() => {
    try {
      if (currentView === "trips") {
        sessionStorage.setItem("sj_sharetour_view", "trips");
      }
    } catch {}
  }, [currentView]);

  const handleSelectTrip = useCallback((tripOrIdOrSlug: Trip | string, slugFallback?: string) => {
    setDetailError("");
    let targetId = "";
    let targetSlug = "";
    let targetObj: Trip | null = null;

    if (typeof tripOrIdOrSlug === "object" && tripOrIdOrSlug !== null) {
      targetObj = tripOrIdOrSlug;
      targetId = targetObj.id;
      targetSlug = targetObj.slug || targetObj.id;
    } else {
      const raw = String(tripOrIdOrSlug || "").trim();
      // Primary: id matching, fallback: slug matching from tripsRef
      const currentTrips = tripsRef.current;
      const matched = currentTrips.find((t) => t.id === raw) || currentTrips.find((t) => t.slug === raw);
      if (matched) {
        targetObj = matched;
        targetId = matched.id;
        targetSlug = matched.slug || matched.id;
      } else {
        targetId = raw;
        targetSlug = slugFallback || raw;
      }
    }

    if (targetId) {
      setSelectedTripId(targetId);
      setSelectedTripSlug(targetSlug);
      setActiveTripOverride(targetObj);
      try {
        sessionStorage.setItem("sj_selected_trip_id", targetId);
        sessionStorage.setItem("sj_selected_trip_slug", targetSlug);
      } catch {}

      // Keep URL clean and updated with explicit trip parameter
      const urlParam = targetSlug || targetId;
      try {
        const targetHash = `#/share-tour?trip=${encodeURIComponent(urlParam)}`;
        if (window.location.hash !== targetHash) {
          window.location.hash = targetHash;
        }
      } catch {}
    }

    setCurrentView("trip-detail");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleBackToTrips = useCallback(() => {
    setCurrentView("trips");
    setSelectedTripId("");
    setSelectedTripSlug("");
    setActiveTripOverride(null);
    setDetailError("");
    try {
      sessionStorage.removeItem("sj_selected_trip_id");
      sessionStorage.removeItem("sj_selected_trip_slug");
      sessionStorage.setItem("sj_sharetour_view", "trips");
    } catch {}
    try {
      window.location.hash = "#/share-tour";
    } catch {}
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // 1. Initial Database Loading Effect (runs ONCE on mount)
  useEffect(() => {
    refreshDatabase();
    return () => {
      if (activeAbortControllerRef.current) {
        activeAbortControllerRef.current.abort();
      }
    };
  }, [refreshDatabase]);

  // 2. URL & Hash Routing Effect (Separated from DB sync; DOES NOT call refreshDatabase)
  useEffect(() => {
    const handleUrlRouting = () => {
      const hash = window.location.hash || "";
      const path = window.location.pathname || "";
      const search = window.location.search || "";
      
      const lowerHash = hash.toLowerCase();
      const lowerPath = path.toLowerCase();
      const lowerSearch = search.toLowerCase();

      if (lowerHash === "#admin" || lowerPath.endsWith("/admin") || lowerSearch.includes("admin=true")) {
        setCurrentView("admin");
        return;
      }
      if (lowerHash === "#status" || lowerPath.endsWith("/status") || lowerPath.endsWith("/check-booking") || lowerSearch.includes("check-booking")) {
        setCurrentView("status");
        return;
      }

      const explicitTripId = getExplicitTripIdentifier();
      if (explicitTripId) {
        // EXPLICIT TRIP IDENTIFIER -> DETAIL VIEW
        handleSelectTrip(explicitTripId);
      } else {
        // NO TRIP IDENTIFIER -> MUST SHOW OPEN TRIP LIST!
        setCurrentView("trips");
        setSelectedTripId("");
        setSelectedTripSlug("");
        setActiveTripOverride(null);
        setDetailError("");
        try {
          sessionStorage.removeItem("sj_selected_trip_id");
          sessionStorage.removeItem("sj_selected_trip_slug");
          sessionStorage.setItem("sj_sharetour_view", "trips");
        } catch {}
      }
    };

    handleUrlRouting();
    window.addEventListener("hashchange", handleUrlRouting);
    window.addEventListener("popstate", handleUrlRouting);
    return () => {
      window.removeEventListener("hashchange", handleUrlRouting);
      window.removeEventListener("popstate", handleUrlRouting);
    };
  }, [handleSelectTrip]);

  // Auto-recovery: If an error is present, periodically probe every 15s in background
  useEffect(() => {
    if (!errorMsg) return;

    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "hidden") {
        console.log("[ShareTour Auto-Recovery] Probing database connection...");
        refreshDatabase(false, true);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [errorMsg, refreshDatabase]);

  // Priority lookup for activeTrip:
  // 1. activeTripOverride matching selectedTripId (trip.id is primary)
  // 2. id matching in trips (trip.id is primary)
  // 3. slug matching in trips
  // 4. activeTripOverride fallback
  const activeTrip: Trip | undefined = 
    (selectedTripId && activeTripOverride && activeTripOverride.id === selectedTripId ? activeTripOverride : undefined) ||
    (selectedTripId ? trips.find((t) => t.id === selectedTripId) : undefined) ||
    (selectedTripSlug ? trips.find((t) => t.slug === selectedTripSlug || t.id === selectedTripSlug) : undefined) ||
    (selectedTripId ? trips.find((t) => t.slug === selectedTripId) : undefined) ||
    (activeTripOverride || undefined);

  // Fallback: If in trip-detail view but activeTrip is not found in state, fetch /api/trips/:id
  useEffect(() => {
    if (currentView === "trip-detail" && !activeTrip && (selectedTripId || selectedTripSlug)) {
      // Use selectedTripId as primary identifier for server lookup
      const targetIdentifier = selectedTripId || selectedTripSlug;
      let isMounted = true;
      setIsLoadingDetail(true);
      setDetailError("");

      fetchTripById(targetIdentifier)
        .then((fetchedTrip) => {
          if (!isMounted) return;
          if (fetchedTrip) {
            setActiveTripOverride(fetchedTrip);
            setSelectedTripId(fetchedTrip.id);
            setSelectedTripSlug(fetchedTrip.slug || fetchedTrip.id);
            setTrips((prev) => {
              if (prev.some((t) => t.id === fetchedTrip.id)) return prev;
              return [fetchedTrip, ...prev];
            });
          } else {
            setDetailError("Tour tidak ditemukan atau sudah tidak aktif.");
          }
        })
        .catch((err) => {
          if (!isMounted) return;
          setDetailError(err?.message || "Gagal memuat detail paket Open Trip dari database.");
        })
        .finally(() => {
          if (isMounted) setIsLoadingDetail(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [currentView, activeTrip, selectedTripId, selectedTripSlug]);

  // Ensure batches for the activeTrip are loaded if not already present
  useEffect(() => {
    if (activeTrip && activeTrip.id) {
      const existing = batches.filter(
        (b) => b.tripId === activeTrip.id || (activeTrip.slug && b.tripId === activeTrip.slug)
      );
      if (existing.length === 0) {
        fetchBatches(activeTrip.id)
          .then((newBatches) => {
            if (Array.isArray(newBatches) && newBatches.length > 0) {
              setBatches((prev) => {
                const existingIds = new Set(prev.map((b) => b.id));
                const toAdd = newBatches.filter((b) => !existingIds.has(b.id));
                return [...prev, ...toAdd];
              });
            }
          })
          .catch(() => {});
      }
    }
  }, [activeTrip?.id, activeTrip?.slug]);

  const handleSelectBatchToBook = (batchId: string, nationalityType?: 'WNI' | 'WNA' | 'WNA_CHINA' | 'WNA_EUROPE' | null) => {
    setSelectedBatchId(batchId);
    setSelectedNationality(nationalityType ?? null);
    setCurrentView("book");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBookingCompleted = (booking: Booking) => {
    setRecentlyBooked(booking);
    setBookings((prev) => [booking, ...prev]);
    // Soft reload database from server to align quota decrements
    refreshDatabase();
    setCurrentView("success");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleAdminSuccess = (token: string) => {
    setAdminToken(token);
    localStorage.setItem("smart_journey_admin_token", token);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleAdminLogout = () => {
    setAdminToken("");
    localStorage.removeItem("smart_journey_admin_token");
    setCurrentView("trips");
  };

  const activeBatch = batches.find((b) => b.id === selectedBatchId);
  const isAdminView = currentView === "admin";

  return (
    <div className={`flex flex-col min-h-screen ${isAdminView ? "bg-[#F8FAFC]" : "bg-[#F4F7F5]"}`} id="smart-journey-root-app">
      {/* Main Container Core Router */}
      <main className={isAdminView ? "flex-1 w-full pt-20" : "flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6"}>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4" id="db-loading-spinner">
            <RefreshCw className="w-10 h-10 text-[#315B4F] animate-spin" />
            <p className="text-sm font-sans font-medium text-gray-600">
              {retryCount > 0
                ? `Menghubungkan ke database Share Tour (Percobaan ${retryCount}/${RETRY_DELAYS.length})...`
                : "Synchronizing Smart Journey Open Trips Database..."}
            </p>
          </div>
        ) : errorMsg ? (
          <div className="max-w-md mx-auto bg-rose-50 border border-rose-100 p-8 rounded-2xl text-center shadow-lg space-y-4 my-10" id="db-error-panel">
            <h1 className="font-display font-bold text-rose-800 text-lg">Database Connection Error</h1>
            <p className="text-xs text-rose-700 leading-relaxed font-sans">{errorMsg}</p>
            <button
              onClick={() => { refreshDatabase(true); }}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer"
            >
              Retry Connection
            </button>
          </div>
        ) : (
          <div className="animate-fade-in relative h-full">
            
            {/* View 1: Trips Overview page */}
            {currentView === "trips" && (
              <TripListing 
                trips={trips}
                batches={batches}
                onSelectTrip={handleSelectTrip}
                onNavigateToCheckStatus={() => {
                  setCurrentView("status");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            )}

            {/* View 2: Trip Detail page - NEVER blank white screen */}
            {currentView === "trip-detail" && (
              isLoadingDetail && !activeTrip ? (
                <div className="flex flex-col items-center justify-center py-24 space-y-4">
                  <RefreshCw className="w-10 h-10 text-[#315B4F] animate-spin" />
                  <p className="text-sm font-sans font-medium text-gray-600">
                    Memuat detail paket Open Trip...
                  </p>
                </div>
              ) : activeTrip ? (
                <ShareTourErrorBoundary
                  fallback={(err, reset) => (
                    <div className="max-w-md mx-auto bg-white border border-gray-150 p-8 sm:p-10 rounded-3xl text-center shadow-lg space-y-5 my-12 animate-fade-in" id="trip-detail-boundary-fallback">
                      <div className="w-14 h-14 bg-amber-500/10 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
                        <Compass className="w-7 h-7" />
                      </div>
                      <div className="space-y-2">
                        <h2 className="text-xl font-display font-bold text-gray-900">
                          Tour tidak ditemukan
                        </h2>
                        <p className="text-xs sm:text-sm text-gray-500 leading-relaxed font-sans">
                          {err?.message || "Terjadi kendala saat menampilkan detail paket ini. Silakan kembali ke katalog Open Trip."}
                        </p>
                      </div>
                      <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
                        <button
                          onClick={() => {
                            reset();
                            handleBackToTrips();
                          }}
                          className="px-6 py-3 bg-[#315B4F] hover:bg-[#203c34] text-white font-sans font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md cursor-pointer"
                        >
                          ← Kembali
                        </button>
                      </div>
                    </div>
                  )}
                >
                  <TripDetail 
                    trip={activeTrip}
                    batches={batches}
                    onBack={handleBackToTrips}
                    onBook={handleSelectBatchToBook}
                    trips={trips}
                    onSelectTrip={handleSelectTrip}
                  />
                </ShareTourErrorBoundary>
              ) : (
                <div className="max-w-md mx-auto bg-white border border-gray-150 p-8 sm:p-10 rounded-3xl text-center shadow-lg space-y-5 my-12 animate-fade-in" id="trip-detail-fallback">
                  <div className="w-14 h-14 bg-amber-500/10 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
                    <Compass className="w-7 h-7" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-display font-bold text-gray-900">
                      Tour tidak ditemukan
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-500 leading-relaxed font-sans">
                      {detailError || "Maaf, data paket Open Trip yang Anda tuju tidak ditemukan atau sedang diperbarui oleh tim admin."}
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={handleBackToTrips}
                      className="px-6 py-3 bg-[#315B4F] hover:bg-[#203c34] text-white font-sans font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md cursor-pointer"
                    >
                      ← Kembali
                    </button>
                  </div>
                </div>
              )
            )}

            {/* View 3: Checkout / registration Form page */}
            {currentView === "book" && (
              activeTrip && activeBatch ? (
                <BookingForm 
                  trip={activeTrip}
                  batch={activeBatch}
                  bookingType="shared"
                  tourBookingType="shared"
                  nationalityType={selectedNationality}
                  onBack={() => setCurrentView("trip-detail")}
                  onSuccess={handleBookingCompleted}
                />
              ) : (
                <div className="max-w-md mx-auto bg-white border border-gray-150 p-8 sm:p-10 rounded-3xl text-center shadow-lg space-y-5 my-12 animate-fade-in">
                  <div className="w-14 h-14 bg-amber-500/10 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
                    <Compass className="w-7 h-7" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-display font-bold text-gray-900">
                      Sesi Pemesanan Tidak Ditemukan
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-500 leading-relaxed font-sans">
                      Silakan pilih paket Open Trip dan tanggal batch keberangkatan terlebih dahulu.
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={handleBackToTrips}
                      className="px-6 py-3 bg-[#315B4F] hover:bg-[#203c34] text-white font-sans font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md cursor-pointer"
                    >
                      ← Kembali ke Katalog Open Trip
                    </button>
                  </div>
                </div>
              )
            )}

            {/* View 4: Success confirmation voucher page */}
            {currentView === "success" && (
              recentlyBooked ? (
                <BookingSuccess 
                  booking={recentlyBooked}
                  onNavigateToTrips={() => {
                    setCurrentView("trips");
                    setRecentlyBooked(null);
                  }}
                  onNavigateToCheckStatus={(code, email) => {
                    setCurrentView("status");
                    setRecentlyBooked(null);
                  }}
                />
              ) : (
                <div className="max-w-md mx-auto bg-white border border-gray-150 p-8 sm:p-10 rounded-3xl text-center shadow-lg space-y-5 my-12 animate-fade-in">
                  <div className="space-y-2">
                    <h2 className="text-xl font-display font-bold text-gray-900">
                      Informasi Booking
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-500 leading-relaxed font-sans">
                      Tidak ada sesi booking aktif. Anda dapat mengecek status booking menggunakan kode booking Anda.
                    </p>
                  </div>
                  <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      onClick={() => setCurrentView("status")}
                      className="px-6 py-3 bg-[#315B4F] hover:bg-[#203c34] text-white font-sans font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md cursor-pointer"
                    >
                      Cek Status Booking
                    </button>
                    <button
                      onClick={handleBackToTrips}
                      className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-sans font-bold text-xs sm:text-sm rounded-xl transition-all cursor-pointer"
                    >
                      Katalog Open Trip
                    </button>
                  </div>
                </div>
              )
            )}

            {/* View 5: Check Status page */}
            {currentView === "status" && (
              <StatusChecker 
                prefilledCode={recentlyBooked?.bookingCode || ""}
                prefilledEmail={recentlyBooked?.email || ""}
                bookings={bookings}
                onRefreshDB={refreshDatabase}
                batches={batches}
                trips={trips}
              />
            )}

            {/* View 6: Secure admin routing door */}
            {currentView === "admin" && (
              adminToken ? (
                <AdminDashboard 
                  trips={trips}
                  batches={batches}
                  bookings={bookings}
                  onRefreshDB={refreshDatabase}
                  onLogout={handleAdminLogout}
                />
              ) : (
                <AdminLogin 
                  onSuccess={handleAdminSuccess}
                  onBack={() => setCurrentView("trips")}
                />
              )
            )}

          </div>
        )}
      </main>
    </div>
  );
}
