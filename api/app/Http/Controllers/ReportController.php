<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Report;

class ReportController extends Controller
{
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

        $report = Report::create($data);

        return response()->json($report, 201);
    }
}
