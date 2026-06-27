import type { ApiResponse, ApiError } from '@pos/shared-types';

export function successResponse<T>(data: T, message?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  };
}

export function errorResponse(error: string, message: string, statusCode = 500): ApiError {
  return {
    success: false,
    error,
    message,
    statusCode,
    timestamp: new Date().toISOString(),
  };
}