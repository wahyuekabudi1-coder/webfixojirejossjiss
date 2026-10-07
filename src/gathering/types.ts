export interface GatheringItineraryDay {
  day: number;
  title: string;
  activities: string[];
  desc?: string;
}

export interface GatheringEstimatedPrices {
  pax60: number; // Estimated IDR per pax
  pax70: number; // Estimated IDR per pax
  pax80: number; // Estimated IDR per pax
  pax90: number; // Estimated IDR per pax
  pax90PlusNote?: string; // "Hubungi Admin"
}

export interface GatheringPackage {
  id: string;
  slug: string;
  name: string;
  title?: string; // alias
  destination: string;
  duration: string; // e.g. "2 Hari 1 Malam (2D1N)"
  days: number;
  nights: number;
  description: string;
  itinerary: GatheringItineraryDay[];
  includes: string[];
  included?: string[]; // alias
  excludes: string[];
  excluded?: string[]; // alias
  facilities: string[];
  notes: string[] | string;
  gallery: string[];
  featuredImage: string;
  image?: string; // alias
  estimatedPrices: GatheringEstimatedPrices;
  price60Pax?: number;
  price70Pax?: number;
  price80Pax?: number;
  price90Pax?: number;
  price90PlusText?: string;
  status: 'published' | 'draft' | 'archived';
  isPublished?: boolean;
  isArchived?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type GatheringPaxOption = '60' | '70' | '80' | '90' | '90+';

export interface GatheringQuotationRequest {
  id: string;
  packageId: string;
  packageName: string;
  duration?: string;
  customerName: string; // PIC
  picName?: string; // alias
  company: string; // Company / Organization
  companyName?: string; // alias
  whatsapp: string;
  email: string;
  participants: GatheringPaxOption | string;
  estimatedParticipants?: string;
  requestedDate: string;
  notes: string; // Notes / Special Requirements
  status: 'REQUESTED' | 'REVIEWING' | 'PROPOSAL_SENT' | 'REVISION_REQUESTED' | 'APPROVED' | 'REJECTED' | 'QUOTED';
  secureToken?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuotationLineItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface PackageSnapshot {
  packageId: string;
  packageName: string;
  destination: string;
  duration: string;
  itinerary: GatheringItineraryDay[];
  included: string[];
  excluded: string[];
  facilities: string[];
  notes: string;
  participantCount: number;
  eventDate: string;
  pricing?: {
    price60Pax?: number;
    price70Pax?: number;
    price80Pax?: number;
    price90Pax?: number;
    price90PlusText?: string;
  };
  lineItems: QuotationLineItem[];
  subtotal: number;
  discount: number;
  additionalCost: number;
  grandTotal: number;
}

export interface GatheringQuotationVersion {
  id: string;
  quotationId: string;
  versionNumber: number;
  itinerary: GatheringItineraryDay[];
  included: string[];
  includes?: string[];
  excluded: string[];
  excludes?: string[];
  notes: string;
  lineItems: QuotationLineItem[];
  subtotal: number;
  discount: number;
  additionalCost: number;
  grandTotal: number;
  pricePerPaxIDR?: number;
  packageSnapshot?: PackageSnapshot | null;
  revisionNotes?: string;
  createdBy: string;
  createdAt: string;
}

export interface GatheringQuotation {
  id: string;
  quotationNumber?: string;
  requestId: string;
  packageId: string;
  packageName: string;
  company: string;
  companyName?: string; // alias
  picName: string;
  customerName?: string; // alias
  whatsapp: string;
  email: string;
  participants: string; // e.g. "60 Pax" or "75 Pax"
  participantCount?: number;
  eventDate: string;
  pricePerPaxIDR: number;
  totalPriceIDR: number;
  subtotal?: number;
  discount?: number;
  additionalCost?: number;
  grandTotal?: number;
  currency?: string;
  validUntil: string;
  terms: string[];
  notes: string;
  currentVersion?: number;
  packageSnapshot?: PackageSnapshot | null;
  versions?: GatheringQuotationVersion[];
  status: 'PROPOSAL_SENT' | 'REVISION_REQUESTED' | 'APPROVED' | 'REJECTED' | 'QUOTED' | 'ACCEPTED' | 'CONFIRMED' | 'EXPIRED';
  bookingId?: string; // ID of booking when converted to confirmed order
  secureToken?: string;
  createdAt: string;
  updatedAt: string;
}
