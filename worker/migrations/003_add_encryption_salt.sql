-- Add encryption_salt column to users table
ALTER TABLE users ADD COLUMN encryption_salt TEXT;
