ALTER TABLE proof_submissions
ADD COLUMN IF NOT EXISTS verification_result JSONB;
