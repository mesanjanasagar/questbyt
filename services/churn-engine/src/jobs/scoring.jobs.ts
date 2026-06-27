import cron from 'node-cron';
import { config } from '../config';
import * as scoringService from '../services/scoring.service';
import axios from 'axios';

let jobHandle: cron.ScheduledTask | null = null;

export async function startScoringJob(): Promise<void> {
  console.info(`[Scoring Job] Scheduling at ${config.SCORING_SCHEDULE}`);

  jobHandle = cron.schedule(config.SCORING_SCHEDULE, async () => {
    console.info('[Scoring Job] Starting...');

    try {
      // Get all stores
      const stores = await axios.get(
        `http://localhost:3011/api/v1/stores`,
        {
          headers: { 'x-internal-service': 'churn-engine' },
        }
      );

      for (const store of stores.data.data ?? []) {
        await scoringService.scoreAllCustomers(store.id);
      }

      console.info('[Scoring Job] Completed');
    } catch (err) {
      console.error('[Scoring Job] Error:', err);
    }
  });
}

export async function stopScoringJob(): Promise<void> {
  if (jobHandle) {
    jobHandle.stop();
    console.info('[Scoring Job] Stopped');
  }
}