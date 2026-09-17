ALTER TABLE certificates
ADD COLUMN IF NOT EXISTS verification_token UUID DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_certificates_verification_token
ON certificates (verification_token);