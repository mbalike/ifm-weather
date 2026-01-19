<?php

namespace App\Http\Controllers;

use App\Models\Location;

class AlertController extends Controller
{
    public function index(Location $location)
    {
        $now = now($location->timezone);

        $alerts = $location->alerts()
            ->where(function ($query) use ($now) {
                $query->whereNull('ends_at')->orWhere('ends_at', '>=', $now);
            })
            ->orderByDesc('starts_at')
            ->get();

        return response()->json($alerts);
    }
}
