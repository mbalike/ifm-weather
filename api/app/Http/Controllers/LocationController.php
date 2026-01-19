<?php

namespace App\Http\Controllers;

use App\Models\Location;

class LocationController extends Controller
{
    public function index()
    {
        $locations = Location::query()
            ->select(['id', 'name', 'region', 'latitude', 'longitude', 'timezone'])
            ->orderBy('name')
            ->get();

        return response()->json($locations);
    }
}
