<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\DeviceToken;

class DeviceTokenController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'expo_token' => ['required', 'string', 'max:255'],
            'platform' => ['nullable', 'string', 'max:16'],
            'location_id' => ['nullable', 'exists:locations,id'],
        ]);

        $token = DeviceToken::updateOrCreate(
            ['expo_token' => $data['expo_token']],
            [
                'platform' => $data['platform'] ?? null,
                'location_id' => $data['location_id'] ?? null,
                'last_seen_at' => now(),
            ]
        );

        return response()->json($token);
    }
}
