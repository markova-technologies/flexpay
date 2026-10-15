# Supabase Setup Guide for FlexPay

This guide walks you through setting up your managed PostgreSQL database on [Supabase](https://supabase.com) and linking it to your Render backend.

---

## 1. Create a Supabase Project

1. Log in to [Supabase](https://supabase.com).
2. Click **New project**.
3. Choose an organization, enter a project name (e.g., `flexpay-db`), and set a secure database password.
4. Select the region closest to your users or backend (e.g. `Frankfurt (eu-central-1)` or `London`).
5. Click **Create new project**.

---

## 2. Run the Database Schema & Seed Script

1. In your Supabase project dashboard, navigate to the **SQL Editor** (icon on the left sidebar: `>_`).
2. Click **New query**.
3. Open [`supabase/schema.sql`](./schema.sql), copy its entire content, and paste it into the SQL Editor.
4. Click **Run** (or `Ctrl+Enter`).
5. You should see `Success. No rows returned`.
6. Open the **Table Editor** on the left menu: you will see all 12 tables (`organizations`, `merchants`, `employees`, `users`, `benefit_accounts`, `benefit_wallets`, `orders`, `payment_records`, `journal_entries`, etc.) pre-populated with demo data!

---

## 3. Retrieve Your Connection String for Render

1. In Supabase, go to **Project Settings** (gear icon at the bottom left) -> **Database**.
2. Scroll to **Connection parameters** / **Connection string**.
3. Select **URI** mode:
   - For Render/serverless, using the **Transaction Pooler** (port `6543`) or Direct (port `5432`) works.
   - Example URI format:
     ```
     postgresql://postgres.[your-project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require
     ```
4. Replace `[YOUR-PASSWORD]` with your actual Supabase database password.
5. Save this URI; you will set it as `DATABASE_URL` in your **Render Web Service Environment Variables**.

---

## 4. Test Pre-Seeded Accounts

All 4 stakeholder roles are pre-seeded in the database with PIN `1234`:
- **Employee**: `employee@telecom.et` (Abebe Kebede, Ethio Telecom)
- **Employer HR**: `hr@telecom.et` (Sara Tadesse, HR Director)
- **Merchant POS**: `pos@bunaye.et` (Yod Abyssinia POS)
- **Operations Auditor**: `ops@flexpay.et` (Almaz Girma, Ops Auditor)
