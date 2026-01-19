<?php

namespace App\Services;

use App\Models\Alert;
use App\Models\Forecast;
use App\Models\Location;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;

class ForecastIngestionService
{
    public function ingest(): array
    {
        $apiKey = config('services.openweather.key', env('OPENWEATHER_API_KEY'));
        $baseUrl = config('services.openweather.base_url', env('OPENWEATHER_BASE_URL', 'https://api.openweathermap.org/data/2.5/weather'));

        if (!$apiKey) {
            throw new \RuntimeException('OpenWeather API key missing.');
        }

        $results = [];

        foreach (Location::all() as $location) {
            $response = Http::timeout(12)->get($baseUrl, [
                'lat' => $location->latitude,
                'lon' => $location->longitude,
                'appid' => $apiKey,
                'units' => 'metric',
            ]);

            if (!$response->successful()) {
                $results[] = [
                    'location_id' => $location->id,
                    'status' => 'error',
                    'message' => $response->body(),
                ];
                continue;
            }

            $payload = $response->json();
            $weather = $payload['weather'][0] ?? [];
            $main = $payload['main'] ?? [];

            $rainValue = $payload['rain'] ?? 0;
            $rainMm = is_array($rainValue) ? ($rainValue['1h'] ?? 0) : ($rainValue ?? 0);

            $observedAt = isset($payload['dt'])
                ? Carbon::createFromTimestamp($payload['dt'])->setTimezone($location->timezone)
                : now($location->timezone);

            $forecast = Forecast::create([
                'location_id' => $location->id,
                'observed_at' => $observedAt,
                'temp_c' => $main['temp'] ?? null,
                'feels_like_c' => $main['feels_like'] ?? null,
                'humidity' => $main['humidity'] ?? null,
                'wind_ms' => $payload['wind']['speed'] ?? null,
                'rain_mm' => $rainMm,
                'summary' => $weather['description'] ?? null,
                'raw' => $payload,
            ]);

            $alerts = $this->deriveAlerts($location, $forecast);

            $results[] = [
                'location_id' => $location->id,
                'status' => 'ok',
                'forecast_id' => $forecast->id,
                'alerts_created' => count($alerts),
            ];
        }

        return $results;
    }

    /**
     * Create simple rain-based alerts if thresholds are met.
     */
    protected function deriveAlerts(Location $location, Forecast $forecast): array
    {
        $rain = $forecast->rain_mm ?? 0;
        $level = null;
        $rule = null;

        if ($rain >= 60) {
            $level = 'emergency';
            $rule = 'rain>=60mm';
        } elseif ($rain >= 40) {
            $level = 'warning';
            $rule = 'rain>=40mm';
        } elseif ($rain >= 25) {
            $level = 'watch';
            $rule = 'rain>=25mm';
        }

        if (!$level) {
            return [];
        }

        $now = now($location->timezone);

        $alreadyActive = Alert::where('location_id', $location->id)
            ->where('type', 'flood')
            ->where('level', $level)
            ->where(function ($query) use ($now) {
                $query->whereNull('ends_at')->orWhere('ends_at', '>=', $now);
            })
            ->exists();

        if ($alreadyActive) {
            return [];
        }

        $alert = Alert::create([
            'location_id' => $location->id,
            'level' => $level,
            'type' => 'flood',
            'title' => ucfirst($level).' alert for '.$location->name,
            'message' => 'Heavy rainfall detected: '.number_format($rain, 1).' mm in the last hour.',
            'starts_at' => $now,
            'ends_at' => $now->copy()->addHours(6),
            'source' => 'openweather',
            'rule_ref' => $rule,
        ]);

        return [$alert];
    }
}
