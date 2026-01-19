<?php

namespace App\Models;

use App\Models\Location;
use Illuminate\Database\Eloquent\Model;

class Forecast extends Model
{
    protected $fillable = [
        'location_id',
        'observed_at',
        'temp_c',
        'feels_like_c',
        'humidity',
        'wind_ms',
        'rain_mm',
        'summary',
        'raw',
    ];

    protected $casts = [
        'observed_at' => 'datetime',
        'temp_c' => 'float',
        'feels_like_c' => 'float',
        'wind_ms' => 'float',
        'rain_mm' => 'float',
        'raw' => 'array',
    ];

    public function location()
    {
        return $this->belongsTo(Location::class);
    }
}
