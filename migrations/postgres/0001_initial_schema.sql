-- PostgreSQL Migration: Initial Schema
-- Date: 2026-02-15
-- Description: Create all tables for m'AI Touch application

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  "openId" VARCHAR(64) NOT NULL UNIQUE,
  name TEXT,
  email VARCHAR(320),
  picture TEXT,
  "loginMethod" VARCHAR(64),
  role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin')),
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSignedIn" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_openId ON users("openId");
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Amenities table
CREATE TABLE IF NOT EXISTS amenities (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(64) NOT NULL DEFAULT 'star',
  category VARCHAR(20) NOT NULL DEFAULT 'recreation' CHECK(category IN ('recreation', 'wellness', 'entertainment', 'business', 'dining', 'outdoor')),
  capacity INTEGER NOT NULL DEFAULT 10,
  location VARCHAR(255),
  rules TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "openTime" VARCHAR(5) NOT NULL DEFAULT '08:00',
  "closeTime" VARCHAR(5) NOT NULL DEFAULT '22:00',
  "slotDurationMinutes" INTEGER NOT NULL DEFAULT 60,
  "imageUrl" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_amenities_category ON amenities(category);
CREATE INDEX IF NOT EXISTS idx_amenities_isActive ON amenities("isActive");

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "amenityId" INTEGER NOT NULL,
  date VARCHAR(10) NOT NULL,
  "startTime" VARCHAR(5) NOT NULL,
  "endTime" VARCHAR(5) NOT NULL,
  "guestCount" INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed', 'pending', 'cancelled', 'completed')),
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY ("amenityId") REFERENCES amenities(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bookings_userId ON bookings("userId");
CREATE INDEX IF NOT EXISTS idx_bookings_amenityId ON bookings("amenityId");
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- Work Orders table
CREATE TABLE IF NOT EXISTS work_orders (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(20) NOT NULL DEFAULT 'maintenance' CHECK(category IN ('maintenance', 'security', 'concierge', 'housekeeping', 'laundry', 'vehicle', 'other')),
  priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'resolved', 'closed')),
  "assignedTo" VARCHAR(255),
  "resolvedAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_work_orders_userId ON work_orders("userId");
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_priority ON work_orders(priority);
CREATE INDEX IF NOT EXISTS idx_work_orders_category ON work_orders(category);

-- Chat Messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  role VARCHAR(20) NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  language VARCHAR(10),
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_userId ON chat_messages("userId");
CREATE INDEX IF NOT EXISTS idx_chat_messages_createdAt ON chat_messages("createdAt");

-- Sessions table (for OAuth)
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  token VARCHAR(64) NOT NULL UNIQUE,
  "userId" INTEGER NOT NULL,
  provider VARCHAR(32) NOT NULL,
  "expiresAt" TIMESTAMP NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_userId ON sessions("userId");
CREATE INDEX IF NOT EXISTS idx_sessions_expiresAt ON sessions("expiresAt");

-- Function to update updatedAt timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to update updatedAt timestamp
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_amenities_updated_at BEFORE UPDATE ON amenities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_work_orders_updated_at BEFORE UPDATE ON work_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();