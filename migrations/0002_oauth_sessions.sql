-- Migration: Add OAuth sessions table
-- Date: 2026-02-15
-- Description: Add sessions table for OAuth authentication

-- Create sessions table
CREATE TABLE IF NOT EXISTS `sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `token` varchar(64) NOT NULL,
  `userId` int NOT NULL,
  `provider` varchar(32) NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`),
  KEY `userId` (`userId`),
  KEY `expiresAt` (`expiresAt`),
  CONSTRAINT `sessions_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Add index for faster session lookups
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_expiresAt ON sessions(expiresAt);

-- Add picture column to users table if not exists
ALTER TABLE `users` 
ADD COLUMN IF NOT EXISTS `picture` text DEFAULT NULL AFTER `email`;

-- Update existing users to have default role if not set
UPDATE `users` SET `role` = 'user' WHERE `role` IS NULL;

-- Add comment to tables
ALTER TABLE `sessions` COMMENT = 'OAuth user sessions for authentication';
ALTER TABLE `users` COMMENT = 'User accounts for m''AI Touch application';