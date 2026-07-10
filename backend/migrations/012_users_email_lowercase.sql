-- Migration: Enforce lowercase emails and case-insensitive uniqueness

-- Normalize existing data BEFORE adding constraints
UPDATE users SET email = LOWER(email) WHERE email != LOWER(email);

-- Enforce going forward that email can only be stored lowercase
ALTER TABLE users
  ADD CONSTRAINT users_email_lowercase CHECK (email = LOWER(email));

-- Case-insensitive uniqueness + faster LOWER(email) lookups
CREATE UNIQUE INDEX users_email_lower_idx ON users (LOWER(email));