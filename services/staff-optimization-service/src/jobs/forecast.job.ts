import cron from 'node-cron';
import { config } from '../config';
import * as forecastService from '../services/forecast.service';
import axios from 'axios';

let jobHandle: cron.ScheduledTask | null = null;

export async function startForecastJob(): Promise<void> {
  console.info(`[Forecast Job] Scheduling at ${config.FORECAST_SCHEDULE}`);

  jobHandle = cron.schedule(config.FORECAST_SCHEDULE, async () => {
    console.info('[Forecast Job] Starting...');

    try {
      // Get all stores
      const stores = await axios.get(
        `${config.STORE_SERVICE_URL}/api/v1/stores`,
        {
          headers: { 'x-internal-service': 'staff-optimization' },
        }
      );

      for (const store of stores.data.data ?? []) {
        await forecastService.generateForecast(store.id);
      }

      console.info('[Forecast Job] Completed');
    } catch (err) {
      console.error('[Forecast Job] Error:', err);
    }
  });
}

export async function stopForecastJob(): Promise<void> {
  if (jobHandle) {
    jobHandle.stop();
    console.info('[Forecast Job] Stopped');
  }
}