<?php

namespace App\Http\Controllers;

use App\Services\ForecastIngestionService;
use Illuminate\Http\JsonResponse;

class IngestController extends Controller
{
    public function __construct(private ForecastIngestionService $ingestion)
    {
    }

    public function __invoke(): JsonResponse
    {
        try {
            $results = $this->ingestion->ingest();
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }

        return response()->json(['results' => $results]);
    }
}
