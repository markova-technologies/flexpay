-- Migration 0002: Salary & Job Title
-- Add job_title if not present (monthly_salary already in 0001)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS job_title TEXT;

-- Ensure monthly_salary is non-null with sensible default
ALTER TABLE employees ALTER COLUMN monthly_salary SET DEFAULT 0;
ALTER TABLE employees ALTER COLUMN monthly_salary SET NOT NULL;

-- Back-fill credit_limit from monthly_salary for any legacy rows
UPDATE employees SET credit_limit = monthly_salary WHERE credit_limit = 0 AND monthly_salary > 0;
UPDATE employees SET available_credit = credit_limit WHERE available_credit = 0 AND credit_limit > 0;
