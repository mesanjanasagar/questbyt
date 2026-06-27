export type ShiftType = 'morning' | 'afternoon' | 'evening' | 'night';
export type AlertType = 'understaffing_risk' | 'overstaffing_risk' | 'peak_demand';
export type AlertSeverity = 'info' | 'warning' | 'critical';

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
  shiftType: ShiftType;
  recommendedStaffCount: number;
  confidence: number;
  rationale: string | null;
  createdAt: string;
}

export interface StaffingAlert {
  id: string;
  storeId: string;
  alertDate: string;
  alertType: AlertType;
  message: string;
  severity: AlertSeverity;
  acknowledged: boolean;
  createdAt: string;
}