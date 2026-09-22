import type {
  Tour,
  OperationalCity,
  RentalLocation,
  RentalCategory,
  RentalVehicle,
  RentalAddon,
  ZonePricing,
  Airport,
  AirportRoute,
  TaxiMasterArea,
  TaxiMasterDestination,
  TaxiPricingRule,
  TaxiAreaRule,
  TaxiImportHistory
} from '../types.ts';

export interface TimeSchedule {
  time: string;
  activity: string;
}

export interface ItineraryItem {
  day: number;
  title: string;
  description: string;
  timeSchedules: TimeSchedule[];
  activity?: string; // backward compatibility
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface Trip {
  id: string;
  title: string;
  slug: string;
  location: string;
  duration: string;
  days?: number;
  nights?: number;
  category?: 'Adventure' | 'Nature' | 'Culture' | 'City' | string;
  experienceCategory?: 'Adventure' | 'Nature' | 'Culture' | 'City' | string;
  description: string;
  coverImage: string;
  included: string[];
  excluded: string[];
  itinerary: ItineraryItem[];
  startingPrice: number; // WNA price in USD
  wnaStartingPrice?: number;
  wniStartingPrice?: number; // WNI price in IDR
  startingPriceIDR?: number; // explicit alias for wniStartingPrice
  highlight?: string;
  faq?: FAQItem[];
  gallery?: string[];
  whatsToBring?: string[];
  status?: "draft" | "published";
  price?: number;
  wnaPrice?: number;
  wniPrice?: number;
}

export interface Batch {
  id: string;
  tripId: string;
  departureDate: string; // e.g., "2026-07-15"
  quota: number;
  availableSeats: number;
  price: number;
  wnaPrice?: number;
  status: 'Open' | 'Closed';
}

export type BookingStatus = 'Pending' | 'Pending Confirmation' | 'Confirmed' | 'Completed' | 'Rejected' | 'Cancelled' | string;
export type NationalityType = 'WNI' | 'WNA' | 'WNA_CHINA' | 'WNA_EUROPE';

export interface ParticipantData {
  name: string;
  englishName?: string;
  weChatId?: string;
  xiaoHongShuId?: string;
  city?: string;
  whatsapp?: string;
  email: string;
  flightNumber?: string;
  nationalityType?: NationalityType;
  pickupLocation?: string;
  dropoffLocation?: string;
  paymentMethod?: string;
  specialRequests?: string;
  members?: Array<{ name?: string; fullName?: string; nationality?: string; country?: string }>;
}

export type TourBookingType = 'private' | 'shared';

export interface Booking {
  id: string;
  bookingCode: string;
  serviceType?: string;
  serviceId?: string;
  tripId: string;
  tripTitle?: string;
  bookingType?: 'private' | 'shared';
  tourBookingType?: 'private' | 'shared';
  batchId?: string | null;
  departureDate?: string;
  fullName: string;
  email: string;
  phone: string;
  participantsCount: number;
  participantsNames: string[];
  participantsManifest?: Array<{ name?: string; fullName?: string; nationality?: string }>;
  proofOfPayment: string; // base64 or file name / "NOT_APPLICABLE_PREVIEW"
  status: BookingStatus;
  paymentStatus?: string;
  paymentIntentId?: string;
  paymentId?: string;
  checkoutUrl?: string;
  paidAt?: string;
  confirmedAt?: string;
  verificationHash?: string;
  totalPriceIDR?: number;
  baseAmount?: number;
  uniqueCode?: number;
  paymentAmount?: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  serviceName?: string;
  type?: string;
  details?: any;
  rejectReason?: string;
  totalPrice: number;
  createdAt: string;
  participantData?: ParticipantData;
  tourSnapshot?: {
    tourId?: string;
    tourName?: string;
    packageName?: string;
    duration?: string;
    vehicleName?: string;
    startingPriceIDR?: number;
    highlights?: string[];
    itinerary?: string[] | any[];
  };
  adminNotes?: string;
  paymentNotes?: string;
  nationalityType?: NationalityType | string;
  items?: any[];
  lineItems?: any[];
  discount?: number;
  invoiceNumber?: string;
  paymentProvider?: string;
  currency?: string;
  notes?: string;
  specialRequests?: string;
}

export interface DatabaseState {
  trips: Trip[];
  batches: Batch[];
  bookings: Booking[];
  mainTours?: Tour[];
  rentals?: {
    cities: OperationalCity[];
    locations: RentalLocation[];
    categories: RentalCategory[];
    vehicles: RentalVehicle[];
    addons: RentalAddon[];
    zonePricing: ZonePricing[];
  };
  airportTransfers?: {
    airports: Airport[];
    routes: AirportRoute[];
  };
  taxiServices?: {
    masterAreas: TaxiMasterArea[];
    destinations: TaxiMasterDestination[];
    pricingRules: TaxiPricingRule[];
    areaRules: TaxiAreaRule[];
    importHistory: TaxiImportHistory[];
  };
  schedules?: any[];
  reviews?: any[];
  serviceLimits?: {
    tour?: number;
    airport?: number;
    taxi?: number;
    rental?: number;
  };
}

