CREATE TABLE IF NOT EXISTS interns (
    id SERIAL PRIMARY KEY,
    serial_no INTEGER NOT NULL,
    record_date DATE,
    intern_code VARCHAR(100) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    email_id VARCHAR(255),
    mobile_no VARCHAR(30),
    domain VARCHAR(255),
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
