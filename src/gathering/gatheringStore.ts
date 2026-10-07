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

// In-memory cache populated from backend API for zero-lag React rendering
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
// Packages API (Authoritative Server Single Source of Truth)
// -------------------------------------------------------------

export async function fetchGatheringPackages(includeAll = false): Promise<GatheringPackage[]> {
  try {
    const url = `/api/gathering/packages${includeAll ? '?all=true' : ''}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (res.ok) {
      const data: GatheringPackage[] = await res.json();
      if (Array.isArray(data)) {
        cachedPackages = data;
        notifyChange();
        return data;
      }
    }
  } catch (err) {
    console.warn('[GatheringStore] Error fetching packages from server:', err);
  }

  return cachedPackages || SEED_GATHERING_PACKAGES;
}

export async function fetchGatheringPackageById(id: string): Promise<GatheringPackage | null> {
  try {
    const res = await fetch(`/api/gathering/packages/${encodeURIComponent(id)}`, {
      headers: getAuthHeaders()
    });
    if (res.ok) {
      return await res.json();
    }
    if (res.status === 404) {
      return null;
    }
  } catch (err) {
    console.warn('[GatheringStore] Error fetching package by id from server:', err);
  }
  const current = getGatheringPackages();
  return current.find(p => p.id === id || p.slug === id) || null;
}

export async function apiSaveGatheringPackage(pkg: Partial<GatheringPackage>): Promise<GatheringPackage> {
  const isUpdate = Boolean(pkg.id);
  const url = isUpdate ? `/api/gathering/packages/${encodeURIComponent(pkg.id!)}` : '/api/gathering/packages';
  const method = isUpdate ? 'PUT' : 'POST';

  const res = await fetch(url, {
    method,
    headers: getAuthHeaders(),
    body: JSON.stringify(pkg)
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Gagal menyimpan paket gathering ke database backend.');
  }

  const saved: GatheringPackage = await res.json();
  if (cachedPackages) {
    const idx = cachedPackages.findIndex(p => p.id === saved.id);
    if (idx >= 0) {
      cachedPackages[idx] = saved;
    } else {
      cachedPackages.unshift(saved);
    }
  } else {
    cachedPackages = [saved];
  }

  notifyChange();
  return saved;
}

export async function apiDeleteGatheringPackage(id: string): Promise<boolean> {
  const res = await fetch(`/api/gathering/packages/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Gagal menghapus paket gathering via API.');
  }

  if (cachedPackages) {
    cachedPackages = cachedPackages.filter(p => p.id !== id);
  }
  notifyChange();
  return true;
}

export async function apiTogglePublishPackage(id: string): Promise<boolean> {
  const res = await fetch(`/api/gathering/packages/${encodeURIComponent(id)}/publish`, {
    method: 'POST',
    headers: getAuthHeaders()
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Gagal mengubah status publish paket gathering.');
  }

  await fetchGatheringPackages(true);
  notifyChange();
  return true;
}

export async function apiArchivePackage(id: string): Promise<boolean> {
  const res = await fetch(`/api/gathering/packages/${encodeURIComponent(id)}/archive`, {
    method: 'POST',
    headers: getAuthHeaders()
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Gagal mengarsipkan paket gathering.');
  }

  await fetchGatheringPackages(true);
  notifyChange();
  return true;
}

// Synchronous getter from in-memory cache for fast UI rendering
export function getGatheringPackages(): GatheringPackage[] {
  if (cachedPackages && cachedPackages.length > 0) {
    return cachedPackages;
  }
  return SEED_GATHERING_PACKAGES;
}

// Backward-compatible delegates that write to server
export function saveGatheringPackage(pkg: GatheringPackage): void {
  apiSaveGatheringPackage(pkg).catch(err => {
    console.error('[GatheringStore] Error saving package:', err);
  });
}

export function deleteGatheringPackage(id: string): void {
  apiDeleteGatheringPackage(id).catch(err => {
    console.error('[GatheringStore] Error deleting package:', err);
  });
}

// -------------------------------------------------------------
// Quotation Requests API (Authoritative Server Single Source of Truth)
// -------------------------------------------------------------

export async function fetchGatheringRequests(): Promise<GatheringQuotationRequest[]> {
  try {
    const res = await fetch('/api/gathering/requests', { headers: getAuthHeaders() });
    if (res.ok) {
      const data: GatheringQuotationRequest[] = await res.json();
      if (Array.isArray(data)) {
        cachedRequests = data;
        notifyChange();
        return data;
      }
    }
  } catch (err) {
    console.warn('[GatheringStore] Error fetching requests from API:', err);
  }
  return cachedRequests || [];
}

export async function apiCreateGatheringRequest(
  data: Omit<GatheringQuotationRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>
): Promise<GatheringQuotationRequest> {
  const res = await fetch('/api/gathering/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Gagal mengirim permintaan penawaran ke server.');
  }

  const created: GatheringQuotationRequest = await res.json();
  if (cachedRequests) {
    cachedRequests.unshift(created);
  } else {
    cachedRequests = [created];
  }
  notifyChange();
  return created;
}

export async function apiUpdateRequestStatus(
  id: string,
  status: GatheringQuotationRequest['status']
): Promise<boolean> {
  const res = await fetch(`/api/gathering/requests/${encodeURIComponent(id)}/status`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ status })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Gagal memperbarui status permintaan.');
  }

  if (cachedRequests) {
    cachedRequests = cachedRequests.map(r => r.id === id ? { ...r, status, updatedAt: new Date().toISOString() } : r);
  }
  notifyChange();
  return true;
}

export function getGatheringQuotationRequests(): GatheringQuotationRequest[] {
  return cachedRequests || [];
}

// Backward-compatible delegates
export function addGatheringQuotationRequest(
  data: Omit<GatheringQuotationRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>
): GatheringQuotationRequest {
  const optimisticId = `EGR-${Date.now().toString().slice(-6)}`;
  const optimistic: GatheringQuotationRequest = {
    ...data,
    id: optimisticId,
    status: 'REQUESTED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  apiCreateGatheringRequest(data).catch(err => {
    console.error('[GatheringStore] Error submitting request:', err);
  });

  return optimistic;
}

export function updateGatheringQuotationRequestStatus(
  id: string,
  status: GatheringQuotationRequest['status']
): void {
  apiUpdateRequestStatus(id, status).catch(err => {
    console.error('[GatheringStore] Error updating request status:', err);
  });
}

// -------------------------------------------------------------
// Quotations API (Authoritative Server Single Source of Truth)
// -------------------------------------------------------------

export async function fetchGatheringQuotations(): Promise<GatheringQuotation[]> {
  try {
    const res = await fetch('/api/gathering/quotations', { headers: getAuthHeaders() });
    if (res.ok) {
      const data: GatheringQuotation[] = await res.json();
      if (Array.isArray(data)) {
        cachedQuotations = data;
        notifyChange();
        return data;
      }
    }
  } catch (err) {
    console.warn('[GatheringStore] Error fetching quotations from API:', err);
  }
  return cachedQuotations || [];
}

export async function fetchGatheringQuotationById(id: string, token?: string): Promise<GatheringQuotation | null> {
  const url = `/api/gathering/quotations/${encodeURIComponent(id)}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (res.ok) {
    const data = await res.json();
    return data;
  }
  if (res.status === 403) {
    throw new Error('Akses ditolak: Token verifikasi tidak cocok dengan penawaran ini.');
  }
  if (res.status === 401) {
    throw new Error('Akses ditolak: Membutuhkan Token Akses Customer atau Sesi Admin.');
  }
  return null;
}

export async function apiCreateGatheringQuotation(data: any): Promise<GatheringQuotation> {
  const res = await fetch('/api/gathering/quotations', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Gagal menerbitkan quotation ke database backend.');
  }

  const created: GatheringQuotation = await res.json();
  if (cachedQuotations) {
    cachedQuotations.unshift(created);
  } else {
    cachedQuotations = [created];
  }
  notifyChange();
  return created;
}

export async function apiCreateQuotationVersion(quotationId: string, data: any): Promise<GatheringQuotation> {
  const res = await fetch(`/api/gathering/quotations/${encodeURIComponent(quotationId)}/versions`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Gagal membuat versi quotation baru di database server.');
  }

  const updated: GatheringQuotation = await res.json();
  if (cachedQuotations) {
    const idx = cachedQuotations.findIndex(q => q.id === quotationId);
    if (idx >= 0) cachedQuotations[idx] = updated;
  }
  notifyChange();
  return updated;
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
  if (cachedQuotations) {
    const idx = cachedQuotations.findIndex(q => q.id === quotationId);
    if (idx >= 0) {
      cachedQuotations[idx] = { ...cachedQuotations[idx], status: 'REVISION_REQUESTED' };
    }
  }
  notifyChange();
  return result.success;
}

export function getGatheringQuotations(): GatheringQuotation[] {
  return cachedQuotations || [];
}

// Backward-compatible delegates
export function saveGatheringQuotation(quotation: GatheringQuotation): void {
  apiCreateGatheringQuotation(quotation).catch(err => {
    console.error('[GatheringStore] Error saving quotation:', err);
  });
}

export function updateGatheringQuotationStatus(
  id: string, 
  status: GatheringQuotation['status'],
  bookingId?: string
): void {
  // If status is approved/confirmed with bookingId, this is handled through apiApproveGatheringQuotation
  if (cachedQuotations) {
    cachedQuotations = cachedQuotations.map(q => q.id === id ? { ...q, status, ...(bookingId ? { bookingId } : {}) } : q);
    notifyChange();
  }
}
