export interface Tour {
  id: string;
  slug?: string;
  name: string;
  description: string;
  duration: string;
  days?: number;
  nights?: number;
  startingPrice: number; // in USD (WNA Price)
  startingPriceIDR: number; // in IDR (WNI Price)
  wniPrice?: number; // explicit alias for startingPriceIDR
  wnaPrice?: number; // legacy display alias for startingPrice in USD
  wnaPriceIDR?: number; // Authoritative WNA price in IDR (Rupiah)
  rating: number;
  reviewCount: number;
  image: string;
  highlights: string[];
  itinerary: string[];
  category: 'Adventure' | 'Nature' | 'Culture' | 'City' | string;
  experienceCategory?: 'Adventure' | 'Nature' | 'Culture' | 'City' | string;
  includes?: string[];
  excludes?: string[];
  gallery?: string[];
  whatToBring?: string[];
  faq?: Array<{ question: string; answer: string; q?: string; a?: string }>;
  status?: 'published' | 'draft' | 'unpublished' | 'archived';
  createdAt?: string;
  updatedAt?: string;
}

export interface Vehicle {
  id: string;
  name: string;
  category: 'Standard' | 'Premium' | 'Family' | 'Van' | string;
  passengers: number;
  luggage: number;
  hasAC: boolean;
  pricePerDay: number; // base pricing
  pricePerDayIDR: number;
  image: string;
  description: string;
  features: string[];
}

export interface Review {
  id: string;
  name: string;
  country: string;
  rating: number;
  text: string;
  date: string;
  avatar: string;
  isLocalGuide?: boolean;
  status?: 'pending' | 'approved';
  serviceType?: 'tour' | 'airport' | 'taxi' | 'rental' | 'sharetour' | 'gathering' | string;
  serviceId?: string;
  serviceName?: string;
  bookingCode?: string;
}

export interface GooglePlaceReview {
  id: string;
  authorName: string;
  authorPhotoUrl?: string;
  authorUri?: string;
  rating: number;
  relativeTime: string;
  text: string;
  publishTime?: string;
}

export interface GoogleReviewsData {
  configured: boolean;
  status: 'connected' | 'unconfigured' | 'error' | 'empty';
  source: 'google_places' | 'google_business_profile';
  placeId?: string;
  placeName?: string;
  rating: number | null;
  userRatingsTotal: number | null;
  reviews: GooglePlaceReview[];
  googleMapsUrl: string;
  message?: string;
  lastSyncedAt?: string;
}

export interface Booking {
  id: string;
  type: 'tour' | 'airport' | 'taxi' | 'rental';
  serviceType?: 'tour' | 'airport' | 'taxi' | 'rental' | 'shared' | string;
  serviceId?: string;
  serviceName: string; // e.g., "Mount Bromo Adventure Tour" or "Juanda Airport Transfer"
  details: {
    pickupLocation?: string;
    destination?: string;
    date: string;
    time?: string;
    guests?: number;
    days?: number;
    vehicleId?: string;
    vehicleName?: string;
    returnDate?: string;
    withDriver?: boolean;
    tourId?: string;
    cityAddress?: string;
    routeType?: 'One Way' | 'Round Trip';
    direction?: 'Airport to City' | 'City to Airport';
    luggage?: number;
    returnDateText?: string;
    returnTimeText?: string;

    // Rental booking zone-based flow extensions
    operationalCity?: string;
    pickupArea?: string;
    dropoffArea?: string;
    pickupZone?: string;
    dropoffZone?: string;
    selectedAddons?: string[];
    pricingBreakdown?: {
      basePriceUSD: number;
      basePriceIDR: number;
      surchargeUSD: number;
      surchargeIDR: number;
      addonsTotalUSD: number;
      addonsTotalIDR: number;
      totalUSD: number;
      totalIDR: number;
      days: number;
      basePricePerDayUSD: number;
      basePricePerDayIDR: number;
    };
  };
  totalPrice: number;
  totalPriceIDR: number;
  totalAmount?: number;
  totalAmountIDR?: number;
  totalAmountUSD?: number;
  finalPaymentAmount?: number;
  totalPaid?: number;
  invoiceNumber?: string;
  baseAmount?: number;
  uniqueCode?: number;
  paymentAmount?: number;
  bookingCode?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  bookingDate: string;
  status: 'Pending' | 'Pending Payment' | 'Pending Confirmation' | 'Confirmed' | 'Completed' | 'Cancelled' | 'Refunded' | 'Rejected' | string;
  paymentStatus?: 'Unpaid' | 'Paid' | 'Pending' | 'Pending Payment' | 'Failed' | 'Expired' | 'Amount Mismatch' | string;
  paidAt?: string;
  confirmedAt?: string;
  paymentId?: string;
  tourSnapshot?: any;
  paymentNotes?: string;
}

export interface AirportRoute {
  id: string;
  airport: string;
  city: string;
  priceUSD: number;
  priceIDR: number;
  status: 'Published' | 'Draft';
}

export interface Airport {
  code: string;
  name: string;
  description: string;
  status: 'Active' | 'Inactive';
  surchargeUSD: number;
  surchargeIDR: number;
}

export type ActivePage = 'home' | 'tours' | 'share-tour' | 'event-gathering' | 'airport' | 'taxi' | 'partnerships' | 'contact' | 'bookings' | 'car-rental' | 'about' | 'admin' | 'blog';

export interface TaxiMasterArea {
  id: string; // e.g. "A001", "A002"
  name: string; // e.g. "Surabaya", "Malang"
  code: string; // e.g. "SUB", "MLG"
  type: 'Airport' | 'City';
  lat: number;
  lon: number;
  status: 'Active' | 'Inactive';
}

export interface TaxiMasterDestination {
  id: string; // e.g. "D001"
  area_id: string; // foreign key to TaxiMasterArea.id
  name: string; // e.g. "Stasiun Malang Kotabaru"
  lat: number;
  lon: number;
  status: 'Active' | 'Inactive';
}

export interface TaxiPricingRule {
  id: string; // e.g. "P001"
  source_id: string; // reference to TaxiMasterArea.id or TaxiMasterDestination.id
  destination_id: string; // reference to TaxiMasterArea.id or TaxiMasterDestination.id
  vehicle_type: 'Standard' | 'Premium' | 'Family' | 'Van';
  price_usd?: number; // USD display only (derived from price_idr)
  price_idr: number; // IDR (Authoritative transactional)
  status: 'Active' | 'Inactive';
}

export interface TaxiAreaRule {
  id: string; // e.g. "AR001"
  area_id: string; // foreign key to TaxiMasterArea.id
  surcharge_usd?: number; // USD display only (derived from surcharge_idr)
  surcharge_idr: number; // IDR (Authoritative transactional)
  is_blackout: boolean;
  note?: string;
}

export interface TaxiImportHistory {
  id: string;
  date: string;
  filename: string;
  importedBy: string;
  importedRows: number;
  updatedRows: number;
  skippedRows: number;
  failedRows: number;
  status: 'Success' | 'Warning' | 'Failed';
  log: string[];
}

export interface OperationalCity {
  id: string;
  name: string;
  status: 'Active' | 'Inactive';
  displayOrder: number;
}

export interface ServiceZone {
  id: string;
  cityId: string;
  name: string;
  code: string;
  description: string;
  status: 'Active' | 'Inactive';
  displayOrder: number;
}

export interface RentalLocation {
  id: string;
  cityId: string;
  name: string;
  zone: 'Zone 0' | 'Zone 1' | 'Zone 2';
  status: 'Active' | 'Inactive';
  displayOrder: number;
  notes?: string;
}

export interface RentalVehicle {
  id: string;
  name: string;
  categoryId: string;
  cityId: string;
  passengers: number;
  luggage: number;
  hasAC: boolean;
  pricePerDay?: number; // Display-only conversion preview
  pricePerDayIDR?: number; // Authoritative transactional rate in IDR
  image: string;
  description: string;
  features: string[];
  status: 'Active' | 'Inactive';
  supportedZones: string[];
}

export interface RentalCategory {
  id: string;
  name: string;
  description: string;
  displayOrder: number;
  status: 'Active' | 'Inactive';
  priceZone0USD?: number; // Display-only conversion preview
  priceZone0IDR?: number; // Authoritative transactional rate in IDR
  priceZone1USD?: number; // Display-only conversion preview
  priceZone1IDR?: number; // Authoritative transactional rate in IDR
  priceZone2USD?: number; // Display-only conversion preview
  priceZone2IDR?: number; // Authoritative transactional rate in IDR
}

export interface RentalAddon {
  id: string;
  name: string;
  description: string;
  priceUSD: number; // Display-only conversion preview
  priceIDR: number; // Authoritative transactional price in IDR
  pricingType: 'Fixed' | 'Per Day';
  status: 'Active' | 'Inactive';
  displayOrder: number;
  applicableCategories: string[];
  isRequired: boolean;
}

export interface ZonePricing {
  id: string;
  cityId: string;
  pickupZoneCode: string;
  dropoffZoneCode: string;
  priceUSD: number; // Display-only conversion preview
  priceIDR: number; // Authoritative transactional surcharge in IDR
  status: 'Active' | 'Inactive';
}



