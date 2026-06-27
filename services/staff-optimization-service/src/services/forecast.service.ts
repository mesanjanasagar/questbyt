import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { config } from '../config';
import { executeQuery, executeTransaction } from '../db/client';
import { PoolClient } from 'pg';

export interface DailyForecast {
  id: string;
  storeId: string;
  forecastDate: string;
  hourOfDay: number;
  predictedOrders: number;
  predictedRevenue: number | null;
  confidence: number;
  actualOrders: number | null;
  accuracyDeviation: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShiftRecommendation {
  id: string;
  storeId: string;
  recommendationDate: string;
  shiftType: 'morning' | 'afternoon' | 'evening' | 'night';
  recommendedStaffCount: number;
  confidence: number;
  rationale: string | null;
  createdAt: string;
}

/**
 * Generate 7-day forecast using moving average
 */
export async function generateForecast(storeId: string): Promise<void> {
  try {
    // Fetch historical orders (last 60 days)
    const orders = await axios.get(
      `${config.ORDER_SERVICE_URL}/api/v1/orders`,
      {
        params: { storeId, limit: 10000, days: 60 },
        headers: { 'x-internal-service': 'staff-optimization' },
      }
    );

    const ordersByHour = aggregateOrdersByHour(orders.data.data ?? []);

    // Generate forecasts for next N days
    const forecastDate = new Date();
    for (let i = 1; i <= config.FORECAST_DAYS_AHEAD; i++) {
      const date = new Date(forecastDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      for (let hour = 8; hour < 22; hour++) {
        const historicalOrders = ordersByHour[hour] ?? [];
        const forecast = calculateMovingAverage(historicalOrders);

        await persistForecast(storeId, dateStr, hour, forecast);
      }
    }

    // Generate shift recommendations based on forecasts
    await generateShiftRecommendations(storeId);

    console.info(`[Forecast] Generated for store ${storeId}`);
  } catch (err) {
    console.error('[Forecast] Error:', err);
  }
}

function aggregateOrdersByHour(orders: any[]): Record<number, number[]> {
  const result: Record<number, number[]> = {};

  for (const order of orders) {
    const date = new Date(order.createdAt);
    const hour = date.getHours();
    if (!result[hour]) result[hour] = [];
    result[hour].push(1);
  }

  return Object.entries(result).reduce((acc, [hour, orders]) => {
    acc[parseInt(hour)] = [orders.length, ...orders]; // Store count as first element for averaging
    return acc;
  }, {} as Record<number, number[]>);
}

function calculateMovingAverage(historicalData: number[]): { predicted: number; confidence: number } {
  if (historicalData.length === 0) {
    return { predicted: 5, confidence: 0.3 };
  }

  const avg = historicalData.reduce((a, b) => a + b, 0) / historicalData.length;
  const stdDev = Math.sqrt(
    historicalData.reduce((sq, n) => sq + Math.pow(n - avg, 2), 0) / historicalData.length
  );

  // Confidence based on data consistency (lower stddev = higher confidence)
  const confidence = Math.max(0.5, 1 - stdDev / (avg || 1));

  return {
    predicted: Math.max(1, Math.round(avg)),
    confidence: Math.round(confidence * 100) / 100,
  };
}

async function persistForecast(
  storeId: string,
  forecastDate: string,
  hour: number,
  forecast: { predicted: number; confidence: number }
): Promise<void> {
  const predictedRevenue = forecast.predicted * 45; // Avg $45 per order

  await executeQuery(
    `INSERT INTO daily_forecasts (store_id, forecast_date, hour_of_day, predicted_orders, predicted_revenue, confidence)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (store_id, forecast_date, hour_of_day) DO UPDATE SET
       predicted_orders = $4,
       predicted_revenue = $5,
       confidence = $6,
       updated_at = CURRENT_TIMESTAMP`,
    [storeId, forecastDate, hour, forecast.predicted, predictedRevenue, forecast.confidence]
  );
}

async function generateShiftRecommendations(storeId: string): Promise<void> {
  return executeTransaction<void>(async (client: PoolClient) => {
    const forecasts = await client.query(
      `SELECT forecast_date, SUM(predicted_orders) as total_orders
       FROM daily_forecasts
       WHERE store_id = $1 AND forecast_date >= CURRENT_DATE AND forecast_date < CURRENT_DATE + INTERVAL '7 days'
       GROUP BY forecast_date
       ORDER BY forecast_date ASC`,
      [storeId]
    );

    for (const row of forecasts.rows) {
      const totalOrders = row.total_orders || 0;

      // Simple heuristic: ~15 orders per staff member per day
      const recommendedStaff = Math.max(2, Math.ceil(totalOrders / 15));

      await client.query(
        `INSERT INTO shift_recommendations (store_id, recommendation_date, shift_type, recommended_staff_count, confidence, rationale)
         VALUES ($1, $2, 'morning', $3, 0.7, $4),
                ($1, $2, 'afternoon', $3, 0.7, $4),
                ($1, $2, 'evening', $3, 0.75, $4)`,
        [storeId, row.forecast_date, recommendedStaff, `Forecast: ${totalOrders} orders`]
      );

      // Create alerts for extreme cases
      if (totalOrders > 200) {
        await client.query(
          `INSERT INTO staffing_alerts (store_id, alert_date, alert_type, message, severity)
           VALUES ($1, $2, 'peak_demand', $3, 'critical')`,
          [storeId, row.forecast_date, `Expected high demand: ${totalOrders} orders forecast`]
        );
      } else if (totalOrders < 30) {
        await client.query(
          `INSERT INTO staffing_alerts (store_id, alert_date, alert_type, message, severity)
           VALUES ($1, $2, 'overstaffing_risk', $3, 'info')`,
          [storeId, row.forecast_date, `Low demand expected: only ${totalOrders} orders forecast`]
        );
      }
    }
  });
}

export async function getForecasts(
  storeId: string,
  forecastDate?: string
): Promise<DailyForecast[]> {
  const query = forecastDate
    ? `SELECT * FROM daily_forecasts WHERE store_id = $1 AND forecast_date = $2 ORDER BY hour_of_day ASC`
    : `SELECT * FROM daily_forecasts WHERE store_id = $1 AND forecast_date >= CURRENT_DATE ORDER BY forecast_date ASC, hour_of_day ASC`;

  const params = forecastDate ? [storeId, forecastDate] : [storeId];
  return executeQuery<DailyForecast>(query, params);
}

export async function getShiftRecommendations(storeId: string): Promise<ShiftRecommendation[]> {
  return executeQuery<ShiftRecommendation>(
    `SELECT * FROM shift_recommendations WHERE store_id = $1 AND recommendation_date >= CURRENT_DATE ORDER BY recommendation_date ASC`,
    [storeId]
  );
}

export async function getAlerts(storeId: string): Promise<any[]> {
  return executeQuery(
    `SELECT * FROM staffing_alerts WHERE store_id = $1 AND alert_date >= CURRENT_DATE ORDER BY alert_date DESC, severity DESC`,
    [storeId]
  );
}