-- Migration 0003: Receipts
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS receipt_url TEXT;
