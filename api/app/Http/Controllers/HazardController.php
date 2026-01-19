<?php

namespace App\Http\Controllers;

use App\Models\Location;
use App\Models\Report;
use Illuminate\Http\Request;

class HazardController extends Controller
{
    public function index(Request $request)
    {
        $data = $request->validate([
            'location_id' => ['nullable', 'exists:locations,id'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $limit = $data['limit'] ?? 100;

        $query = Report::query()
            ->with(['location:id,name,region'])
            ->orderByDesc('reported_at')
            ->orderByDesc('id');

        if (!empty($data['location_id'])) {
            $query->where('location_id', $data['location_id']);
        }

        $hazards = $query->limit($limit)->get();

        return response()->json($hazards);
    }

    public function byLocation(Location $location, Request $request)
    {
        $data = $request->validate([
            'limit' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $limit = $data['limit'] ?? 100;

        $hazards = Report::query()
            ->with(['location:id,name,region'])
            ->where('location_id', $location->id)
            ->orderByDesc('reported_at')
            ->orderByDesc('id')
            ->limit($limit)
            ->get();

        return response()->json($hazards);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'location_id' => ['required', 'exists:locations,id'],
            'type' => ['required', 'string', 'max:32'],
            'severity' => ['nullable', 'string', 'max:16'],
            'note' => ['nullable', 'string'],
            'photo_url' => ['nullable', 'string', 'max:255'],
            'reported_at' => ['nullable', 'date'],
        ]);

        $data['reported_at'] = $data['reported_at'] ?? now();

        $hazard = Report::create($data);

        return response()->json($hazard->load(['location:id,name,region']), 201);
    }
}
