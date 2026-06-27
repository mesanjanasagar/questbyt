//  ─────────────────────────────────────────────────────────────────────────────
// Common utility types shared across all services
//  ─────────────────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface ApiError {
  success: false;
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
}

export interface DateRange {
  from: string;
  to: string;
}

export interface Address {
  addressLine1: string;
  city: string;
  country: string;
  latitude?: number;
  longitude?: number;
}