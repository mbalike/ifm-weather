<?php

namespace App\Models;

use App\Models\Alert;
use App\Models\DeviceToken;
use App\Models\Forecast;
use App\Models\Report;
use Illuminate\Database\Eloquent\Model;

class Location extends Model
{
    protected $fillable = [
        'name',
        'region',
        'latitude',
        'longitude',
        'timezone',
    ];

    public function forecasts()
    {
        return $this->hasMany(Forecast::class);
    }

    public function alerts()
    {
        return $this->hasMany(Alert::class);
    }

    public function reports()
    {
        return $this->hasMany(Report::class);
    }

    public function deviceTokens()
    {
        return $this->hasMany(DeviceToken::class);
    }
}
