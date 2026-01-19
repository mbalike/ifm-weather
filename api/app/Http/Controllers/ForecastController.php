<?php

namespace App\Http\Controllers;

use App\Models\Location;

class ForecastController extends Controller
{
    public function show(Location $location)
    {
        $forecast = $location->forecasts()
            ->orderByDesc('observed_at')
            ->first();

        if (!$forecast) {
            return response()->json(['message' => 'No forecast available for this location'], 404);
        }

        $raw = $forecast->raw ?? [];
        $weatherMain = strtolower(data_get($raw, 'weather.0.main', ''));
        $clouds = data_get($raw, 'clouds.all');

        $rainMm = $forecast->rain_mm ?? 0.0;
        $chanceOfRainPct = 10;

        if ($rainMm > 0) {
            $chanceOfRainPct = 80;
        } elseif (in_array($weatherMain, ['rain', 'drizzle', 'thunderstorm', 'snow'], true)) {
            $chanceOfRainPct = 75;
        } elseif (is_numeric($clouds)) {
            $clouds = (int) $clouds;
            if ($clouds >= 85) {
                $chanceOfRainPct = 45;
            } elseif ($clouds >= 60) {
                $chanceOfRainPct = 30;
            } elseif ($clouds >= 30) {
                $chanceOfRainPct = 15;
            } else {
                $chanceOfRainPct = 5;
            }
        }

        $windMs = $forecast->wind_ms;
        $windKph = is_numeric($windMs) ? round(((float) $windMs) * 3.6, 1) : null;

        $windLevel = 'unknown';
        if (is_numeric($windMs)) {
            $wind = (float) $windMs;
            if ($wind >= 15) {
                $windLevel = 'strong';
            } elseif ($wind >= 9) {
                $windLevel = 'breezy';
            } else {
                $windLevel = 'calm';
            }
        }

        return response()->json([
            'id' => $forecast->id,
            'location_id' => $forecast->location_id,
            'observed_at' => $forecast->observed_at,
            'temp_c' => $forecast->temp_c,
            'feels_like_c' => $forecast->feels_like_c,
            'humidity' => $forecast->humidity,
            'wind_ms' => $forecast->wind_ms,
            'wind_kph' => $windKph,
            'wind_level' => $windLevel,
            'rain_mm' => $forecast->rain_mm,
            'chance_of_rain_pct' => $chanceOfRainPct,
            'summary' => $forecast->summary,
        ]);
    }
}
