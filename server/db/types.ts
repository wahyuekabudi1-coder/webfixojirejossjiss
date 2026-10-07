// ==============================================================================
// SMART JOURNEY DATABASE ACCESS LAYER TYPES
// ==============================================================================

export interface QueryResult<T = any> {
  rows: T[];
  affectedRows: number;
  insertId?: number | string;
}

export interface DatabaseClient {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  execute(sql: string, params?: any[]): Promise<{ affectedRows: number; insertId?: number | string }>;
  transaction<T>(fn: (client: DatabaseClient) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  isMySQL(): boolean;
  engineName(): string;
}

export interface TourRow {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  days?: number | null;
  nights?: number | null;
  duration?: string | null;
  starting_price_usd?: number | null;
  starting_price_idr?: number | null;
  wni_price?: number | null;
  wna_price?: number | null;
  wna_price_idr?: number | null;
  rating?: number | null;
  review_count?: number | null;
  image?: string | null;
  highlights?: string | null;
  itinerary?: string | null;
  includes?: string | null;
  excludes?: string | null;
  what_to_bring?: string | null;
  status?: string | null;
  is_deleted?: number | null;
  is_archived?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ShareTourRow {
  id: string;
  title: string;
  slug: string;
  location?: string | null;
  category?: string | null;
  duration?: string | null;
  days?: number | null;
  nights?: number | null;
  description?: string | null;
  cover_image?: string | null;
  gallery?: string | null;
  highlight?: string | null;
  included?: string | null;
  excluded?: string | null;
  faq?: string | null;
  status?: string | null;
  starting_price_idr?: number | null;
  starting_price_usd?: number | null;
  wna_price_idr?: number | null;
  itinerary?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface BatchRow {
  id: string;
  trip_id: string;
  departure_date: string;
  quota: number;
  available_seats: number;
  price: number;
  wna_price_idr?: number | null;
  status: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface BookingRow {
  id: string;
  booking_code: string;
  service_type: string;
  service_id?: string | null;
  service_name?: string | null;
  booking_type?: string | null;
  tour_booking_type?: string | null;
  departure_date?: string | null;
  full_name: string;
  customer_name?: string | null;
  email: string;
  customer_email?: string | null;
  phone: string;
  customer_phone?: string | null;
  participants_count: number;
  participants_names?: string | null;
  proof_of_payment?: string | null;
  status: string;
  payment_status: string;
  total_price: number;
  total_price_idr: number;
  base_amount: number;
  unique_code: number;
  payment_amount: number;
  currency: string;
  created_at?: string | null;
  details?: string | null;
  tour_snapshot?: string | null;
  discount?: string | null;
  promo_code?: string | null;
  admin_notes?: string | null;
  paid_at?: string | null;
  payment_id?: string | null;
  payment_intent_id?: string | null;
  checkout_url?: string | null;
  confirmed_at?: string | null;
  reject_reason?: string | null;
  verification_hash?: string | null;
  gathering_request_id?: string | null;
  gathering_quotation_id?: string | null;
  gathering_quotation_version?: number | null;
}

export interface ArticleRow {
  id: string;
  slug: string;
  title: string;
  seo_title?: string | null;
  seo_description?: string | null;
  category?: string | null;
  destination?: string | null;
  excerpt?: string | null;
  image?: string | null;
  read_time?: string | null;
  date?: string | null;
  author?: string | null;
  keywords?: string | null;
  featured?: number | null;
  hero_image_prompt?: string | null;
  featured_image_alt_text?: string | null;
  introduction?: string | null;
  history?: string | null;
  why_visit?: string | null;
  best_time_to_visit?: string | null;
  top_attractions?: string | null;
  best_activities?: string | null;
  travel_tips?: string | null;
  weather?: string | null;
  transportation?: string | null;
  nearby_attractions?: string | null;
  food_to_try?: string | null;
  local_culture?: string | null;
  suggested_itinerary?: string | null;
  faq?: string | null;
  conclusion?: string | null;
  call_to_action?: string | null;
  gallery?: string | null;
  seo_requirements?: string | null;
  content?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PromoCodeRow {
  id: string;
  code: string;
  discount_type: string; // 'percentage' | 'fixed'
  discount_value: number;
  min_spend_idr: number;
  max_discount?: number | null;
  valid_until: string;
  max_usage?: number | null;
  usage_count: number;
  is_active: number; // 1 or 0
  description?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PromoCodeEntity {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minSpendIDR: number;
  maxDiscount?: number | null;
  validUntil: string;
  maxUsage?: number | null;
  usageCount: number;
  isActive: boolean;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}
