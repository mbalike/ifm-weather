# Supabase (WSL) notes for this repo

This app calls a Supabase Edge Function deployed at:

- `https://qxsnhusizkbldeujngjq.functions.supabase.co/api/*`

The Edge Function source is in:

- `supabase/functions/api/index.ts`

## Supabase CLI in WSL

This repo previously had only `supabase/.temp/project-ref` (linked project), but not the CLI itself.

### Install (Linux/WSL)

Installed in WSL as:

- `~/.local/bin/supabase`

If `supabase` is not found, add to your shell PATH:

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

Verify:

```bash
supabase --version
```

### Useful commands

List projects:

```bash
supabase projects list
```

List Edge Functions in a project:

```bash
supabase functions list --project-ref qxsnhusizkbldeujngjq
```

Download the deployed function source:

```bash
supabase functions download api --project-ref qxsnhusizkbldeujngjq
```

Deploy the function (Docker not required):

```bash
supabase functions deploy api --project-ref qxsnhusizkbldeujngjq --no-verify-jwt --use-api
```

Note: the mobile app calls the Edge Function without an `Authorization` header, so the function must be deployed with `--no-verify-jwt`.

## Weather ingest (OpenWeather)

The Edge Function has an `OPENWEATHER_API_KEY` secret configured.

- It tries to ingest **daily high/low and official hazard alerts** via OpenWeather **One Call**.
- If One Call is unavailable (403/401), it falls back to the basic current-weather endpoint.

The ingest route is protected by `x-ingest-secret` if `INGEST_SECRET` is set.

Trigger ingest:

```bash
curl -s -X POST \
  https://qxsnhusizkbldeujngjq.functions.supabase.co/api/ingest \
  -H 'x-ingest-secret: <YOUR_INGEST_SECRET>'
```

## Adding more locations

The mobile app loads locations from `GET /api/locations`, backed by the `locations` table.

To add more locations, insert rows in Supabase (Dashboard → SQL Editor), for example:

```sql
insert into locations (name, region, latitude, longitude, timezone)
values
  ('Arusha', 'TZ', -3.3869, 36.6830, 'Africa/Dar_es_Salaam'),
  ('Dodoma', 'TZ', -6.1630, 35.7516, 'Africa/Dar_es_Salaam'),
  ('Mwanza', 'TZ', -2.5164, 32.9175, 'Africa/Dar_es_Salaam');
```

After inserting, the app’s Locations screen will show them automatically.

### Add/seed via API (admin)

There is also an admin-only endpoint to create locations:

- `POST /api/locations`

It’s protected by the same `INGEST_SECRET` used by ingest.

```bash
curl -s -X POST \
  https://qxsnhusizkbldeujngjq.functions.supabase.co/api/locations \
  -H 'content-type: application/json' \
  -H 'x-ingest-secret: <YOUR_INGEST_SECRET>' \
  --data '{"locations":[{"name":"Zanzibar","region":"TZ","latitude":-6.1659,"longitude":39.2026,"timezone":"Africa/Dar_es_Salaam"}]}'
```

## Weather hazard alerts

OpenWeather can provide hazard alerts in One Call responses under `alerts[]` (availability varies by region/provider).

This repo also keeps a simple derived flood-risk alert based on high recent rainfall, in case official alerts are unavailable.
