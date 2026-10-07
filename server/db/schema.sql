-- ==============================================================================
-- SMART JOURNEY ENTERPRISE RELATIONAL SCHEMA
-- Fully compatible with MySQL 8.0+ (Niagahoster Production) & SQLite 3 (Dev/Sandbox)
-- ==============================================================================

-- 1. Main Private Tours Table
CREATE TABLE IF NOT EXISTS tours (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(64) DEFAULT 'Private Tour',
  days INT DEFAULT 1,
  nights INT DEFAULT 0,
  duration VARCHAR(64) DEFAULT '1D',
  starting_price_usd DECIMAL(10,2) DEFAULT 0,
  starting_price_idr DECIMAL(14,2) DEFAULT 0,
  wni_price DECIMAL(14,2) DEFAULT 0,
  wna_price DECIMAL(10,2) DEFAULT 0,
  wna_price_idr DECIMAL(14,2) DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 5.0,
  review_count INT DEFAULT 0,
  image TEXT,
  highlights TEXT,
  itinerary TEXT,
  includes TEXT,
  excludes TEXT,
  what_to_bring TEXT,
  status VARCHAR(32) DEFAULT 'published',
  is_deleted INT DEFAULT 0,
  is_archived INT DEFAULT 0,
  created_at VARCHAR(64),
  updated_at VARCHAR(64)
);

-- 2. Share Tours (Open Trip Blueprints)
CREATE TABLE IF NOT EXISTS share_tours (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  location VARCHAR(128),
  category VARCHAR(64),
  duration VARCHAR(64),
  days INT DEFAULT 1,
  nights INT DEFAULT 0,
  description TEXT,
  cover_image TEXT,
  gallery TEXT,
  highlight TEXT,
  included TEXT,
  excluded TEXT,
  faq TEXT,
  status VARCHAR(32) DEFAULT 'published',
  starting_price_idr DECIMAL(14,2) DEFAULT 0,
  starting_price_usd DECIMAL(10,2) DEFAULT 0,
  wna_price_idr DECIMAL(14,2) DEFAULT 0,
  itinerary TEXT,
  created_at VARCHAR(64),
  updated_at VARCHAR(64)
);

-- 3. Batches (Departure Schedules for Share Tours)
CREATE TABLE IF NOT EXISTS batches (
  id VARCHAR(64) PRIMARY KEY,
  trip_id VARCHAR(64) NOT NULL,
  departure_date VARCHAR(32) NOT NULL,
  quota INT DEFAULT 10,
  available_seats INT DEFAULT 10,
  price DECIMAL(14,2) DEFAULT 0,
  wna_price_idr DECIMAL(14,2) DEFAULT 0,
  status VARCHAR(32) DEFAULT 'open',
  created_at VARCHAR(64),
  updated_at VARCHAR(64)
);

-- 4. Bookings Table (Unified Ledger for Private Tours, Share Tours, & Transfers)
CREATE TABLE IF NOT EXISTS bookings (
  id VARCHAR(64) PRIMARY KEY,
  booking_code VARCHAR(64) UNIQUE NOT NULL,
  service_type VARCHAR(64) NOT NULL,
  service_id VARCHAR(64),
  service_name VARCHAR(255),
  booking_type VARCHAR(64),
  tour_booking_type VARCHAR(64),
  departure_date VARCHAR(64),
  full_name VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255),
  email VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255),
  phone VARCHAR(64) NOT NULL,
  customer_phone VARCHAR(64),
  participants_count INT DEFAULT 1,
  participants_names TEXT,
  proof_of_payment TEXT,
  status VARCHAR(64) DEFAULT 'Pending Payment',
  payment_status VARCHAR(64) DEFAULT 'Pending',
  total_price DECIMAL(14,2) DEFAULT 0,
  total_price_idr DECIMAL(14,2) DEFAULT 0,
  base_amount DECIMAL(14,2) DEFAULT 0,
  unique_code INT DEFAULT 0,
  payment_amount DECIMAL(14,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'IDR',
  created_at VARCHAR(64),
  details TEXT,
  tour_snapshot TEXT,
  discount TEXT,
  promo_code VARCHAR(64),
  admin_notes TEXT,
  paid_at VARCHAR(64),
  payment_id VARCHAR(128),
  payment_intent_id VARCHAR(128),
  checkout_url TEXT,
  confirmed_at VARCHAR(64),
  reject_reason TEXT,
  verification_hash TEXT,
  gathering_request_id VARCHAR(64),
  gathering_quotation_id VARCHAR(64),
  gathering_quotation_version INT
);

-- 5. Payments Table (ArtoPay Transactions & Webhooks Audit Trail)
CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(64) PRIMARY KEY,
  booking_id VARCHAR(64) NOT NULL,
  order_id VARCHAR(64) NOT NULL,
  payment_id VARCHAR(128),
  gateway VARCHAR(32) DEFAULT 'artopay',
  base_amount DECIMAL(14,2) DEFAULT 0,
  unique_code INT DEFAULT 0,
  payment_amount DECIMAL(14,2) DEFAULT 0,
  payment_method VARCHAR(64),
  payment_status VARCHAR(32) DEFAULT 'Pending',
  raw_payload TEXT,
  paid_at VARCHAR(64),
  created_at VARCHAR(64)
);

-- 6. Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR(64) PRIMARY KEY,
  booking_id VARCHAR(64) NOT NULL,
  invoice_number VARCHAR(64) UNIQUE NOT NULL,
  amount DECIMAL(14,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'IDR',
  status VARCHAR(32) DEFAULT 'UNPAID',
  customer_name VARCHAR(255),
  customer_email VARCHAR(255),
  service_summary TEXT,
  created_at VARCHAR(64)
);

-- 7. Admin Sessions Table
CREATE TABLE IF NOT EXISTS admin_sessions (
  token VARCHAR(128) PRIMARY KEY,
  email VARCHAR(128) NOT NULL,
  role VARCHAR(64) DEFAULT 'superadmin',
  expires_at VARCHAR(64) NOT NULL,
  created_at VARCHAR(64)
);

-- 8. Admin Drafts Table (Persistent Autosave for Tours & Forms)
CREATE TABLE IF NOT EXISTS admin_drafts (
  draft_key VARCHAR(128) PRIMARY KEY,
  title VARCHAR(255),
  content TEXT NOT NULL,
  updated_at VARCHAR(64)
);

-- 9. Schedules Table
CREATE TABLE IF NOT EXISTS schedules (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255),
  category VARCHAR(64),
  start_date VARCHAR(64),
  end_date VARCHAR(64),
  slots INT DEFAULT 0,
  notes TEXT,
  created_at VARCHAR(64)
);

-- 10. Reviews Table
CREATE TABLE IF NOT EXISTS reviews (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  rating INT DEFAULT 5,
  comment TEXT,
  date VARCHAR(64),
  service VARCHAR(64),
  status VARCHAR(32) DEFAULT 'pending',
  created_at VARCHAR(64)
);

-- 11. Service Limits Table
CREATE TABLE IF NOT EXISTS service_limits (
  service_type VARCHAR(64) PRIMARY KEY,
  daily_limit INT DEFAULT 5,
  updated_at VARCHAR(64)
);

-- 12. Transport & Operational Master Data Table
CREATE TABLE IF NOT EXISTS transport_data (
  category VARCHAR(64) PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at VARCHAR(64)
);

-- 13. System Meta & Migration Flags
CREATE TABLE IF NOT EXISTS system_meta (
  meta_key VARCHAR(64) PRIMARY KEY,
  meta_value TEXT NOT NULL,
  updated_at VARCHAR(64)
);

-- 14. Operational Assignments Table (Fleet & Crew Trip Allocation)
CREATE TABLE IF NOT EXISTS operational_assignments (
  id VARCHAR(64) PRIMARY KEY,
  booking_id VARCHAR(64) NOT NULL,
  booking_code VARCHAR(64) NOT NULL,
  vehicle_name VARCHAR(255) NOT NULL,
  plate_number VARCHAR(64) NOT NULL,
  driver_name VARCHAR(255) NOT NULL,
  driver_phone VARCHAR(64) NOT NULL,
  guide_name VARCHAR(255),
  guide_phone VARCHAR(64),
  status VARCHAR(64) DEFAULT 'Ready',
  note TEXT,
  assigned_at VARCHAR(64) NOT NULL,
  updated_at VARCHAR(64) NOT NULL
);

-- 15. Articles Table (SEO Blog & Content Engine)
CREATE TABLE IF NOT EXISTS articles (
  id VARCHAR(64) PRIMARY KEY,
  slug VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  seo_title VARCHAR(255),
  seo_description TEXT,
  category VARCHAR(64),
  destination VARCHAR(64),
  excerpt TEXT,
  image TEXT,
  read_time VARCHAR(32),
  date VARCHAR(32),
  author VARCHAR(128),
  keywords TEXT,
  featured INT DEFAULT 0,
  hero_image_prompt TEXT,
  featured_image_alt_text TEXT,
  introduction TEXT,
  history TEXT,
  why_visit TEXT,
  best_time_to_visit TEXT,
  top_attractions TEXT,
  best_activities TEXT,
  travel_tips TEXT,
  weather TEXT,
  transportation TEXT,
  nearby_attractions TEXT,
  food_to_try TEXT,
  local_culture TEXT,
  suggested_itinerary TEXT,
  faq TEXT,
  conclusion TEXT,
  call_to_action TEXT,
  gallery TEXT,
  seo_requirements TEXT,
  content TEXT,
  status VARCHAR(32) DEFAULT 'published',
  created_at VARCHAR(64),
  updated_at VARCHAR(64)
);

-- 16. Promo Codes Table (Marketing & Coupon Engine)
CREATE TABLE IF NOT EXISTS promo_codes (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(64) UNIQUE NOT NULL,
  discount_type VARCHAR(32) NOT NULL, -- 'percentage' | 'fixed'
  discount_value DECIMAL(14,2) NOT NULL DEFAULT 0,
  min_spend_idr DECIMAL(14,2) NOT NULL DEFAULT 0,
  max_discount DECIMAL(14,2),
  valid_until VARCHAR(64) NOT NULL,
  max_usage INT,
  usage_count INT NOT NULL DEFAULT 0,
  is_active INT NOT NULL DEFAULT 1,
  description TEXT,
  created_at VARCHAR(64),
  updated_at VARCHAR(64)
);

-- 17. Event & Gathering Packages (Corporate & Group Event Catalogue)
CREATE TABLE IF NOT EXISTS event_gathering_packages (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  destination VARCHAR(255) NOT NULL,
  duration VARCHAR(128) NOT NULL,
  image TEXT,
  gallery TEXT,
  description TEXT,
  itinerary TEXT,
  included TEXT,
  excluded TEXT,
  facilities TEXT,
  notes TEXT,
  price_60_pax DECIMAL(14,2) DEFAULT 0,
  price_70_pax DECIMAL(14,2) DEFAULT 0,
  price_80_pax DECIMAL(14,2) DEFAULT 0,
  price_90_pax DECIMAL(14,2) DEFAULT 0,
  price_90_plus_text VARCHAR(128) DEFAULT 'Hubungi Admin',
  is_published INT DEFAULT 1,
  is_archived INT DEFAULT 0,
  created_at VARCHAR(64),
  updated_at VARCHAR(64)
);

-- 18. Event & Gathering Quotation Requests (Customer Inquiries)
CREATE TABLE IF NOT EXISTS event_gathering_requests (
  id VARCHAR(64) PRIMARY KEY,
  package_id VARCHAR(64) NOT NULL,
  package_name VARCHAR(255) NOT NULL,
  duration VARCHAR(128),
  customer_name VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  whatsapp VARCHAR(64) NOT NULL,
  email VARCHAR(255) NOT NULL,
  estimated_participants VARCHAR(32) NOT NULL,
  requested_date VARCHAR(64) NOT NULL,
  notes TEXT,
  status VARCHAR(64) DEFAULT 'REQUESTED',
  secure_token VARCHAR(128) NOT NULL,
  created_at VARCHAR(64),
  updated_at VARCHAR(64)
);

-- 19. Event & Gathering Quotations (Official Proposals)
CREATE TABLE IF NOT EXISTS event_gathering_quotations (
  id VARCHAR(64) PRIMARY KEY,
  quotation_number VARCHAR(64) UNIQUE NOT NULL,
  request_id VARCHAR(64) NOT NULL,
  package_id VARCHAR(64) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  whatsapp VARCHAR(64) NOT NULL,
  email VARCHAR(255) NOT NULL,
  event_date VARCHAR(64) NOT NULL,
  participant_count INT DEFAULT 60,
  valid_until VARCHAR(64) NOT NULL,
  current_version INT DEFAULT 1,
  status VARCHAR(64) DEFAULT 'PROPOSAL_SENT',
  subtotal DECIMAL(14,2) DEFAULT 0,
  discount DECIMAL(14,2) DEFAULT 0,
  additional_cost DECIMAL(14,2) DEFAULT 0,
  grand_total DECIMAL(14,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'IDR',
  booking_id VARCHAR(64),
  package_snapshot TEXT,
  secure_token VARCHAR(128),
  created_at VARCHAR(64),
  updated_at VARCHAR(64)
);

-- 20. Event & Gathering Quotation Versions (Proposal Version History)
CREATE TABLE IF NOT EXISTS event_gathering_quotation_versions (
  id VARCHAR(64) PRIMARY KEY,
  quotation_id VARCHAR(64) NOT NULL,
  version_number INT NOT NULL,
  itinerary TEXT,
  included TEXT,
  excluded TEXT,
  notes TEXT,
  line_items TEXT,
  subtotal DECIMAL(14,2) DEFAULT 0,
  discount DECIMAL(14,2) DEFAULT 0,
  additional_cost DECIMAL(14,2) DEFAULT 0,
  grand_total DECIMAL(14,2) DEFAULT 0,
  package_snapshot TEXT,
  revision_notes TEXT,
  created_by VARCHAR(64) DEFAULT 'admin',
  created_at VARCHAR(64)
);

-- 21. Canonical Gathering Views (Aliases for gathering_* table access)
CREATE VIEW IF NOT EXISTS gathering_packages AS SELECT * FROM event_gathering_packages;
CREATE VIEW IF NOT EXISTS gathering_requests AS SELECT * FROM event_gathering_requests;
CREATE VIEW IF NOT EXISTS gathering_quotations AS SELECT * FROM event_gathering_quotations;
CREATE VIEW IF NOT EXISTS gathering_quotation_versions AS SELECT * FROM event_gathering_quotation_versions;

