<?php

namespace App\Models;

use App\Models\Location;
use Illuminate\Database\Eloquent\Model;

class Alert extends Model
{
    protected $fillable = [
        'location_id',
        'level',
        'type',
        'title',
        'message',
        'starts_at',
        'ends_at',
        'source',
        'rule_ref',
    ];

    protected $casts = [
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
    ];

    public function location()
    {
        return $this->belongsTo(Location::class);
    }
}
