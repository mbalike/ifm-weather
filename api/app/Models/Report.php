<?php

namespace App\Models;

use App\Models\Location;
use Illuminate\Database\Eloquent\Model;

class Report extends Model
{
    protected $fillable = [
        'location_id',
        'type',
        'severity',
        'note',
        'photo_url',
        'reported_at',
    ];

    protected $casts = [
        'reported_at' => 'datetime',
    ];

    public function location()
    {
        return $this->belongsTo(Location::class);
    }
}
