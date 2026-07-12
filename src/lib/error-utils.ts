import { TRPCClientError } from '@trpc/client';

/**
 * parseError - Consistent error parsing for TRPC and standard errors
 */
export function parseError(error: unknown, fallback = '操作失敗'): string {
  if (error instanceof TRPCClientError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return fallback;
}
