# FlexPay Cloud Deployment Guide
**Architecture: Vercel (Frontend) + Render (Backend) + Supabase (Database)**

This guide gives you the exact, step-by-step instructions to deploy FlexPay to production across **Vercel**, **Render**, and **Supabase**.

```
┌─────────────────────────────────┐
│         VERCEL FRONTEND         │
│  React 18 + Vite SPA            │
│  https://flexpay.vercel.app     │
└──────────────┬──────────────────┘
               │ (HTTPS REST API / Authorization Bearer JWT)
               ▼
┌─────────────────────────────────┐
│         RENDER BACKEND          │
│  Node.js 24 + Express Monolith  │
│  https://flexpay-api.onrender   │
└──────────────┬──────────────────┘
               │ (ACID PostgreSQL Connection Pooler / Port 6543)
               ▼
┌─────────────────────────────────┐
│        SUPABASE DATABASE        │
│  Cloud PostgreSQL (12 Tables)   │
│  Double-Entry Financial Ledger  │
└─────────────────────────────────┘
```

---

## Stage 1: Supabase Database Setup

1. Go to [Supabase](https://supabase.com) and create a new project (e.g. `flexpay-production`).
2. Go to the **SQL Editor** tab (`>_` in the left sidebar).
3. Copy the entire contents of [`supabase/schema.sql`](./supabase/schema.sql) and paste it into the editor.
4. Click **Run**.
   - This creates all 12 institutional tables (`merchants`, `organizations`, `employees`, `users`, `benefit_accounts`, `benefit_wallets`, `orders`, `payment_records`, `journal_entries`, etc.) and pre-populates initial demo data for all 4 roles.
5. In Supabase, open **Project Settings** -> **Database**.
6. Under **Connection string**, select **URI** (Transaction pooler, port `6543` or direct port `5432`).
7. Copy the URI and replace `[YOUR-PASSWORD]` with your database password:
   ```env
   postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require
   ```

---

## Stage 2: Render Backend Deployment

1. Go to [Render](https://render.com) and click **New +** -> **Web Service**.
2. Connect your GitHub repository (`Flex Pay`).
3. Configure the service settings:
   - **Name**: `flexpay-backend`
   - **Region**: Same region as your Supabase DB (e.g. Frankfurt / Oregon)
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node src/server/index.js`
   - **Plan**: `Free`
4. Under **Environment Variables**, add:
   | Key | Value | Notes |
   |---|---|---|
   | `NODE_ENV` | `production` | Production mode (enforces HTTPS-only cookies & SameSite=None) |
   | `PORT` | `10000` | Render standard port |
   | `DATABASE_URL` | `postgresql://...` | *Your Supabase URI from Stage 1* |
   | `JWT_PRIVATE_KEY` | *Contents of jwt_private.pem* | 2048-bit RS256 private key (preserves sessions across restarts) |
   | `JWT_PUBLIC_KEY` | *Contents of jwt_public.pem* | 2048-bit RS256 public key (preserves sessions across restarts) |
   | `SAFARICOM_ENV` | `mock` | Keep `mock` for instant demo, or `sandbox` for live SIMs |
   | `CORS_ORIGIN` | `https://flexpay1.vercel.app` | Your Vercel frontend URL (or leave blank to auto-allow Vercel) |

   > **Note on JWT Keys**: You can copy the contents of `jwt_private.pem` and `jwt_public.pem` from the repository root. If pasting into the Render Dashboard, paste the full text including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`. If keys are not set, the server will auto-generate an ephemeral keypair on first request.

5. Click **Deploy Web Service**.
6. When deployment finishes, copy your Render URL:  
   `https://flexpay-backend-xxxx.onrender.com`
7. Test the health endpoint in your browser:  
   `https://flexpay-backend-xxxx.onrender.com/health` -> should return `{"status":"ok"}`.

---

## Stage 3: Vercel Frontend Deployment

1. Go to [Vercel](https://vercel.com) and click **Add New...** -> **Project**.
2. Select your GitHub repository (`Flex Pay`).
3. In the project setup screen:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click "Edit" and choose `src/client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Expand **Environment Variables** and add:
   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://flexpay-backend-xxxx.onrender.com` |
   *(Use your actual Render backend URL without a trailing slash)*
5. Click **Deploy**.
6. Vercel will build and provide your public URL (e.g. `https://flexpay.vercel.app`).

---

## Stage 4: Test & Verify

Open your Vercel deployment URL. All 4 demo roles are ready to log in:

| Role | Email | PIN | Access Surface |
|---|---|---|---|
| **Employee** | `employee@telecom.et` | `1234` | Personal balances, category wallets, PayLater co-pay |
| **Employer HR** | `hr@telecom.et` | `1234` | Corporate benefit pool, employee roster, policy editor |
| **Merchant POS** | `pos@bunaye.et` | `1234` | Point-of-sale checkout, customer phone verification |
| **Ops Auditor** | `ops@flexpay.et` | `1234` | Double-entry journal, reconciliation audit |

### Quick Demo Transaction Test:
1. Log in as **Merchant POS** (`pos@bunaye.et` / `1234`).
2. Verify customer phone `251912345678` (Abebe Kebede).
3. Ring up an order for **ETB 2,000**.
4. Witness the automatic split: **ETB 1,500 Employer Benefit** + **ETB 500 Salary Co-Pay**.
5. Click **Authorize with M-PESA** -> observe instant simulation & ledger settlement in Supabase!
