# Supabase-only backend setup (IFM Weather)

This repo now contains a Supabase backend scaffold that replaces the Laravel API:
- SQL schema migration in `supabase/migrations/*`
- One Edge Function named `api` that implements your current routes:
  - `GET /api/health`
  - `GET /api/locations`
  - `GET /api/locations/:id/forecast`
  - `GET /api/locations/:id/alerts`
  - `GET /api/hazards` and `GET /api/locations/:id/hazards`
  - `POST /api/reports` and `POST /api/hazards`
  - `POST /api/device-tokens`
  - `POST /api/ingest` (protected)

## 0) Create your Supabase project
Create a project in Supabase (Free plan is OK for small usage).

## 1) Install Supabase CLI
- https://supabase.com/docs/guides/cli

Windows quick installs (pick one):
- Scoop (recommended): `scoop install supabase`
- Chocolatey: `choco install supabase-cli`
- npm: `npm i -g supabase`

## 2) Link this repo to your Supabase project
From the repo root:
- `supabase login`
- `supabase link --project-ref <your-project-ref>`

## 3) Apply DB schema
- `supabase db push`

This will run the migration in `supabase/migrations/20260122120000_init_ifm_weather.sql`.

## 4) Set Edge Function secrets (required)
You MUST set these secrets for the function to work:

- `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>`
- `supabase secrets set OPENWEATHER_API_KEY=<your-openweather-api-key>`
- `supabase secrets set INGEST_SECRET=<some-long-random-string>`

Optional:
- `supabase secrets set OPENWEATHER_BASE_URL=https://api.openweathermap.org/data/2.5/weather`

Notes:
- Never put `SUPABASE_SERVICE_ROLE_KEY` in the mobile app.
- `INGEST_SECRET` is used to protect `/api/ingest` (if you omit it, ingest becomes public).

## 5) Deploy the Edge Function
- `supabase functions deploy api`

After deploy, you can call the function using either URL style:

A) Functions subdomain (simple; recommended for this app):
- Base: `https://<project-ref>.functions.supabase.co`
- Example: `GET https://<project-ref>.functions.supabase.co/api/locations`

B) Main Supabase domain:
- Base: `https://<project-ref>.supabase.co/functions/v1`
- Example: `GET https://<project-ref>.supabase.co/functions/v1/api/locations`

## 6) Point the mobile app at Supabase Functions
Your app already supports `EXPO_PUBLIC_API_BASE_URL` (see `mobile/src/state/apiBaseUrl.js`).

Set:
- `EXPO_PUBLIC_API_BASE_URL=https://<project-ref>.functions.supabase.co`

Or if you prefer option B above:
- `EXPO_PUBLIC_API_BASE_URL=https://<project-ref>.supabase.co/functions/v1`

## 7) Hourly ingestion (free)
This repo includes a GitHub Actions workflow:
- `.github/workflows/supabase_ingest_hourly.yml`

Add these GitHub repo secrets:
- `SUPABASE_FUNCTIONS_API_BASE` = `https://<project-ref>.functions.supabase.co`
- `INGEST_SECRET` = the same value you set in `supabase secrets`

The workflow calls:
- `POST https://<project-ref>.functions.supabase.co/api/ingest` with header `x-ingest-secret`.

## 8) Seed locations
You need at least one row in `locations`.
You can insert via Supabase Table Editor, or temporarily run SQL like:

```sql
insert into public.locations (name, region, latitude, longitude, timezone)
values ('Dar es Salaam', 'TZ', -6.7924, 39.2083, 'Africa/Dar_es_Salaam');
```

## Troubleshooting
- If you get 500 with "Missing SUPABASE_SERVICE_ROLE_KEY": set it via `supabase secrets set ...` then redeploy.
- If ingest returns 401: ensure the request header `x-ingest-secret` matches `INGEST_SECRET`.
