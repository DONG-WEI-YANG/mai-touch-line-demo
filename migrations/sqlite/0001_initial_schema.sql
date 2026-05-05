-- SQLite Migration: Initial Schema
-- Date: 2026-02-15
-- Description: Create all tables for m'AI Touch application

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  openId TEXT NOT NULL UNIQUE,
  name TEXT,
  email TEXT,
  picture TEXT,
  loginMethod TEXT,
  role TEXT NOT NULL DEFAULT 'resident' CHECK(role IN ('resident', 'admin', 'logistics')),
  unitId INTEGER,
  tier TEXT NOT NULL DEFAULT 'Platinum',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lastSignedIn DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_openId ON users(openId);
CREATE INDEX idx_users_email ON users(email);

-- Amenities table
CREATE TABLE IF NOT EXISTS amenities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT 'star',
  category TEXT NOT NULL DEFAULT 'recreation' CHECK(category IN ('recreation', 'wellness', 'entertainment', 'business', 'dining', 'outdoor')),
  capacity INTEGER NOT NULL DEFAULT 10,
  minTier TEXT NOT NULL DEFAULT 'Platinum',
  location TEXT,
  rules TEXT,
  isActive INTEGER NOT NULL DEFAULT 1,
  maintenanceNote TEXT,
  openTime TEXT NOT NULL DEFAULT '08:00',
  closeTime TEXT NOT NULL DEFAULT '22:00',
  slotDurationMinutes INTEGER NOT NULL DEFAULT 60,
  imageUrl TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_amenities_category ON amenities(category);
CREATE INDEX idx_amenities_isActive ON amenities(isActive);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  amenityId INTEGER NOT NULL,
  date TEXT NOT NULL,
  startTime TEXT NOT NULL,
  endTime TEXT NOT NULL,
  guestCount INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed', 'pending', 'cancelled', 'completed')),
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (amenityId) REFERENCES amenities(id) ON DELETE CASCADE
);

CREATE INDEX idx_bookings_userId ON bookings(userId);
CREATE INDEX idx_bookings_amenityId ON bookings(amenityId);
CREATE INDEX idx_bookings_date ON bookings(date);
CREATE INDEX idx_bookings_status ON bookings(status);

-- Work Orders table
CREATE TABLE IF NOT EXISTS work_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'maintenance' CHECK(category IN ('maintenance', 'security', 'concierge', 'housekeeping', 'laundry', 'vehicle', 'other')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'resolved', 'closed')),
  assignedTo TEXT,
  resolvedAt DATETIME,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_work_orders_userId ON work_orders(userId);
CREATE INDEX idx_work_orders_status ON work_orders(status);
CREATE INDEX idx_work_orders_priority ON work_orders(priority);
CREATE INDEX idx_work_orders_category ON work_orders(category);

-- Chat Messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  language TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_chat_messages_userId ON chat_messages(userId);
CREATE INDEX idx_chat_messages_createdAt ON chat_messages(createdAt);

-- Sessions table (for OAuth)
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,
  userId INTEGER NOT NULL,
  provider TEXT NOT NULL,
  expiresAt DATETIME NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_userId ON sessions(userId);
CREATE INDEX idx_sessions_expiresAt ON sessions(expiresAt);

-- Trigger to update updatedAt timestamp
CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
AFTER UPDATE ON users
BEGIN
  UPDATE users SET updatedAt = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_amenities_timestamp 
AFTER UPDATE ON amenities
BEGIN
  UPDATE amenities SET updatedAt = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_bookings_timestamp 
AFTER UPDATE ON bookings
BEGIN
  UPDATE bookings SET updatedAt = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_work_orders_timestamp 
AFTER UPDATE ON work_orders
BEGIN
  UPDATE work_orders SET updatedAt = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_sessions_timestamp 
AFTER UPDATE ON sessions
BEGIN
  UPDATE sessions SET updatedAt = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Units table
CREATE TABLE IF NOT EXISTS units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unitNumber TEXT NOT NULL UNIQUE,
  floor INTEGER NOT NULL,
  wing TEXT,
  squareFootage INTEGER,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Chat Messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  language TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Devices table
CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unitId INTEGER,
  amenityId INTEGER,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('light', 'climate', 'curtain', 'security', 'media', 'power')),
  status TEXT NOT NULL DEFAULT 'off',
  lastSeen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Access Passes table
CREATE TABLE IF NOT EXISTS access_passes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  guestName TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'one_time' CHECK(type IN ('one_time', 'temporary', 'permanent')),
  expiresAt DATETIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'used', 'expired', 'revoked')),
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Wallets table
CREATE TABLE IF NOT EXISTS wallets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL UNIQUE,
  balance INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  walletId INTEGER NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('payment', 'refund', 'fee', 'topup')),
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TWD',
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success' CHECK(status IN ('pending', 'success', 'failed')),
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Access Logs table
CREATE TABLE IF NOT EXISTS access_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER,
  passId INTEGER,
  entryPoint TEXT NOT NULL,
  result TEXT NOT NULL CHECK(result IN ('success', 'denied', 'expired')),
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- System Jobs table
CREATE TABLE IF NOT EXISTS system_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'failed')),
  progress INTEGER NOT NULL DEFAULT 0,
  currentStep TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);