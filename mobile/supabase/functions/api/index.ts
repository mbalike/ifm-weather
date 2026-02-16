/// <reference types="jsr:@supabase/functions-js/edge-runtime.d.ts" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type Json = Record<string, unknown> | unknown[];

type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  OPENWEATHER_API_KEY?: string;
  OPENWEATHER_BASE_URL?: string;
  OPENWEATHER_ONECALL_URL?: string;
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
    OPENWEATHER_ONECALL_URL: Deno.env.get("OPENWEATHER_ONECALL_URL") ?? undefined,
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

function pickString(...vals: Array<string | null | undefined>): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
}

function toIsoFromUnixSeconds(sec: unknown): string | null {
  if (typeof sec !== "number" || !Number.isFinite(sec)) return null;
  return new Date(sec * 1000).toISOString();
}

function degToCompass(deg: number | null | undefined): string | null {
  if (typeof deg !== "number" || !Number.isFinite(deg)) return null;
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const normalized = ((deg % 360) + 360) % 360;
  const idx = Math.round((normalized / 360) * dirs.length) % dirs.length;
  return dirs[idx];
}

function computeChanceOfRainPct(raw: any, rainMm: number | null | undefined): number {
  const rain = typeof rainMm === "number" ? rainMm : 0;
  const weatherMain = String(raw?.weather?.[0]?.main ?? raw?.current?.weather?.[0]?.main ?? "").toLowerCase();
  const clouds = raw?.clouds?.all ?? raw?.current?.clouds;

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

function requireAdminSecret(env: Env, req: Request) {
  const secret = env.INGEST_SECRET;
  if (!secret) return { ok: true as const };

  const provided =
    req.headers.get("x-ingest-secret") ??
    req.headers.get("x-admin-secret") ??
    (req.headers.get("authorization")?.startsWith("Bearer ")
      ? req.headers.get("authorization")!.slice("Bearer ".length)
      : "");

  if (provided !== secret) return { ok: false as const, res: json({ message: "Unauthorized" }, { status: 401 }) };
  return { ok: true as const };
}

type LocationCreate = {
  name: string;
  region?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
};

function validateLocationCreate(x: any): { ok: true; value: LocationCreate } | { ok: false; message: string } {
  const name = String(x?.name ?? "").trim();
  const region = String(x?.region ?? "TZ").trim() || "TZ";
  const latitude = Number(x?.latitude);
  const longitude = Number(x?.longitude);
  const timezone = String(x?.timezone ?? "Africa/Dar_es_Salaam").trim() || "Africa/Dar_es_Salaam";

  if (!name) return { ok: false, message: "name is required" };
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return { ok: false, message: `invalid latitude for ${name}` };
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return { ok: false, message: `invalid longitude for ${name}` };

  return { ok: true, value: { name, region, latitude, longitude, timezone } };
}

async function handleLocationsCreate(env: Env, supabase: any, req: Request) {
  const auth = requireAdminSecret(env, req);
  if (!auth.ok) return auth.res;

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const list = Array.isArray(body) ? body : (Array.isArray(body?.locations) ? body.locations : [body]);
  if (!Array.isArray(list) || list.length === 0) return badRequest("Provide locations[] or an array body");

  const validated: LocationCreate[] = [];
  for (const item of list) {
    const v = validateLocationCreate(item);
    if (!v.ok) return badRequest(v.message);
    validated.push(v.value);
  }

  const names = validated.map((l) => l.name);
  const { data: existing, error: existingErr } = await supabase
    .from("locations")
    .select("id,name")
    .in("name", names);

  if (existingErr) return serverError("Failed to check existing locations", existingErr);
  const existingNames = new Set((existing ?? []).map((x: any) => String(x?.name)));
  const toInsert = validated.filter((l) => !existingNames.has(l.name));

  if (toInsert.length === 0) return json({ inserted: 0, skipped: validated.length, locations: existing ?? [] });

  const { data: created, error } = await supabase
    .from("locations")
    .insert(toInsert)
    .select("id,name,region,latitude,longitude,timezone");

  if (error) return serverError("Failed to create locations", error);
  return json({ inserted: created?.length ?? 0, skipped: validated.length - (created?.length ?? 0), locations: created ?? [] });
}

async function handleForecast(supabase: any, locationId: number) {
  const { data: location, error: locationErr } = await supabase
    .from("locations")
    .select("id,name,region,latitude,longitude,timezone")
    .eq("id", locationId)
    .maybeSingle();

  if (locationErr) return serverError("Failed to load location", locationErr);

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

  const pressureHpa = pickNumber(raw?.current?.pressure, raw?.main?.pressure);
  const visibilityM = pickNumber(raw?.current?.visibility, raw?.visibility);
  const visibilityKm = typeof visibilityM === "number" ? Math.round((visibilityM / 1000) * 10) / 10 : null;
  const uvi = pickNumber(raw?.current?.uvi);
  const windDeg = pickNumber(raw?.current?.wind_deg, raw?.wind?.deg);
  const windDir = degToCompass(windDeg ?? undefined);

  const sunriseIso = toIsoFromUnixSeconds(pickNumber(raw?.current?.sunrise, raw?.sys?.sunrise) ?? undefined);
  const sunsetIso = toIsoFromUnixSeconds(pickNumber(raw?.current?.sunset, raw?.sys?.sunset) ?? undefined);

  const { highC, lowC } = computeHighLowCFromRaw(raw);

  const timeline = sliceOneCallTimeline(raw);
  const localAlerts = generateLocalSafetyAlerts(raw, location);

  // Include active alerts in the forecast response so the app can render a Safety Hub without extra requests.
  const nowIso = new Date().toISOString();
  const { data: activeAlerts, error: alertsErr } = await supabase
    .from("alerts")
    .select("*")
    .eq("location_id", locationId)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
    .order("starts_at", { ascending: false });

  if (alertsErr) {
    // Non-fatal: keep forecast available even if alerts query fails.
  }

  return json({
    id: forecast.id,
    location_id: forecast.location_id,
    observed_at: forecast.observed_at,
    temp_c: forecast.temp_c,
    high_c: highC,
    low_c: lowC,
    feels_like_c: forecast.feels_like_c,
    humidity: forecast.humidity,
    wind_ms: forecast.wind_ms,
    wind_deg: windDeg,
    wind_dir: windDir,
    wind_kph: wind.windKph,
    wind_level: wind.windLevel,
    rain_mm: forecast.rain_mm,
    chance_of_rain_pct: chanceOfRainPct,
    summary: forecast.summary,
    pressure_hpa: pressureHpa,
    visibility_km: visibilityKm,
    uvi,
    sunrise: sunriseIso,
    sunset: sunsetIso,
    timeline,
    local_alerts: localAlerts,
    alerts: activeAlerts ?? [],
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
  const rainValue = openWeatherPayload?.rain ?? openWeatherPayload?.current?.rain ?? 0;
  if (typeof rainValue === "number") return rainValue;
  if (rainValue && typeof rainValue === "object") {
    const oneH = (rainValue as any)["1h"];
    if (typeof oneH === "number") return oneH;
  }
  return 0;
}

function computeHighLowCFromRaw(raw: any): { highC: number | null; lowC: number | null } {
  // One Call API shape
  const daily0 = raw?.daily?.[0];
  const highFromOneCall = pickNumber(daily0?.temp?.max, daily0?.temp?.day, daily0?.feels_like?.day);
  const lowFromOneCall = pickNumber(daily0?.temp?.min, daily0?.temp?.night, daily0?.feels_like?.night);

  // Current weather shape (not true daily high/low, but better than blank)
  const highFromWeather = pickNumber(raw?.main?.temp_max);
  const lowFromWeather = pickNumber(raw?.main?.temp_min);

  return {
    highC: pickNumber(highFromOneCall, highFromWeather),
    lowC: pickNumber(lowFromOneCall, lowFromWeather),
  };
}

type LocalSafetyAlert = {
  category: "Fishermen" | "Drivers" | "Outdoor" | "Health" | "Flood" | "Agri";
  level: "Low" | "Med" | "High";
  msg: string;
  metric?: string;
};

function generateLocalSafetyAlerts(oneCallOrWeatherPayload: any, location: any): LocalSafetyAlert[] {
  const list: LocalSafetyAlert[] = [];

  const name = String(location?.name ?? "");
  const region = String(location?.region ?? "");

  const current = oneCallOrWeatherPayload?.current ?? oneCallOrWeatherPayload;
  const windSpeedMs = pickNumber(current?.wind_speed, oneCallOrWeatherPayload?.wind?.speed);
  const windDeg = pickNumber(current?.wind_deg, oneCallOrWeatherPayload?.wind?.deg);
  const uvi = pickNumber(current?.uvi);

  const weatherDesc = pickString(current?.weather?.[0]?.description, oneCallOrWeatherPayload?.weather?.[0]?.description);

  const weatherMain = pickString(current?.weather?.[0]?.main, oneCallOrWeatherPayload?.weather?.[0]?.main);
  const thunderHint = /thunder/i.test(String(weatherMain ?? ""));

  // 🎣 Fishermen / Marine Safety (One Call doesn’t provide tides; we approximate marine risk from wind + storms.)
  const isCoastalTz = region.toUpperCase() === "TZ" && /dar|zanzibar|tanga|bagamoyo|mtwara|kilwa|pangani/i.test(name);
  const fromSouth = typeof windDeg === "number" ? windDeg >= 135 && windDeg <= 225 : false;
  if (isCoastalTz && ((typeof windSpeedMs === "number" && windSpeedMs > 8) || thunderHint)) {
    list.push({
      category: "Fishermen",
      level: (typeof windSpeedMs === "number" && windSpeedMs > 12) || thunderHint ? "High" : "Med",
      msg: thunderHint
        ? "Storm risk near the coast: avoid going far offshore."
        : (fromSouth
          ? "Kusi winds: rougher sea expected. Small boats should be cautious."
          : "Strong coastal winds: rough sea possible. Small boats should be cautious."),
      metric: typeof windSpeedMs === "number"
        ? `wind ${windSpeedMs.toFixed(1)} m/s${windDeg != null ? ` (${degToCompass(windDeg)})` : ""}`
        : "coastal storm conditions",
    });
  }

  // ☀️ UV / Outdoor Health
  if (typeof uvi === "number" && uvi >= 6 && uvi < 9) {
    list.push({
      category: "Health",
      level: "Low",
      msg: "UV is moderate-high: wear sunscreen and sunglasses if outdoors.",
      metric: `UV ${uvi}`,
    });
  }
  if (typeof uvi === "number" && uvi >= 9) {
    list.push({
      category: "Health",
      level: uvi >= 11 ? "High" : "Med",
      msg: "Extreme UV: limit outdoor time 12–2 PM. Use shade/umbrella and hydrate.",
      metric: `UV ${uvi}`,
    });
  }

  // ⛈ Outdoor activities (lightning / thunderstorms)
  if (thunderHint) {
    list.push({
      category: "Outdoor",
      level: "High",
      msg: "Thunderstorm risk: avoid open fields/trees and postpone outdoor activities if possible.",
      metric: "thunderstorm",
    });
  }

  // 🚗 Drivers/Commuters (next hour) — flash-flood + reduced visibility
  const h0 = oneCallOrWeatherPayload?.hourly?.[0];
  const rain1h = pickNumber(h0?.rain?.["1h"], h0?.rain, current?.rain?.["1h"], oneCallOrWeatherPayload?.rain?.["1h"], oneCallOrWeatherPayload?.rain);
  if (typeof rain1h === "number" && rain1h > 5) {
    const darHint = /dar/i.test(name) ? " (watch Jangwani/Msimbazi low areas)" : "";
    list.push({
      category: "Flood",
      level: rain1h > 12 ? "High" : "Med",
      msg: `Intense rain: flash-flood risk in low-lying areas${darHint}.`,
      metric: `${rain1h.toFixed(1)} mm/1h`,
    });
  }

  const visibilityM = pickNumber(current?.visibility, oneCallOrWeatherPayload?.visibility);
  if (typeof visibilityM === "number" && visibilityM <= 4000) {
    list.push({
      category: "Drivers",
      level: visibilityM <= 2000 ? "High" : "Med",
      msg: "Low visibility: slow down, use headlights, and keep extra distance.",
      metric: `${Math.round(visibilityM / 100) / 10} km visibility`,
    });
  }

  // 😷 Dust / haze (mask suggestion)
  const dustHint = /dust|sand|haze|smoke/i.test(`${weatherMain ?? ""} ${weatherDesc ?? ""}`);
  if (dustHint || (typeof visibilityM === "number" && visibilityM <= 6000 && (!rain1h || rain1h <= 1))) {
    list.push({
      category: "Health",
      level: typeof visibilityM === "number" && visibilityM <= 3000 ? "Med" : "Low",
      msg: "Dust/haze possible: consider wearing a mask if sensitive.",
      metric: dustHint ? "haze/dust" : `${Math.round(visibilityM! / 100) / 10} km visibility`,
    });
  }

  // 🌾 Agri-Frost (night min)
  const d0 = oneCallOrWeatherPayload?.daily?.[0];
  const tMin = pickNumber(d0?.temp?.min);
  const isHighlandTz = region.toUpperCase() === "TZ" && /arusha|mbeya|iringa|njombe|manyara/i.test(name);
  if (isHighlandTz && typeof tMin === "number" && tMin <= 6) {
    list.push({
      category: "Agri",
      level: tMin <= 3 ? "High" : "Med",
      msg: "Frost/chilly night risk: protect sensitive crops and seedlings tonight.",
      metric: `min ${tMin.toFixed(0)}°C`,
    });
  }

  // 🥵 Heat stress for outdoor workers (fallback when UVI missing)
  const tempC = pickNumber(current?.temp, oneCallOrWeatherPayload?.main?.temp);
  if (typeof tempC === "number" && tempC >= 35 && (uvi == null || uvi < 9)) {
    list.push({
      category: "Health",
      level: tempC >= 38 ? "High" : "Med",
      msg: "High heat: take breaks, drink water, and avoid heavy work during peak sun.",
      metric: `${tempC.toFixed(0)}°C`,
    });
  }

  // 🧥 Cold comfort (simple clothing suggestion)
  if (typeof tempC === "number" && tempC <= 14) {
    list.push({
      category: "Health",
      level: tempC <= 10 ? "Med" : "Low",
      msg: "Cool conditions: wear warm/heavy clothing if outdoors early/late.",
      metric: `${tempC.toFixed(0)}°C`,
    });
  }

  return list;
}

function sliceOneCallTimeline(raw: any) {
  const current = raw?.current ?? null;
  const hourly = Array.isArray(raw?.hourly) ? raw.hourly.slice(0, 24) : [];
  const daily = Array.isArray(raw?.daily) ? raw.daily.slice(0, 7) : [];

  let currentOut: any = null;
  if (current) {
    currentOut = {
      dt: toIsoFromUnixSeconds(current?.dt),
      temp_c: pickNumber(current?.temp),
      uvi: pickNumber(current?.uvi),
      humidity: pickNumber(current?.humidity),
      pressure_hpa: pickNumber(current?.pressure),
      visibility_m: pickNumber(current?.visibility),
      wind_speed_ms: pickNumber(current?.wind_speed),
      wind_deg: pickNumber(current?.wind_deg),
      wind_dir: degToCompass(pickNumber(current?.wind_deg) ?? undefined),
      clouds: pickNumber(current?.clouds),
      weather_main: pickString(current?.weather?.[0]?.main),
      weather_desc: pickString(current?.weather?.[0]?.description),
      weather_icon: pickString(current?.weather?.[0]?.icon),
    };
  } else if (raw?.main || raw?.weather || raw?.wind) {
    // Current-weather endpoint shape fallback (/data/2.5/weather)
    currentOut = {
      dt: typeof raw?.dt === "number" ? new Date(raw.dt * 1000).toISOString() : null,
      temp_c: pickNumber(raw?.main?.temp),
      uvi: null,
      humidity: pickNumber(raw?.main?.humidity),
      pressure_hpa: pickNumber(raw?.main?.pressure),
      visibility_m: pickNumber(raw?.visibility),
      wind_speed_ms: pickNumber(raw?.wind?.speed),
      wind_deg: pickNumber(raw?.wind?.deg),
      wind_dir: degToCompass(pickNumber(raw?.wind?.deg) ?? undefined),
      clouds: pickNumber(raw?.clouds?.all),
      weather_main: pickString(raw?.weather?.[0]?.main),
      weather_desc: pickString(raw?.weather?.[0]?.description),
      weather_icon: pickString(raw?.weather?.[0]?.icon),
    };
  }

  const hourlyOut = hourly.map((h: any) => ({
    dt: toIsoFromUnixSeconds(h?.dt),
    temp_c: pickNumber(h?.temp),
    pop: pickNumber(h?.pop) ?? 0,
    rain_1h_mm: pickNumber(h?.rain?.["1h"], h?.rain) ?? 0,
    wind_speed_ms: pickNumber(h?.wind_speed),
    wind_deg: pickNumber(h?.wind_deg),
    weather_main: pickString(h?.weather?.[0]?.main),
    weather_desc: pickString(h?.weather?.[0]?.description),
    weather_icon: pickString(h?.weather?.[0]?.icon),
  }));

  const dailyOut = daily.map((d: any) => ({
    dt: toIsoFromUnixSeconds(d?.dt),
    temp_max_c: pickNumber(d?.temp?.max),
    temp_min_c: pickNumber(d?.temp?.min),
    pop: pickNumber(d?.pop) ?? 0,
    rain_mm: pickNumber(d?.rain) ?? 0,
    uvi: pickNumber(d?.uvi),
    weather_main: pickString(d?.weather?.[0]?.main),
    weather_desc: pickString(d?.weather?.[0]?.description),
    weather_icon: pickString(d?.weather?.[0]?.icon),
  }));

  return { current: currentOut, hourly: hourlyOut, daily: dailyOut };
}

function deriveAlertLevel(event: string, tags: unknown): "watch" | "warning" | "emergency" {
  const e = event.toLowerCase();
  const tagStr = Array.isArray(tags) ? tags.join(" ").toLowerCase() : String(tags ?? "").toLowerCase();

  if (/extreme|hurricane|tornado|severe|storm surge/.test(e) || /extreme|severe/.test(tagStr)) return "emergency";
  if (/warning/.test(e) || /warning/.test(tagStr)) return "warning";
  return "watch";
}

function safeText(val: unknown, max = 900) {
  const s = String(val ?? "");
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

async function upsertOpenWeatherAlerts(supabase: any, locationId: number, oneCallPayload: any) {
  const alerts = oneCallPayload?.alerts;
  if (!Array.isArray(alerts) || alerts.length === 0) return { created: 0 };

  let created = 0;

  for (const a of alerts) {
    const event = String(a?.event ?? "Weather alert").trim() || "Weather alert";
    const sender = String(a?.sender_name ?? "").trim();
    const startSec = typeof a?.start === "number" ? a.start : null;
    const endSec = typeof a?.end === "number" ? a.end : null;
    const startsAt = startSec != null ? new Date(startSec * 1000).toISOString() : new Date().toISOString();
    const endsAt = endSec != null ? new Date(endSec * 1000).toISOString() : null;

    // Use a stable rule_ref to avoid duplicates.
    const ruleRef = safeText(`ow:${event}:${startSec ?? "na"}:${sender}` , 180);

    const { data: existing, error: existingError } = await supabase
      .from("alerts")
      .select("id")
      .eq("location_id", locationId)
      .eq("source", "openweather")
      .eq("rule_ref", ruleRef)
      .limit(1);

    if (existingError) continue;
    if (Array.isArray(existing) && existing.length > 0) continue;

    const level = deriveAlertLevel(event, a?.tags);
    const title = safeText(event, 120);
    const message = safeText(a?.description ?? a?.summary ?? "", 1200);

    const insertPayload: any = {
      location_id: locationId,
      level,
      type: "weather",
      title,
      message,
      starts_at: startsAt,
      ends_at: endsAt,
      source: "openweather",
      rule_ref: ruleRef,
    };

    const { error: insertError } = await supabase
      .from("alerts")
      .insert(insertPayload);

    if (!insertError) created += 1;
  }

  return { created };
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
  const oneCallUrl = env.OPENWEATHER_ONECALL_URL ?? "https://api.openweathermap.org/data/3.0/onecall";
  if (!apiKey) return serverError("OpenWeather API key missing (OPENWEATHER_API_KEY)");

  const { data: locations, error } = await supabase
    .from("locations")
    .select("id,name,latitude,longitude,timezone");

  if (error) return serverError("Failed to load locations", error);

  const results: any[] = [];

  for (const location of locations ?? []) {
    try {
      // Prefer One Call (daily highs/lows + official alerts), but fall back to current weather if not available.
      let payload: any = null;
      let observedAt = new Date();
      let tempC: number | null = null;
      let feelsLikeC: number | null = null;
      let humidity: number | null = null;
      let windMs: number | null = null;
      let summary: string | null = null;

      const tryOneCall = async () => {
        const ow = new URL(oneCallUrl);
        ow.searchParams.set("lat", String(location.latitude));
        ow.searchParams.set("lon", String(location.longitude));
        ow.searchParams.set("appid", apiKey);
        ow.searchParams.set("units", "metric");
        // Keep hourly + daily to power the app UI from a single stored payload.
        ow.searchParams.set("exclude", "minutely");

        const resp = await fetch(ow.toString(), { headers: { "accept": "application/json" } });
        if (!resp.ok) return { ok: false, message: await resp.text() };

        payload = await resp.json();

        const current = payload?.current ?? {};
        const weather0 = current?.weather?.[0] ?? {};

        observedAt = typeof current?.dt === "number" ? new Date(current.dt * 1000) : new Date();
        tempC = pickNumber(current?.temp);
        feelsLikeC = pickNumber(current?.feels_like);
        humidity = pickNumber(current?.humidity);
        windMs = pickNumber(current?.wind_speed);
        summary = weather0?.description ?? null;

        return { ok: true };
      };

      const tryCurrentWeather = async () => {
        const ow = new URL(baseUrl);
        ow.searchParams.set("lat", String(location.latitude));
        ow.searchParams.set("lon", String(location.longitude));
        ow.searchParams.set("appid", apiKey);
        ow.searchParams.set("units", "metric");

        const resp = await fetch(ow.toString(), { headers: { "accept": "application/json" } });
        if (!resp.ok) return { ok: false, message: await resp.text() };

        payload = await resp.json();
        const weather0 = payload?.weather?.[0] ?? {};
        const main = payload?.main ?? {};

        observedAt = typeof payload?.dt === "number" ? new Date(payload.dt * 1000) : new Date();
        tempC = pickNumber(main?.temp);
        feelsLikeC = pickNumber(main?.feels_like);
        humidity = pickNumber(main?.humidity);
        windMs = pickNumber(payload?.wind?.speed);
        summary = weather0?.description ?? null;

        return { ok: true };
      };

      const oneCallResult = await tryOneCall();
      if (!oneCallResult.ok) {
        const currentResult = await tryCurrentWeather();
        if (!currentResult.ok) {
          results.push({ location_id: location.id, status: "error", message: oneCallResult.message ?? currentResult.message ?? "Failed to fetch OpenWeather" });
          continue;
        }
      }

      const rainMm = parseRainMm(payload);

      const { data: forecast, error: forecastErr } = await supabase
        .from("forecasts")
        .insert({
          location_id: location.id,
          observed_at: observedAt.toISOString(),
          temp_c: tempC,
          feels_like_c: feelsLikeC,
          humidity,
          wind_ms: windMs,
          rain_mm: rainMm,
          summary,
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

      try {
        const owCreated = await upsertOpenWeatherAlerts(supabase, location.id, payload);
        alertsCreated += owCreated.created;
      } catch {
        // Ignore OpenWeather alert ingestion errors.
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

    // /api/locations (POST) - create locations (admin)
    if (req.method === "POST" && parts[0] === "locations" && parts.length === 1) {
      return await handleLocationsCreate(env, supabase, req);
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
