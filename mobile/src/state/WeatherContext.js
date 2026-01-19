import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from './apiBaseUrl';

const WeatherContext = createContext(null);

function pickNumber(...vals) {
  for (const v of vals) {
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
  }
  return null;
}

function normalizeForecast(raw) {
  const currentTemp = pickNumber(raw?.temp_c, raw?.temp, raw?.current?.temp_c, raw?.current?.temp);
  const humidity = pickNumber(raw?.humidity, raw?.current?.humidity);
  const windMs = pickNumber(raw?.wind_ms, raw?.current?.wind_ms, raw?.wind_kph ? raw.wind_kph / 3.6 : null);
  const rainMm = pickNumber(raw?.rain_mm, raw?.current?.rain_mm, raw?.precip_mm, raw?.current?.precip_mm);

  const high = pickNumber(raw?.high_c, raw?.today?.high_c, raw?.day?.maxtemp_c);
  const low = pickNumber(raw?.low_c, raw?.today?.low_c, raw?.day?.mintemp_c);

  return {
    raw,
    summary: raw?.summary ?? raw?.condition?.text ?? raw?.current?.condition?.text ?? null,
    tempC: currentTemp,
    highC: high,
    lowC: low,
    humidity,
    windMs,
    rainMm,
    chanceOfRainPct: pickNumber(raw?.chance_of_rain_pct, raw?.daily_chance_of_rain, raw?.day?.daily_chance_of_rain),
    uvIndex: pickNumber(raw?.uv, raw?.uv_index, raw?.current?.uv),
    sunrise: raw?.sunrise ?? raw?.astro?.sunrise ?? null,
    sunset: raw?.sunset ?? raw?.astro?.sunset ?? null,
  };
}

export function WeatherProvider({ children }) {
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);

  const [forecast, setForecast] = useState(null);
  const [alerts, setAlerts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadLocations = useCallback(async () => {
    const res = await fetch(`${API_BASE_URL}/api/locations`);
    if (!res.ok) throw new Error('Failed to load locations');
    const data = await res.json();
    setLocations(Array.isArray(data) ? data : []);
    return Array.isArray(data) ? data : [];
  }, []);

  const loadForLocation = useCallback(async (location) => {
    if (!location?.id) return;

    const [forecastRes, alertsRes] = await Promise.all([
      fetch(`${API_BASE_URL}/api/locations/${location.id}/forecast`),
      fetch(`${API_BASE_URL}/api/locations/${location.id}/alerts`).catch(() => null),
    ]);

    if (!forecastRes.ok) throw new Error('Failed to load forecast');

    const forecastData = await forecastRes.json();
    const alertsData = alertsRes && alertsRes.ok ? await alertsRes.json() : [];

    setForecast(normalizeForecast(forecastData));
    setAlerts(Array.isArray(alertsData) ? alertsData : []);
  }, []);

  const refresh = useCallback(async () => {
    if (!selectedLocation) return;
    setError(null);
    try {
      await loadForLocation(selectedLocation);
    } catch (e) {
      setError(e?.message || 'Failed to refresh');
    }
  }, [loadForLocation, selectedLocation]);

  const selectLocation = useCallback(async (loc) => {
    setSelectedLocation(loc);
    setError(null);
    try {
      await loadForLocation(loc);
    } catch (e) {
      setError(e?.message || 'Failed to load forecast');
    }
  }, [loadForLocation]);

  useEffect(() => {
    let alive = true;

    const boot = async () => {
      try {
        setLoading(true);
        setError(null);

        const locs = await loadLocations();
        if (!alive) return;

        const first = locs[0] ?? null;
        setSelectedLocation(first);

        if (first) {
          await loadForLocation(first);
        } else {
          setForecast(null);
          setAlerts([]);
        }
      } catch (e) {
        if (!alive) return;
        setError(e?.message || 'Failed to load');
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    };

    boot();
    return () => {
      alive = false;
    };
  }, [loadForLocation, loadLocations]);

  const value = useMemo(() => ({
    locations,
    selectedLocation,
    forecast,
    alerts,
    loading,
    error,
    refresh,
    selectLocation,
  }), [alerts, error, forecast, loading, locations, refresh, selectLocation, selectedLocation]);

  return (
    <WeatherContext.Provider value={value}>
      {children}
    </WeatherContext.Provider>
  );
}

export function useWeather() {
  const ctx = useContext(WeatherContext);
  if (!ctx) {
    throw new Error('useWeather must be used within WeatherProvider');
  }
  return ctx;
}
