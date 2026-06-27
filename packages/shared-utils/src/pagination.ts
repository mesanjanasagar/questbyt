import type { PaginatedResponse, PaginationQuery } from '@pos/shared-types';

export function parsePagination(query: PaginationQuery): { page: number; limit: number; offset: number } {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 50));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponse<T> {
  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}