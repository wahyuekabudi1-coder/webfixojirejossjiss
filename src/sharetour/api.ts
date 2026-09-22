import { DatabaseState, Trip, Batch, Booking } from "./types";

const API_BASE = "/api";

export function recalculateBatchSeats(db: DatabaseState): DatabaseState {
  if (!db || !db.batches) return db;
  if (!db.bookings) db.bookings = [];

  db.batches.forEach((batch) => {
    const activeBookings = db.bookings.filter(
      (b) => Boolean(b.batchId) && b.batchId === batch.id && b.status !== "Rejected"
    );
    const totalBooked = activeBookings.reduce(
      (sum, b) => sum + (Number(b.participantsCount) || 1),
      0
    );
    const quota = Number(batch.quota) || 12;
    batch.availableSeats = Math.max(0, quota - totalBooked);

    if (batch.availableSeats <= 0) {
      batch.status = "Closed";
    } else if (batch.status === "Closed" && batch.availableSeats > 0) {
      batch.status = "Open";
    }
  });

  return db;
}

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== "undefined"
    ? (localStorage.getItem("smart_journey_admin_token") || localStorage.getItem("smartjourney_admin_token") || "")
    : "";
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export async function fetchDB(retries = 2, initialDelayMs = 800, signal?: AbortSignal): Promise<DatabaseState> {
  let attempt = 0;
  let lastError: any = null;

  while (attempt <= retries) {
    if (signal?.aborted) {
      throw new Error("Aborted");
    }

    try {
      // 1. Fetch public trips and batches in parallel (no admin authorization required for customers)
      const [resTrips, resBatches] = await Promise.all([
        fetch(`${API_BASE}/trips`, { signal }),
        fetch(`${API_BASE}/batches`, { signal })
      ]);

      if (!resTrips.ok) {
        if (resTrips.status === 502 || resTrips.status === 503 || resTrips.status === 504) {
          throw new Error(`Server starting up (${resTrips.status})`);
        }
        const errText = await resTrips.text().catch(() => "");
        throw new Error(`Failed to load trips (${resTrips.status}): ${errText || resTrips.statusText}`);
      }

      if (!resBatches.ok) {
        if (resBatches.status === 502 || resBatches.status === 503 || resBatches.status === 504) {
          throw new Error(`Server starting up (${resBatches.status})`);
        }
        const errText = await resBatches.text().catch(() => "");
        throw new Error(`Failed to load batches (${resBatches.status}): ${errText || resBatches.statusText}`);
      }

      const tripsData = await resTrips.json().catch(() => null);
      const batchesData = await resBatches.json().catch(() => null);

      if (!Array.isArray(tripsData)) {
        throw new Error("Invalid response from server: trips must be an array");
      }
      if (!Array.isArray(batchesData)) {
        throw new Error("Invalid response from server: batches must be an array");
      }

      // 2. Fetch bookings only if admin token is available
      let bookings: Booking[] = [];
      const token = typeof window !== "undefined"
        ? (localStorage.getItem("smart_journey_admin_token") || localStorage.getItem("smartjourney_admin_token") || "")
        : "";

      if (token) {
        try {
          const resBookings = await fetch(`${API_BASE}/bookings`, {
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            signal
          });
          if (resBookings.ok) {
            const bookingsData = await resBookings.json().catch(() => null);
            if (Array.isArray(bookingsData)) {
              bookings = bookingsData;
            }
          }
        } catch {
          // If bookings fetch fails (e.g. non-admin or expired session), bookings safely remains []
        }
      }

      const dbState: DatabaseState = {
        trips: tripsData,
        batches: batchesData,
        bookings
      };

      return recalculateBatchSeats(dbState);
    } catch (err: any) {
      if (err.name === "AbortError" || signal?.aborted) {
        throw err;
      }
      lastError = err;
      if (attempt < retries) {
        const delay = initialDelayMs * Math.pow(1.5, attempt);
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            if (signal) signal.removeEventListener("abort", onAbort);
            resolve();
          }, delay);
          const onAbort = () => {
            clearTimeout(timer);
            reject(new Error("Aborted"));
          };
          if (signal) {
            signal.addEventListener("abort", onAbort, { once: true });
          }
        });
        attempt++;
      } else {
        break;
      }
    }
  }

  throw lastError || new Error("Failed to connect to ShareTour server database.");
}

export async function fetchTrips(retries = 2, signal?: AbortSignal): Promise<Trip[]> {
  let attempt = 0;
  let lastErr: any = null;
  while (attempt <= retries) {
    if (signal?.aborted) throw new Error("Aborted");
    try {
      const res = await fetch(`${API_BASE}/trips`, { signal });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          return data;
        }
        throw new Error("Invalid response format: expected array of trips");
      }
      throw new Error(`Failed to load trips (HTTP ${res.status})`);
    } catch (err: any) {
      if (err.name === "AbortError" || signal?.aborted) throw err;
      lastErr = err;
    }
    attempt++;
    if (attempt <= retries) {
      await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
    }
  }
  throw lastErr || new Error("Failed to fetch trips from server");
}

export async function fetchBatches(tripId?: string, retries = 2, signal?: AbortSignal): Promise<Batch[]> {
  let attempt = 0;
  let lastErr: any = null;
  const url = tripId ? `${API_BASE}/batches?tripId=${encodeURIComponent(tripId)}` : `${API_BASE}/batches`;
  while (attempt <= retries) {
    if (signal?.aborted) throw new Error("Aborted");
    try {
      const res = await fetch(url, { signal });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          return data;
        }
        throw new Error("Invalid response format: expected array of batches");
      }
      throw new Error(`Failed to load batches (HTTP ${res.status})`);
    } catch (err: any) {
      if (err.name === "AbortError" || signal?.aborted) throw err;
      lastErr = err;
    }
    attempt++;
    if (attempt <= retries) {
      await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
    }
  }
  throw lastErr || new Error("Failed to fetch batches from server");
}

export async function saveDB(db: Partial<DatabaseState>): Promise<void> {
  // Never call POST /api/db. Instead, use the authoritative /api/import-bulk endpoint if bulk saving is needed.
  if (db.trips || db.batches) {
    await importBulk({
      trips: db.trips || [],
      batches: db.batches || [],
      mode: "overwrite"
    });
  }
}

export async function createTrip(trip: Omit<Trip, "id">): Promise<Trip> {
  const res = await fetch(`${API_BASE}/trips`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(trip),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
    throw new Error(errData.error || `Failed to create trip on server database (Status ${res.status})`);
  }
  const serverTrip: Trip = await res.json();
  return serverTrip;
}

export async function updateTrip(id: string, trip: Partial<Trip>): Promise<Trip> {
  const res = await fetch(`${API_BASE}/trips/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(trip),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
    throw new Error(errData.error || `Failed to update trip on server database (Status ${res.status})`);
  }
  const updated: Trip = await res.json();
  return updated;
}

export async function deleteTrip(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/trips/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
    throw new Error(errData.error || `Failed to delete trip from server database (Status ${res.status})`);
  }
}

export async function createBatch(batch: Omit<Batch, "id">): Promise<Batch> {
  const res = await fetch(`${API_BASE}/batches`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(batch),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
    throw new Error(errData.error || `Failed to create batch on server database (Status ${res.status})`);
  }
  const serverBatch: Batch = await res.json();
  return serverBatch;
}

export async function updateBatch(id: string, batch: Partial<Batch>): Promise<Batch> {
  const res = await fetch(`${API_BASE}/batches/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(batch),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
    throw new Error(errData.error || `Failed to update batch on server database (Status ${res.status})`);
  }
  const updated: Batch = await res.json();
  return updated;
}

export async function deleteBatch(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/batches/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
    throw new Error(errData.error || `Failed to delete batch from server database (Status ${res.status})`);
  }
}

export async function createBooking(
  booking: Omit<Booking, "id" | "bookingCode" | "status" | "createdAt" | "tripTitle" | "departureDate">
): Promise<Booking> {
  const res = await fetch(`${API_BASE}/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(booking),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
    throw new Error(errData.error || `Failed to submit booking to server (Status ${res.status})`);
  }
  const serverBooking: Booking = await res.json();
  return serverBooking;
}

export async function updateBooking(id: string, updates: Partial<Booking>): Promise<Booking> {
  const res = await fetch(`${API_BASE}/bookings/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
    throw new Error(errData.error || `Failed to update booking on server database (Status ${res.status})`);
  }
  const updated: Booking = await res.json();
  return updated;
}

export async function adminLogin(email: string, password: string): Promise<{ token: string; success: boolean }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: "Email atau password administrator tidak valid." }));
    throw new Error(errData.error || "Email atau password administrator tidak valid.");
  }
  return res.json();
}

export async function purgeAllBookings(): Promise<void> {
  const res = await fetch(`${API_BASE}/bookings/purge`, {
    method: "POST",
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
    throw new Error(errData.error || `Failed to purge bookings database (Status ${res.status})`);
  }
}

export async function importBulk(data: { trips: Trip[]; batches: Batch[]; mode: "append" | "overwrite" }): Promise<{ success: boolean; tripsCount: number; batchesCount: number }> {
  const res = await fetch(`${API_BASE}/import-bulk`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
    throw new Error(errData.error || "Failed to bulk import data into server database.");
  }
  const result = await res.json();
  return result;
}
