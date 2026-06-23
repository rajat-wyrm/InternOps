ALTER TABLE ratings
DROP CONSTRAINT ratings_score_check;

ALTER TABLE ratings
ADD CONSTRAINT ratings_score_check
CHECK (score >= 1 AND score <= 10);