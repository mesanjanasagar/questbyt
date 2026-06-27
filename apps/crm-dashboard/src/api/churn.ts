import api from './client';
import { ChurnScore } from '../types';

// — Mock data ——————————————————————————————————
const daysAgo = (d: number) => new Date(Date.now() - d * 86400_000).toISOString();

const MOCK_CHURN_SCORES: ChurnScore[] = [
  { customerId: 'c-11', churnScore: 0.94, riskLevel: 'critical', lastOrderDays: 38, frequencyTrend: -0.62, avgOrderValueTrend: -0.35, calculatedAt: daysAgo(0) },
  { customerId: 'c-12', churnScore: 0.91, riskLevel: 'critical', lastOrderDays: 42, frequencyTrend: -0.55, avgOrderValueTrend: -0.28, calculatedAt: daysAgo(0) },
  { customerId: 'c-13', churnScore: 0.87, riskLevel: 'critical', lastOrderDays: 35, frequencyTrend: -0.71, avgOrderValueTrend: -0.18, calculatedAt: daysAgo(0) },
  { customerId: 'c-4', churnScore: 0.82, riskLevel: 'critical', lastOrderDays: 16, frequencyTrend: -0.48, avgOrderValueTrend: -0.31, calculatedAt: daysAgo(0) },
  { customerId: 'c-14', churnScore: 0.74, riskLevel: 'high', lastOrderDays: 20, frequencyTrend: -0.40, avgOrderValueTrend: -0.22, calculatedAt: daysAgo(0) },
  { customerId: 'c-15', churnScore: 0.71, riskLevel: 'high', lastOrderDays: 18, frequencyTrend: -0.33, avgOrderValueTrend: -0.15, calculatedAt: daysAgo(0) },
  { customerId: 'c-16', churnScore: 0.68, riskLevel: 'high', lastOrderDays: 22, frequencyTrend: -0.29, avgOrderValueTrend: -0.10, calculatedAt: daysAgo(0) },
  { customerId: 'c-9', churnScore: 0.65, riskLevel: 'high', lastOrderDays: 20, frequencyTrend: -0.25, avgOrderValueTrend: -0.05, calculatedAt: daysAgo(0) },
  { customerId: 'c-17', churnScore: 0.55, riskLevel: 'medium', lastOrderDays: 12, frequencyTrend: -0.20, avgOrderValueTrend: 0.02, calculatedAt: daysAgo(0) },
  { customerId: 'c-18', churnScore: 0.52, riskLevel: 'medium', lastOrderDays: 10, frequencyTrend: -0.15, avgOrderValueTrend: 0.05, calculatedAt: daysAgo(0) },
  { customerId: 'c-19', churnScore: 0.48, riskLevel: 'medium', lastOrderDays: 9, frequencyTrend: -0.10, avgOrderValueTrend: 0.08, calculatedAt: daysAgo(0) },
  { customerId: 'c-20', churnScore: 0.28, riskLevel: 'low', lastOrderDays: 4, frequencyTrend: 0.05, avgOrderValueTrend: 0.12, calculatedAt: daysAgo(0) },
  { customerId: 'c-21', churnScore: 0.18, riskLevel: 'low', lastOrderDays: 2, frequencyTrend: 0.12, avgOrderValueTrend: 0.18, calculatedAt: daysAgo(0) },
];

// — API ——————————————————————————————————
export const churnAPI = {
  getScores: async (riskLevel?: string): Promise<ChurnScore[]> => {
    try {
      const res = await api.get<{ data: ChurnScore[]; summary: any }>('/churn/scores', {
        params: riskLevel ? { riskLevel } : undefined,
      });
      return res.data.data;
    } catch {
      if (riskLevel) {
        return MOCK_CHURN_SCORES.filter((s) => s.riskLevel === riskLevel);
      }
      return MOCK_CHURN_SCORES;
    }
  },

  getScoreSummary: async () => {
    try {
      const res = await api.get<{ data: ChurnScore[]; summary: any }>('/churn/scores');
      return res.data.summary;
    } catch {
      return {
        total: MOCK_CHURN_SCORES.length,
        critical: MOCK_CHURN_SCORES.filter((s) => s.riskLevel === 'critical').length,
        high: MOCK_CHURN_SCORES.filter((s) => s.riskLevel === 'high').length,
        medium: MOCK_CHURN_SCORES.filter((s) => s.riskLevel === 'medium').length,
        low: MOCK_CHURN_SCORES.filter((s) => s.riskLevel === 'low').length,
      };
    }
  },

  triggerScoring: async () => {
    try {
      const res = await api.post('/churn/score');
      return res.data;
    } catch {
      // Mock: no-op, scoring would run on backend
      return { message: 'Scoring triggered (mock)' };
    }
  },
};