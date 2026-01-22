/// <reference types="jsr:@supabase/functions-js/edge-runtime.d.ts" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type Json = Record<string, unknown> | unknown[];

type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  OPENWEATHER_API_KEY?: string;
  OPENWEATHER_BASE_URL?: string;
  INGEST_SECRET?: string;
};

const corsHeaders: HeadersInit = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-ingest-secret",
  "access-control-allow-methods": "GET,POST,OPTIONS",
};

function json(data: Json, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders,
      ...(init.headers ?? {}),
    },
  });
}

function badRequest(message: string, extra: Json = {}) {
  return json({ message, ...((extra as any) ?? {}) }, { status: 400 });
}

function notFound() {
  return json({ message: "Not found" }, { status: 404 });
}

function serverError(message: string, details?: unknown) {
  return json({ message, details }, { status: 500 });
}

function getEnv(): Env {
  // Deno.env is available in Supabase Edge Runtime.
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!SUPABASE_URL) throw new Error("Missing SUPABASE_URL");
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  return {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    OPENWEATHER_API_KEY: Deno.env.get("OPENWEATHER_API_KEY") ?? undefined,
    OPENWEATHER_BASE_URL: Deno.env.get("OPENWEATHER_BASE_URL") ?? undefined,
    INGEST_SECRET: Deno.env.get("INGEST_SECRET") ?? undefined,
  };
}

function createAdminClient(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

function parsePath(url: URL): string[] {
  // Accept multiple shapes depending on deployment/proxying:
  // - /api/locations
  // - /functions/v1/api/locations
  // - /locations (if the platform strips prefixes)
  const parts = url.pathname.split("/").filter(Boolean);

  if (parts.length === 0) return [];
  if (parts[0] === "api") return parts.slice(1);

  const apiIndex = parts.lastIndexOf("api");
  if (apiIndex !== -1 && apiIndex < parts.length - 1) return parts.slice(apiIndex + 1);

  // Fall back to treating the whole path as the route.
  return parts;
}

function pickNumber(...vals: Array<number | null | undefined>): number | null {
  for (const v of vals) {
    if (typeof v === "number" && !Number.isNaN(v)) return v;
  }
  return null;
}

function computeChanceOfRainPct(raw: any, rainMm: number | null | undefined): number {
  const rain = typeof rainMm === "number" ? rainMm : 0;
  const weatherMain = String(raw?.weather?.[0]?.main ?? "").toLowerCase();
  const clouds = raw?.clouds?.all;

  if (rain > 0) return 80;
  if (["rain", "drizzle", "thunderstorm", "snow"].includes(weatherMain)) return 75;

  if (typeof clouds === "number") {
    if (clouds >= 85) return 45;
    if (clouds >= 60) return 30;
    if (clouds >= 30) return 15;
    return 5;
  }

  return 10;
}

function computeWind(windMs: number | null | undefined) {
  const windKph = typeof windMs === "number" ? Math.round(windMs * 3.6 * 10) / 10 : null;

  let windLevel: "calm" | "breezy" | "strong" | "unknown" = "unknown";
  if (typeof windMs === "number") {
    if (windMs >= 15) windLevel = "strong";
    else if (windMs >= 9) windLevel = "breezy";
    else windLevel = "calm";
  }

  return { windKph, windLevel };
}

async function handleLocations(supabase: any) {
  const { data, error } = await supabase
    .from("locations")
    .select("id,name,region,latitude,longitude,timezone")
    .order("name", { ascending: true });

  if (error) return serverError("Failed to load locations", error);
  return json(data ?? []);
}

async function handleForecast(supabase: any, locationId: number) {
  const { data: forecast, error } = await supabase
    .from("forecasts")
    .select("id,location_id,observed_at,temp_c,feels_like_c,humidity,wind_ms,rain_mm,summary,raw")
    .eq("location_id", locationId)
    .order("observed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return serverError("Failed to load forecast", error);
  if (!forecast) return json({ message: "No forecast available for this location" }, { status: 404 });

  const raw = forecast.raw ?? {};
  const chanceOfRainPct = computeChanceOfRainPct(raw, forecast.rain_mm);
  const wind = computeWind(forecast.wind_ms);

  return json({
    id: forecast.id,
    location_id: forecast.location_id,
    observed_at: forecast.observed_at,
    temp_c: forecast.temp_c,
    feels_like_c: forecast.feels_like_c,
    humidity: forecast.humidity,
    wind_ms: forecast.wind_ms,
    wind_kph: wind.windKph,
    wind_level: wind.windLevel,
    rain_mm: forecast.rain_mm,
    chance_of_rain_pct: chanceOfRainPct,
    summary: forecast.summary,
  });
}

async function handleAlerts(supabase: any, locationId: number) {
  const nowIso = new Date().toISOString();

  // Active if ends_at is null or ends_at >= now
  const { data, error } = await supabase
    .from("alerts")
    .select("*")
    .eq("location_id", locationId)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
    .order("starts_at", { ascending: false });

  if (error) return serverError("Failed to load alerts", error);
  return json(data ?? []);
}

async function handleHazardsIndex(supabase: any, url: URL) {
  const limitRaw = url.searchParams.get("limit");
  const locationIdRaw = url.searchParams.get("location_id");

  const limit = Math.max(1, Math.min(200, limitRaw ? Number(limitRaw) : 100));
  if (Number.isNaN(limit)) return badRequest("Invalid limit");

  let query = supabase
    .from("reports")
    .select("*, location:locations(id,name,region)")
    .order("reported_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (locationIdRaw) {
    const locationId = Number(locationIdRaw);
    if (!Number.isFinite(locationId)) return badRequest("Invalid location_id");
    query = query.eq("location_id", locationId);
  }

  const { data, error } = await query;
  if (error) return serverError("Failed to load hazards", error);
  return json(data ?? []);
}

async function handleHazardsByLocation(supabase: any, locationId: number, url: URL) {
  const limitRaw = url.searchParams.get("limit");
  const limit = Math.max(1, Math.min(200, limitRaw ? Number(limitRaw) : 100));
  if (Number.isNaN(limit)) return badRequest("Invalid limit");

  const { data, error } = await supabase
    .from("reports")
    .select("*, location:locations(id,name,region)")
    .eq("location_id", locationId)
    .order("reported_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (error) return serverError("Failed to load hazards", error);
  return json(data ?? []);
}

async function handleReportCreate(supabase: any, req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("Invalid JSON body");

  const locationId = Number((body as any).location_id);
  if (!Number.isFinite(locationId)) return badRequest("location_id is required");

  const type = String((body as any).type ?? "").trim();
  if (!type || type.length > 32) return badRequest("type is required (max 32)");

  const severity = (body as any).severity != null ? String((body as any).severity).trim() : null;
  if (severity && severity.length > 16) return badRequest("severity max 16");

  const note = (body as any).note != null ? String((body as any).note) : null;
  const photoUrl = (body as any).photo_url != null ? String((body as any).photo_url) : null;
  if (photoUrl && photoUrl.length > 255) return badRequest("photo_url max 255");

  const reportedAt = (body as any).reported_at != null ? new Date(String((body as any).reported_at)).toISOString() : new Date().toISOString();

  const { data, error } = await supabase
    .from("reports")
    .insert({
      location_id: locationId,
      type,
      severity,
      note,
      photo_url: photoUrl,
      reported_at: reportedAt,
    })
    .select("*")
    .single();

  if (error) return serverError("Failed to create report", error);
  return json(data, { status: 201 });
}

async function handleDeviceTokenUpsert(supabase: any, req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("Invalid JSON body");

  const expoToken = String((body as any).expo_token ?? "").trim();
  if (!expoToken || expoToken.length > 255) return badRequest("expo_token is required (max 255)");

  const platform = (body as any).platform != null ? String((body as any).platform).trim() : null;
  const locationIdRaw = (body as any).location_id;
  const locationId = locationIdRaw != null ? Number(locationIdRaw) : null;
  if (locationId != null && !Number.isFinite(locationId)) return badRequest("Invalid location_id");

  const payload = {
    expo_token: expoToken,
    platform,
    location_id: locationId,
    last_seen_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("device_tokens")
    .upsert(payload, { onConflict: "expo_token" })
    .select("*")
    .single();

  if (error) return serverError("Failed to store device token", error);
  return json(data);
}

function parseRainMm(openWeatherPayload: any): number {
  const rainValue = openWeatherPayload?.rain ?? 0;
  if (typeof rainValue === "number") return rainValue;
  if (rainValue && typeof rainValue === "object") {
    const oneH = (rainValue as any)["1h"];
    if (typeof oneH === "number") return oneH;
  }
  return 0;
}

async function deriveAndCreateAlert(supabase: any, location: any, forecastRow: any) {
  const rain = typeof forecastRow?.rain_mm === "number" ? forecastRow.rain_mm : Number(forecastRow?.rain_mm ?? 0);

  let level: string | null = null;
  let ruleRef: string | null = null;

  if (rain >= 60) {
    level = "emergency";
    ruleRef = "rain>=60mm";
  } else if (rain >= 40) {
    level = "warning";
    ruleRef = "rain>=40mm";
  } else if (rain >= 25) {
    level = "watch";
    ruleRef = "rain>=25mm";
  }

  if (!level) return { created: false };

  const now = new Date();
  const endsAt = new Date(now.getTime() + 6 * 60 * 60 * 1000);

  const { data: existing, error: existingError } = await supabase
    .from("alerts")
    .select("id")
    .eq("location_id", location.id)
    .eq("type", "flood")
    .eq("level", level)
    .or(`ends_at.is.null,ends_at.gte.${now.toISOString()}`)
    .limit(1);

  if (existingError) throw existingError;
  if (Array.isArray(existing) && existing.length > 0) return { created: false };

  const title = `${level.charAt(0).toUpperCase()}${level.slice(1)} alert for ${location.name}`;
  const message = `Heavy rainfall detected: ${Number(rain).toFixed(1)} mm in the last hour.`;

  const { data: created, error: createError } = await supabase
    .from("alerts")
    .insert({
      location_id: location.id,
      level,
      type: "flood",
      title,
      message,
      starts_at: now.toISOString(),
      ends_at: endsAt.toISOString(),
      source: "openweather",
      rule_ref: ruleRef,
    })
    .select("*")
    .single();

  if (createError) throw createError;
  return { created: true, alert: created };
}

async function handleIngest(env: Env, supabase: any, req: Request) {
  // Protect this endpoint (so random users can’t spam OpenWeather / your DB).
  const secret = env.INGEST_SECRET;
  if (secret) {
    const provided = req.headers.get("x-ingest-secret") ?? "";
    if (provided !== secret) {
      return json({ message: "Unauthorized" }, { status: 401 });
    }
  }

  const apiKey = env.OPENWEATHER_API_KEY;
  const baseUrl = env.OPENWEATHER_BASE_URL ?? "https://api.openweathermap.org/data/2.5/weather";
  if (!apiKey) return serverError("OpenWeather API key missing (OPENWEATHER_API_KEY)");

  const { data: locations, error } = await supabase
    .from("locations")
    .select("id,name,latitude,longitude,timezone");

  if (error) return serverError("Failed to load locations", error);

  const results: any[] = [];

  for (const location of locations ?? []) {
    try {
      const ow = new URL(baseUrl);
      ow.searchParams.set("lat", String(location.latitude));
      ow.searchParams.set("lon", String(location.longitude));
      ow.searchParams.set("appid", apiKey);
      ow.searchParams.set("units", "metric");

      const resp = await fetch(ow.toString(), { headers: { "accept": "application/json" } });
      if (!resp.ok) {
        results.push({ location_id: location.id, status: "error", message: await resp.text() });
        continue;
      }

      const payload = await resp.json();
      const weather0 = payload?.weather?.[0] ?? {};
      const main = payload?.main ?? {};

      const observedAt = typeof payload?.dt === "number"
        ? new Date(payload.dt * 1000)
        : new Date();

      const rainMm = parseRainMm(payload);

      const { data: forecast, error: forecastErr } = await supabase
        .from("forecasts")
        .insert({
          location_id: location.id,
          observed_at: observedAt.toISOString(),
          temp_c: pickNumber(main?.temp),
          feels_like_c: pickNumber(main?.feels_like),
          humidity: pickNumber(main?.humidity),
          wind_ms: pickNumber(payload?.wind?.speed),
          rain_mm: rainMm,
          summary: weather0?.description ?? null,
          raw: payload,
        })
        .select("*")
        .single();

      if (forecastErr) {
        results.push({ location_id: location.id, status: "error", message: forecastErr.message ?? forecastErr });
        continue;
      }

      let alertsCreated = 0;
      try {
        const derived = await deriveAndCreateAlert(supabase, location, forecast);
        if (derived.created) alertsCreated += 1;
      } catch {
        // Don’t fail entire ingest if alert derivation fails.
      }

      results.push({
        location_id: location.id,
        status: "ok",
        forecast_id: forecast.id,
        alerts_created: alertsCreated,
      });
    } catch (e) {
      results.push({ location_id: location.id, status: "error", message: (e as any)?.message ?? String(e) });
    }
  }

  return json({ results });
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const env = getEnv();
    const supabase = createAdminClient(env);

    const url = new URL(req.url);
    const parts = parsePath(url);

    if (parts.length === 0) {
      return notFound();
    }

    // /api/health
    if (req.method === "GET" && parts[0] === "health") {
      return json({ status: "ok" });
    }

    // /api/locations
    if (req.method === "GET" && parts[0] === "locations" && parts.length === 1) {
      return await handleLocations(supabase);
    }

    // /api/locations/:id/forecast
    if (req.method === "GET" && parts[0] === "locations" && parts[1] && parts[2] === "forecast") {
      const locationId = Number(parts[1]);
      if (!Number.isFinite(locationId)) return badRequest("Invalid location id");
      return await handleForecast(supabase, locationId);
    }

    // /api/locations/:id/alerts
    if (req.method === "GET" && parts[0] === "locations" && parts[1] && parts[2] === "alerts") {
      const locationId = Number(parts[1]);
      if (!Number.isFinite(locationId)) return badRequest("Invalid location id");
      return await handleAlerts(supabase, locationId);
    }

    // /api/locations/:id/hazards
    if (req.method === "GET" && parts[0] === "locations" && parts[1] && parts[2] === "hazards") {
      const locationId = Number(parts[1]);
      if (!Number.isFinite(locationId)) return badRequest("Invalid location id");
      return await handleHazardsByLocation(supabase, locationId, url);
    }

    // /api/hazards (GET)
    if (req.method === "GET" && parts[0] === "hazards") {
      return await handleHazardsIndex(supabase, url);
    }

    // /api/hazards (POST)
    if (req.method === "POST" && parts[0] === "hazards") {
      return await handleReportCreate(supabase, req);
    }

    // /api/reports (POST)
    if (req.method === "POST" && parts[0] === "reports") {
      return await handleReportCreate(supabase, req);
    }

    // /api/device-tokens (POST)
    if (req.method === "POST" && parts[0] === "device-tokens") {
      return await handleDeviceTokenUpsert(supabase, req);
    }

    // /api/ingest (POST)
    if (req.method === "POST" && parts[0] === "ingest") {
      return await handleIngest(env, supabase, req);
    }

    return notFound();
  } catch (e) {
    return serverError((e as any)?.message ?? "Unhandled error", e);
  }
});
