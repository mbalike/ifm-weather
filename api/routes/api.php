<?php

use App\Http\Controllers\AlertController;
use App\Http\Controllers\DeviceTokenController;
use App\Http\Controllers\ForecastController;
use App\Http\Controllers\HazardController;
use App\Http\Controllers\IngestController;
use App\Http\Controllers\LocationController;
use App\Http\Controllers\ReportController;
use Illuminate\Support\Facades\Route;

Route::get('/health', fn () => ['status' => 'ok']);

Route::get('/locations', [LocationController::class, 'index']);
Route::get('/locations/{location}/forecast', [ForecastController::class, 'show']);
Route::get('/locations/{location}/alerts', [AlertController::class, 'index']);
Route::get('/locations/{location}/hazards', [HazardController::class, 'byLocation']);

Route::get('/hazards', [HazardController::class, 'index']);
Route::post('/hazards', [HazardController::class, 'store']);

Route::post('/reports', [ReportController::class, 'store']);
Route::post('/device-tokens', [DeviceTokenController::class, 'store']);

Route::post('/ingest', IngestController::class);
