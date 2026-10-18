-- Migration 0004: Payroll Lines v2
ALTER TABLE payroll_disbursement_lines ADD COLUMN IF NOT EXISTS gross_salary NUMERIC(14,2);
ALTER TABLE payroll_disbursement_lines ADD COLUMN IF NOT EXISTS credit_used  NUMERIC(14,2);
