# Sagar-Netra (AegisSpill GIS) Cloud Deployment Guide

Complete step-by-step instructions for deploying **Sagar-Netra** using **Supabase** (Database), **Render** (Backend API), and **Vercel** (Frontend Web Dashboard).

---

## 🗄️ Step 1: Set Up Supabase Database

1. Go to [Supabase Console](https://supabase.com/dashboard) and click **New Project**.
2. Enter your **Project Name** (e.g. `sagar-netra-db`), set a strong **Database Password**, and select your region.
3. Once the database instance is created, go to **Project Settings** -> **Database**.
4. Scroll down to **Connection string** -> select **URI**.
5. Copy the connection URI:
   ```env
   postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
   ```
   *(Keep this string handy for Step 2).*

---

## 🚀 Step 2: Deploy Backend Service on Render

1. Push your repository to **GitHub** or **GitLab**.
2. Log into [Render Dashboard](https://dashboard.render.com/) and click **New +** -> **Web Service**.
3. Connect your repository containing `Sagar-Netra`.
4. Fill in the following build details:
   - **Name**: `sagar-netra-backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`
5. Under **Environment Variables**, add:
   | Key | Value / Example |
   | :--- | :--- |
   | `ENV` | `production` |
   | `DATABASE_URL` | *(Paste your Supabase connection URI from Step 1)* |
   | `ALLOWED_ORIGINS` | `https://your-app.vercel.app,http://localhost:5173` *(Update with your Vercel URL)* |
   | `BASE_URL` | `https://sagar-netra-backend.onrender.com` *(Your Render app URL)* |
   | `AISSTREAM_API_KEY` | `de5c8707bb4ff474749f531e11a09a6b1e850200` |
6. Click **Create Web Service**.
7. Once deployed, note down your Render service URL (e.g., `https://sagar-netra-backend.onrender.com`).

---

## 🌐 Step 3: Deploy Frontend Web App on Vercel

1. Log into [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New...** -> **Project**.
2. Import your `Sagar-Netra` GitHub repository.
3. In the project setup panel:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
4. Expand **Environment Variables** and add:
   - **Name**: `VITE_API_URL`
   - **Value**: `https://sagar-netra-backend.onrender.com/api` *(Replace with your Render API base URL)*
5. Click **Deploy**.
6. Once deployment succeeds, copy your Vercel production URL (e.g. `https://sagar-netra.vercel.app`).
7. Return to Render Dashboard -> **Environment Variables** and update `ALLOWED_ORIGINS` with your new Vercel domain.

---

## ✅ Step 4: Verification

1. Open your Vercel app URL in a browser.
2. Verify interactive GIS map layers, U-Net prediction previews, drift simulation, and live AIS vessel tracking.
3. Check API health check at `https://sagar-netra-backend.onrender.com/api/status`.
