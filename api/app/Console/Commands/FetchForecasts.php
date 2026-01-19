<?php

namespace App\Console\Commands;

use App\Services\ForecastIngestionService;
use Illuminate\Console\Command;

class FetchForecasts extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:fetch-forecasts';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Fetch latest forecasts from OpenWeather and derive alerts.';

    public function __construct(private ForecastIngestionService $ingestion)
    {
        parent::__construct();
    }

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Fetching forecasts...');

        $results = $this->ingestion->ingest();

        foreach ($results as $result) {
            if (($result['status'] ?? null) === 'ok') {
                $this->line('Location '.$result['location_id'].': stored forecast '.$result['forecast_id'].'; alerts created '.$result['alerts_created']);
            } else {
                $this->warn('Location '.$result['location_id'].': '.$result['message']);
            }
        }

        $this->info('Done.');
    }
}
