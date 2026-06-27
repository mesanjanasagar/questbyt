import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { config } from '../config';
import { executeQuery } from '../db/clients';

export interface ChurnScore {
  id: string;
  customerId: string;
  storeId: string;
  churnScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  lastOrderDays: number | null;
  frequencyTrend: number;
  avgOrderValueTrend: number;
  calculatedAt: string;
}

/**
 * Score all customers daily
 * Factors: Inactivity (30+ days), frequency decline (< 2 orders/month), avg order value decline (< -10%)
 */
export async function scoreAllCustomers(storeId: string): Promise<void> {
  try {
    // Fetch all customers with order history
    const customers = await axios.get(
      `${config.CUSTOMER_SERVICE_URL}/api/v1/customers`,
      {
        params: { storeId, limit: 1000 },
        headers: { 'x-internal-service': 'churn-engine' },
      }
    );

    for (const customer of customers.data.data ?? []) {
      const score = await calculateChurnScore(customer, storeId);
      await persistChurnScore(score);
      await checkForTriggers(score);
    }

    console.info(`[Scoring] Processed ${customers.data.data.length} customers for store ${storeId}`);
  } catch (err) {
    console.error('[Scoring] Failed:', err);
  }
}

async function calculateChurnScore(customer: any, storeId: string): Promise<ChurnScore> {
  try {
    // Fetch customer orders
    const orders = await axios.get(
      `${config.ORDER_SERVICE_URL}/api/v1/orders`,
      {
        params: { customerId: customer.id, storeId, limit: 100 },
        headers: { 'x-internal-service': 'churn-engine' },
      }
    );

    const orderList = orders.data.data ?? [];

    if (orderList.length === 0) {
      // Never ordered -> Low risk
      return {
        id: uuidv4(),
        customerId: customer.id,
        storeId,
        churnScore: 0.1,
        riskLevel: 'low',
        lastOrderDays: null,
        frequencyTrend: 0,
        avgOrderValueTrend: 0,
        calculatedAt: new Date().toISOString(),
      };
    }

    // Calculate metrics
    const lastOrderDate = new Date(orderList[0].createdAt);
    const lastOrderDays = Math.floor((Date.now() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24));

    // Frequency trend (orders per month last 3 months vs previous 3 months)
    const now = new Date();
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

    const recent = orderList.filter((o: any) => new Date(o.createdAt) > threeMonthsAgo).length;
    const older = orderList.filter(
      (o: any) => new Date(o.createdAt) > sixMonthsAgo && new Date(o.createdAt) <= threeMonthsAgo
    ).length;

    const frequencyTrend = older > 0 ? ((recent - older) / older) : 0;

    // Avg order value trend
    const recentAvg =
      recent > 0
        ? orderList
            .filter((o: any) => new Date(o.createdAt) > threeMonthsAgo)
            .reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0) / recent
        : 0;

    const olderAvg =
      older > 0
        ? orderList
            .filter((o: any) => new Date(o.createdAt) > sixMonthsAgo && new Date(o.createdAt) <= threeMonthsAgo)
            .reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0) / older
        : 0;

    const avgOrderValueTrend = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) : 0;

    // Calculate churn score (0-1)
    let score = 0;
    score += Math.min(lastOrderDays / 60, 1) * 0.4; // 40% inactivity
    score += Math.max(0, -frequencyTrend) * 0.3; // 30% frequency decline
    score += Math.max(0, -avgOrderValueTrend) * 0.3; // 30% AOV decline

    const riskLevel =
      score >= config.CHURN_SCORE_THRESHOLD
        ? 'critical'
        : score >= config.RISK_SCORE_THRESHOLD
          ? 'high'
          : score >= 0.3
            ? 'medium'
            : 'low';

    return {
      id: uuidv4(),
      customerId: customer.id,
      storeId,
      churnScore: Math.round(score * 100) / 100,
      riskLevel,
      lastOrderDays,
      frequencyTrend: Math.round(frequencyTrend * 100) / 100,
      avgOrderValueTrend: Math.round(avgOrderValueTrend * 100) / 100,
      calculatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`[Scoring] Error for customer ${customer.id}:`, err);
    return {
      id: uuidv4(),
      customerId: customer.id,
      storeId,
      churnScore: 0.5,
      riskLevel: 'medium',
      lastOrderDays: null,
      frequencyTrend: 0,
      avgOrderValueTrend: 0,
      calculatedAt: new Date().toISOString(),
    };
  }
}

async function persistChurnScore(score: ChurnScore): Promise<void> {
  await executeQuery(
    `INSERT INTO customer_churn_scores
     (customer_id, store_id, churn_score, risk_level, last_order_days, frequency_trend, avg_order_value_trend)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (customer_id, store_id) DO UPDATE SET
       churn_score = $3,
       risk_level = $4,
       last_order_days = $5,
       frequency_trend = $6,
       avg_order_value_trend = $7,
       calculated_at = CURRENT_TIMESTAMP`,
    [
      score.customerId,
      score.storeId,
      score.churnScore,
      score.riskLevel,
      score.lastOrderDays,
      score.frequencyTrend,
      score.avgOrderValueTrend,
    ]
  );
}

async function checkForTriggers(score: ChurnScore): Promise<void> {
  if (score.riskLevel === 'critical' || score.riskLevel === 'high') {
    // Create trigger for re-engagement campaign
    await executeQuery(
      `INSERT INTO engagement_triggers (customer_id, store_id, trigger_type)
       SELECT $1, $2, 'churn_detected'
       WHERE NOT EXISTS (
         SELECT 1 FROM engagement_triggers
         WHERE customer_id = $1 AND trigger_type = 'churn_detected'
         AND triggered_at > NOW() - INTERVAL '7 days'
       )`,
      [score.customerId, score.storeId]
    );
  }
}

export async function getChurnScores(storeId: string, riskLevel?: string): Promise<ChurnScore[]> {
  const query = riskLevel
    ? `SELECT * FROM customer_churn_scores WHERE store_id = $1 AND risk_level = $2`
    : `SELECT * FROM customer_churn_scores WHERE store_id = $1`;

  const params = riskLevel ? [storeId, riskLevel] : [storeId];
  return executeQuery<ChurnScore>(query, params);
}