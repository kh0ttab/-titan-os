# Titan OS — Deployment Guide (Supabase + Vercel)

## Architecture
- **Frontend**: Vite + React → deployed on **Vercel** (shareable link)
- **Auth + Database**: **Supabase** (PostgreSQL + Auth)
- **AI**: **Groq API** (Llama 3.3 70B) via Vercel serverless function (key stays server-side)

---

## Step 1: Create Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and create a new project
2. Copy your **Project URL** and **anon/public key** from Settings → API
3. Go to **SQL Editor** → New Query and paste the contents of `supabase/schema.sql`, then run it

## Step 2: Create Demo Users in Supabase

1. Go to **Authentication** → **Providers** → **Email** → **disable** "Confirm email"
2. Go to **Authentication** → **Users** → **Add User** and create these accounts:

| Email               | Password   |
|---------------------|------------|
| admin@titan.demo    | titan123!  |
| jordan@titan.demo   | titan123!  |
| priya@titan.demo    | titan123!  |
| derek@titan.demo    | titan123!  |
| sofia@titan.demo    | titan123!  |

3. After creating all users, go to **SQL Editor** and run:
```sql
-- Get user IDs
SELECT id, email FROM auth.users ORDER BY email;
```
4. Then update profiles with correct metadata (replace UUIDs):
```sql
UPDATE public.profiles SET name='Marcus Reid', role='CEO', initials='MR', color='#00d4ff', dept='Executive', is_admin=true WHERE id IN (SELECT id FROM auth.users WHERE email='admin@titan.demo');
UPDATE public.profiles SET name='Jordan Blake', role='Head of Sales', initials='JB', color='#00e87a', dept='Sales', is_admin=false WHERE id IN (SELECT id FROM auth.users WHERE email='jordan@titan.demo');
UPDATE public.profiles SET name='Priya Sharma', role='HR Director', initials='PS', color='#a855f7', dept='HR', is_admin=false WHERE id IN (SELECT id FROM auth.users WHERE email='priya@titan.demo');
UPDATE public.profiles SET name='Derek Cole', role='VP Engineering', initials='DC', color='#ffb300', dept='Engineering', is_admin=true WHERE id IN (SELECT id FROM auth.users WHERE email='derek@titan.demo');
UPDATE public.profiles SET name='Sofia Torres', role='Head of Marketing', initials='ST', color='#ec4899', dept='Marketing', is_admin=false WHERE id IN (SELECT id FROM auth.users WHERE email='sofia@titan.demo');
```

## Step 3: Deploy to Vercel

### Option A: Via CLI
```bash
npm i -g vercel
vercel login
vercel
```

### Option B: Via GitHub
1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → Import Project → select the repo
3. Vercel auto-detects Vite

### Set Environment Variables in Vercel
Go to your Vercel project → Settings → Environment Variables and add:

| Key                      | Value                         |
|--------------------------|-------------------------------|
| `VITE_SUPABASE_URL`     | `https://xxx.supabase.co`    |
| `VITE_SUPABASE_ANON_KEY`| your Supabase anon key        |
| `GROQ_API_KEY`          | your Groq API key             |

Then redeploy.

## Step 4: Share!

Your app is live at `https://your-project.vercel.app`. Share the link with anyone.

Demo login: `admin@titan.demo` / `titan123!`

---

## Local Development

```bash
# Fill in .env with your Supabase credentials
npm install
npm run dev
```

Note: The AI feature (`/api/ai`) only works when deployed on Vercel (serverless function).
For local AI testing, you can run `vercel dev` instead of `npm run dev`.
