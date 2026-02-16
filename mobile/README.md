# IFM Weather (Mobile)

A minimal, location-based weather app focused on **actionable, safety-first insights** for Tanzania/East Africa.

## What the app does

- Shows current conditions (temperature + summary) for the selected location.
- Displays a small hourly + weekly outlook (from a stored timeline payload).
- Shows **Insights** cards (UV, sunrise/sunset, wind, rainfall + a short “quick” line).
- Shows **Alerts** (grouped into simple categories like Health Hazards, Physical Hazards, Marine, etc.).

## Problems it helps solve

- Quick “what should I do now?” guidance (UV, dust/haze masks, thunderstorms, flash-flood risk, coastal wind hazards).
- A lightweight safety hub that works even when official hazard feeds are missing for a region.
- Consistent, simple UI that avoids data overload.

## Architecture (high level)

- **Mobile app (Expo / React Native)**
  - Fetches data from a single backend route: `GET /api/locations/:id/forecast`.
  - Normalizes the payload in `WeatherContext` and renders screens.

- **Backend (Supabase Edge Function)**
  - Source: [supabase/functions/api/index.ts](supabase/functions/api/index.ts)
  - Exposes `/api/*` routes and reads/writes Supabase tables.

- **Weather provider (OpenWeather)**
  - Ingest process fetches OpenWeather One Call when possible.
  - Falls back to the basic current-weather endpoint if One Call is unavailable.

## Data flow (end-to-end)

### 1) Ingest (OpenWeather → Supabase)

- Endpoint: `POST /api/ingest`
- Protection: if `INGEST_SECRET` is set, requires header `x-ingest-secret: <secret>`.
- For each location in the `locations` table:
  1. Try One Call (`/data/3.0/onecall?units=metric&exclude=minutely`) to get:
     - current conditions
     - hourly + daily timeline
     - official `alerts[]` (when available)
  2. If One Call fails, fall back to `/data/2.5/weather?units=metric`.
  3. Insert a new row into `forecasts`:
     - `observed_at` (ISO)
     - `temp_c`, `feels_like_c`, `humidity`, `wind_ms`, `rain_mm`, `summary`
     - `raw` (the full OpenWeather payload)
  4. Alerts ingest (DB `alerts` table):
     - Upsert official OpenWeather alerts from One Call (`alerts[]`).
     - Create a derived flood alert when `rain_mm` is high (threshold-based).

### 2) Forecast API (Supabase → App)

- Endpoint: `GET /api/locations/:id/forecast`
- Reads the latest `forecasts` row for a location.
- Returns a **cleaned + enriched** payload that the app can render without extra calls.

#### Backend “corrections” / normalization

In [supabase/functions/api/index.ts](supabase/functions/api/index.ts), the forecast response is enriched with:

- `chance_of_rain_pct` via `computeChanceOfRainPct(raw, rain_mm)`
  - Uses rain amount + weather main + cloudiness as heuristics.
- Wind enrichment via `computeWind(wind_ms)`
  - Adds `wind_kph` and `wind_level` (calm/breezy/strong).
- Visibility conversion
  - OpenWeather visibility meters → `visibility_km`.
- Direction enrichment
  - `wind_deg` → `wind_dir` compass label.
- Sunrise/sunset
  - Unix seconds → ISO timestamps.
- High/low temperatures
  - Prefer One Call daily max/min; fallback to current-weather temp_max/temp_min.
- Timeline extraction (`timeline`)
  - Slices hourly (24h) and daily (7d) into a UI-friendly shape.

#### Alert generation

The forecast response includes:

- `alerts`: active official alerts from the `alerts` table (source `openweather`).
- `local_alerts`: derived “safety” alerts generated on demand.

Local safety alerts are created by `generateLocalSafetyAlerts(raw, location)`, using current/hourly/daily values from the OpenWeather payload.

### 3) App consumption (API → UI)

- Data is fetched in [src/state/WeatherContext.js](src/state/WeatherContext.js):
  - Calls `GET /api/locations` then `GET /api/locations/:id/forecast`.
  - Normalizes fields (e.g., picks numeric values from multiple shapes).
  - Merges alerts:
    - `serverAlerts` (official DB alerts from `alerts[]` in forecast response)
    - `localAlerts` (derived rules from `local_alerts[]`)

Screens:

- Landing: current + hourly/weekly pills.
- Insights: minimal metrics cards + quick line.
- Alerts: grouped + sorted by severity.

## Alert rules (local safety alerts)

Implemented in `generateLocalSafetyAlerts()`:

- **Coastal / Fishermen**: coastal TZ location AND (`windSpeedMs > 8` OR thunder). High if `windSpeedMs > 12` or thunder.
- **UV (moderate-high)**: `uvi >= 6 && uvi < 9` → sunscreen/sunglasses.
- **UV (extreme)**: `uvi >= 9` (Med), `uvi >= 11` (High).
- **Thunderstorms**: `weather.main` contains “thunder”.
- **Flash-flood**: `rain1h > 5mm` (Med), `rain1h > 12mm` (High).
- **Low visibility (drivers)**: `visibilityM <= 4000` (Med), `<= 2000` (High).
- **Dust/haze mask**: dust/haze hint OR low-ish visibility with little/no rain.
- **Agri frost/chilly night**: highland TZ location AND `daily[0].temp.min <= 6°C`.
- **Heat stress**: `tempC >= 35°C` when UV is missing/low.
- **Cold comfort**: `tempC <= 14°C`.

Official alerts are stored in the `alerts` table and returned when active (`ends_at` is null or in the future).

## Time zone (EAT)

The UI formats all displayed times in **EAT** (`Africa/Dar_es_Salaam`) regardless of the device timezone.

- Helper: [src/state/time.js](src/state/time.js)
- Used by Landing/Insights/Alerts screens.

Note: the backend stores times in ISO (UTC). The app converts only for display.

## Key API routes

- `GET /api/health`
- `GET /api/locations`
- `POST /api/locations` (admin; uses `INGEST_SECRET`)
- `GET /api/locations/:id/forecast` (primary app endpoint)
- `GET /api/locations/:id/alerts`
- `POST /api/ingest` (admin; uses `INGEST_SECRET`)

## Minimalism guidelines (intentional)

- Keep Alerts actionable (short messages, grouped categories).
- Prefer a single “forecast” call that includes everything needed.
- Avoid adding large tables/charts unless requested.
