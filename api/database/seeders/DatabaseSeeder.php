<?php

namespace Database\Seeders;

use App\Models\Location;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        Location::query()->updateOrCreate(
            ['name' => 'Dar es Salaam'],
            [
                'region' => 'Dar es Salaam',
                'latitude' => -6.7924,
                'longitude' => 39.2083,
                'timezone' => 'Africa/Dar_es_Salaam',
            ]
        );

        Location::query()->updateOrCreate(
            ['name' => 'Mwanza'],
            [
                'region' => 'Mwanza',
                'latitude' => -2.5164,
                'longitude' => 32.8987,
                'timezone' => 'Africa/Dar_es_Salaam',
            ]
        );

        Location::query()->updateOrCreate(
            ['name' => 'Arusha'],
            [
                'region' => 'Arusha',
                'latitude' => -3.3869,
                'longitude' => 36.68299,
                'timezone' => 'Africa/Dar_es_Salaam',
            ]
        );

        Location::query()->updateOrCreate(
            ['name' => 'Dodoma'],
            [
                'region' => 'Dodoma',
                'latitude' => -6.163,
                'longitude' => 35.7516,
                'timezone' => 'Africa/Dar_es_Salaam',
            ]
        );

        Location::query()->updateOrCreate(
            ['name' => 'Zanzibar City'],
            [
                'region' => 'Zanzibar',
                'latitude' => -6.1659,
                'longitude' => 39.2026,
                'timezone' => 'Africa/Dar_es_Salaam',
            ]
        );

        Location::query()->updateOrCreate(
            ['name' => 'Mbeya'],
            [
                'region' => 'Mbeya',
                'latitude' => -8.9094,
                'longitude' => 33.46,
                'timezone' => 'Africa/Dar_es_Salaam',
            ]
        );

        Location::query()->updateOrCreate(
            ['name' => 'Tanga'],
            [
                'region' => 'Tanga',
                'latitude' => -5.0692,
                'longitude' => 39.0987,
                'timezone' => 'Africa/Dar_es_Salaam',
            ]
        );

        Location::query()->updateOrCreate(
            ['name' => 'Kigoma'],
            [
                'region' => 'Kigoma',
                'latitude' => -4.876,
                'longitude' => 29.6266,
                'timezone' => 'Africa/Dar_es_Salaam',
            ]
        );
    }
}
