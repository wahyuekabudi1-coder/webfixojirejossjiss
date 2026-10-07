import { 
  GatheringPackage, 
  GatheringQuotationRequest, 
  GatheringQuotation,
  GatheringQuotationVersion
} from './types';
import { SEED_GATHERING_PACKAGES } from './gatheringData';

export const GATHERING_STORAGE_EVENT = 'sj_gathering_storage_updated';

function notifyChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(GATHERING_STORAGE_EVENT));
  }
}

// In-memory cache for ultra-fast, smooth React renders
let cachedPackages: GatheringPackage[] | null = null;
let cachedRequests: GatheringQuotationRequest[] | null = null;
let cachedQuotations: GatheringQuotation[] | null = null;

function getAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('smart_journey_admin_token') || 
                  localStorage.getItem('smartjourney_admin_token') || 
                  localStorage.getItem('sj_admin_token') || '';
    const secret = localStorage.getItem('smart_journey_admin_secret') || '';
    const role = localStorage.getItem('smart_journey_admin_role') || '';

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (secret) {
      headers['x-secret-key'] = secret;
    }
    if (role) {
      headers['x-admin-role'] = role;
    }
  }
  return headers;
}

// -------------------------------------------------------------
// Packages API & Cache
// -------------------------------------------------------------

export async function fetchGatheringPackages(includeAll = false): Promise<GatheringPackage[]> {
  try {
    const url = `/api/gathering/packages${includeAll ? '?all=true' : ''}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (res.ok) {
      const data: GatheringPackage[] = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        cachedPackages = data;
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('sj_gathering_packages', JSON.stringify(data));
          } catch {}
        }
        return data;
      }
    }
  } catch (err) {
    console.warn('Network error fetching gathering packages, using local cache:', err);
  }

  return getGatheringPackages();
}

export async function fetchGatheringPackageById(id: string): Promise<GatheringPackage | null> {
  try {
    const res = await fetch(`/api/gathering/packages/${encodeURIComponent(id)}`, {
      headers: getAuthHeaders()
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Network error fetching gathering package by id:', err);
  }
  const current = getGatheringPackages();
  return current.find(p => p.id === id || p.slug === id) || null;
}

export async function apiSaveGatheringPackage(pkg: Partial<GatheringPackage>): Promise<GatheringPackage> {
  const isUpdate = Boolean(pkg.id);
  const url = isUpdate ? `/api/gathering/packages/${encodeURIComponent(pkg.id!)}` : '/api/gathering/packages';
  const method = isUpdate ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: getAuthHeaders(),
      body: JSON.stringify(pkg)
    });
    if (res.ok) {
      const saved: GatheringPackage = await res.json();
      if (cachedPackages) {
        const idx = cachedPackages.findIndex(p => p.id === saved.id);
        if (idx >= 0) {
          cachedPackages[idx] = saved;
        } else {
          cachedPackages.unshift(saved);
        }
      }
      notifyChange();
      return saved;
    }
  } catch (err) {
    console.error('Error saving gathering package to API:', err);
  }

  // Local fallback
  const fullPkg = pkg as GatheringPackage;
  saveGatheringPackage(fullPkg);
  return fullPkg;
}

export async function apiDeleteGatheringPackage(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/gathering/packages/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (res.ok) {
      if (cachedPackages) {
        cachedPackages = cachedPackages.filter(p => p.id !== id);
      }
      deleteGatheringPackage(id);
      notifyChange();
      return true;
    }
  } catch (err) {
    console.error('Error deleting gathering package via API:', err);
  }
  deleteGatheringPackage(id);
  return true;
}

export async function apiTogglePublishPackage(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/gathering/packages/${encodeURIComponent(id)}/publish`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    if (res.ok) {
      await fetchGatheringPackages(true);
      notifyChange();
      return true;
    }
  } catch (err) {
    console.error('Error toggling publish package:', err);
  }
  return false;
}

export async function apiArchivePackage(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/gathering/packages/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    if (res.ok) {
      await fetchGatheringPackages(true);
      notifyChange();
      return true;
    }
  } catch (err) {
    console.error('Error archiving package:', err);
  }
  return false;
}

// Synchronous getter for zero-flash renders
export function getGatheringPackages(): GatheringPackage[] {
  if (cachedPackages && cachedPackages.length > 0) {
    return cachedPackages;
  }
  if (typeof window === 'undefined') return SEED_GATHERING_PACKAGES;
  try {
    const raw = localStorage.getItem('sj_gathering_packages');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        cachedPackages = parsed;
        return parsed;
      }
    }
  } catch {}
  cachedPackages = SEED_GATHERING_PACKAGES;
  return SEED_GATHERING_PACKAGES;
}

export function saveGatheringPackage(pkg: GatheringPackage): void {
  const current = getGatheringPackages();
  const existingIdx = current.findIndex(p => p.id === pkg.id);
  let updated: GatheringPackage[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = { ...pkg, updatedAt: new Date().toISOString() };
  } else {
    updated = [pkg, ...current];
  }
  cachedPackages = updated;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('sj_gathering_packages', JSON.stringify(updated));
    } catch {}
  }
  notifyChange();
}

export function deleteGatheringPackage(id: string): void {
  const current = getGatheringPackages();
  const filtered = current.filter(p => p.id !== id);
  cachedPackages = filtered;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('sj_gathering_packages', JSON.stringify(filtered));
    } catch {}
  }
  notifyChange();
}

// -------------------------------------------------------------
// Quotation Requests API & Cache
// -------------------------------------------------------------

export async function fetchGatheringRequests(): Promise<GatheringQuotationRequest[]> {
  try {
    const res = await fetch('/api/gathering/requests', { headers: getAuthHeaders() });
    if (res.ok) {
      const data: GatheringQuotationRequest[] = await res.json();
      if (Array.isArray(data)) {
        cachedRequests = data;
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('sj_gathering_quotation_requests', JSON.stringify(data));
          } catch {}
        }
        return data;
      }
    }
  } catch (err) {
    console.warn('Network error fetching requests from API:', err);
  }
  return getGatheringQuotationRequests();
}

export async function apiCreateGatheringRequest(
  data: Omit<GatheringQuotationRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>
): Promise<GatheringQuotationRequest> {
  try {
    const res = await fetch('/api/gathering/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      const created: GatheringQuotationRequest = await res.json();
      if (cachedRequests) {
        cachedRequests.unshift(created);
      }
      notifyChange();
      return created;
    }
  } catch (err) {
    console.error('Error creating gathering request via API:', err);
  }

  // Fallback
  return addGatheringQuotationRequest(data);
}

export async function apiUpdateRequestStatus(
  id: string,
  status: GatheringQuotationRequest['status']
): Promise<boolean> {
  try {
    const res = await fetch(`/api/gathering/requests/${encodeURIComponent(id)}/status`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      updateGatheringQuotationRequestStatus(id, status);
      return true;
    }
  } catch (err) {
    console.error('Error updating request status via API:', err);
  }
  updateGatheringQuotationRequestStatus(id, status);
  return true;
}

export function getGatheringQuotationRequests(): GatheringQuotationRequest[] {
  if (cachedRequests) return cachedRequests;
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('sj_gathering_quotation_requests');
    if (raw) {
      cachedRequests = JSON.parse(raw);
      return cachedRequests || [];
    }
  } catch {}
  return [];
}

export function addGatheringQuotationRequest(
  data: Omit<GatheringQuotationRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>
): GatheringQuotationRequest {
  const id = `GQR-${Date.now().toString().slice(-6)}`;
  const now = new Date().toISOString();
  const newRequest: GatheringQuotationRequest = {
    ...data,
    id,
    status: 'REQUESTED',
    createdAt: now,
    updatedAt: now
  };
  const current = getGatheringQuotationRequests();
  const updated = [newRequest, ...current];
  cachedRequests = updated;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('sj_gathering_quotation_requests', JSON.stringify(updated));
    } catch {}
  }
  notifyChange();
  return newRequest;
}

export function updateGatheringQuotationRequestStatus(
  id: string,
  status: GatheringQuotationRequest['status']
): void {
  const current = getGatheringQuotationRequests();
  const updated = current.map(r => r.id === id ? { ...r, status, updatedAt: new Date().toISOString() } : r);
  cachedRequests = updated;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('sj_gathering_quotation_requests', JSON.stringify(updated));
    } catch {}
  }
  notifyChange();
}

// -------------------------------------------------------------
// Quotations API & Cache
// -------------------------------------------------------------

export async function fetchGatheringQuotations(): Promise<GatheringQuotation[]> {
  try {
    const res = await fetch('/api/gathering/quotations', { headers: getAuthHeaders() });
    if (res.ok) {
      const data: GatheringQuotation[] = await res.json();
      if (Array.isArray(data)) {
        cachedQuotations = data;
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('sj_gathering_quotations', JSON.stringify(data));
          } catch {}
        }
        return data;
      }
    }
  } catch (err) {
    console.warn('Network error fetching quotations from API:', err);
  }
  return getGatheringQuotations();
}

export async function fetchGatheringQuotationById(id: string, token?: string): Promise<GatheringQuotation | null> {
  try {
    const url = `/api/gathering/quotations/${encodeURIComponent(id)}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Network error fetching quotation by id:', err);
  }
  const current = getGatheringQuotations();
  return current.find(q => q.id === id || q.quotationNumber === id) || null;
}

export async function apiCreateGatheringQuotation(data: any): Promise<GatheringQuotation> {
  try {
    const res = await fetch('/api/gathering/quotations', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    if (res.ok) {
      const created: GatheringQuotation = await res.json();
      if (cachedQuotations) {
        cachedQuotations.unshift(created);
      }
      notifyChange();
      return created;
    }
  } catch (err) {
    console.error('Error creating quotation via API:', err);
  }
  // Fallback
  saveGatheringQuotation(data);
  return data;
}

export async function apiCreateQuotationVersion(quotationId: string, data: any): Promise<GatheringQuotation> {
  try {
    const res = await fetch(`/api/gathering/quotations/${encodeURIComponent(quotationId)}/versions`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    if (res.ok) {
      const updated: GatheringQuotation = await res.json();
      if (cachedQuotations) {
        const idx = cachedQuotations.findIndex(q => q.id === quotationId);
        if (idx >= 0) cachedQuotations[idx] = updated;
      }
      notifyChange();
      return updated;
    }
  } catch (err) {
    console.error('Error creating quotation version via API:', err);
  }
  throw new Error('Gagal memperbarui versi quotation ke database server.');
}

export async function apiApproveGatheringQuotation(
  quotationId: string,
  token?: string
): Promise<{ success: boolean; booking: any; quotation: GatheringQuotation; alreadyApproved?: boolean; message?: string }> {
  const res = await fetch(`/api/gathering/quotations/${encodeURIComponent(quotationId)}/approve`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ token })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Gagal menyetujui quotation di server.');
  }

  const result = await res.json();
  // Update local cache
  if (result.quotation && cachedQuotations) {
    const idx = cachedQuotations.findIndex(q => q.id === quotationId);
    if (idx >= 0) cachedQuotations[idx] = result.quotation;
  }
  notifyChange();
  return result;
}

export async function apiRevisionGatheringQuotation(
  quotationId: string,
  revisionNotes: string,
  token?: string
): Promise<boolean> {
  const res = await fetch(`/api/gathering/quotations/${encodeURIComponent(quotationId)}/revision`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ revisionNotes, token })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Gagal mengirim catatan revisi ke server.');
  }

  const result = await res.json();
  notifyChange();
  return result.success;
}

export function getGatheringQuotations(): GatheringQuotation[] {
  if (cachedQuotations) return cachedQuotations;
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('sj_gathering_quotations');
    if (raw) {
      cachedQuotations = JSON.parse(raw);
      return cachedQuotations || [];
    }
  } catch {}
  return [];
}

export function saveGatheringQuotation(quotation: GatheringQuotation): void {
  const current = getGatheringQuotations();
  const existingIdx = current.findIndex(q => q.id === quotation.id);
  let updated: GatheringQuotation[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = { ...quotation, updatedAt: new Date().toISOString() };
  } else {
    updated = [quotation, ...current];
  }
  cachedQuotations = updated;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('sj_gathering_quotations', JSON.stringify(updated));
    } catch {}
  }

  if (quotation.requestId) {
    updateGatheringQuotationRequestStatus(quotation.requestId, 'QUOTED');
  }

  notifyChange();
}

export function updateGatheringQuotationStatus(
  id: string, 
  status: GatheringQuotation['status'],
  bookingId?: string
): void {
  const current = getGatheringQuotations();
  const updated = current.map(q => {
    if (q.id === id) {
      return { 
        ...q, 
        status, 
        ...(bookingId ? { bookingId } : {}),
        updatedAt: new Date().toISOString() 
      };
    }
    return q;
  });
  cachedQuotations = updated;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('sj_gathering_quotations', JSON.stringify(updated));
    } catch {}
  }
  notifyChange();
}
