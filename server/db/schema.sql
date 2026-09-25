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
  admin_notes TEXT,
  paid_at VARCHAR(64),
  payment_id VARCHAR(128),
  payment_intent_id VARCHAR(128),
  checkout_url TEXT,
  confirmed_at VARCHAR(64),
  reject_reason TEXT,
  verification_hash TEXT
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
