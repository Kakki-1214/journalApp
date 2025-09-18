import type { Response } from 'express';

export type ErrorCode =
  | 'INVALID_SIGNATURE'
  | 'INVALID_PUBSUB_TOKEN'
  | 'RATE_LIMITED'
  | 'NO_DATA'
  | 'DECODE_ERROR'
  | 'NO_ORIGINAL_TRANSACTION_ID'
  | 'UNAUTHORIZED'
  | 'BAD_REQUEST'
  | 'INTERNAL';

const httpMap: Record<ErrorCode, number> = {
  INVALID_SIGNATURE:400,
  INVALID_PUBSUB_TOKEN:401,
  RATE_LIMITED:429,
  NO_DATA:400,
  DECODE_ERROR:400,
  NO_ORIGINAL_TRANSACTION_ID:400,
  UNAUTHORIZED:401,
  BAD_REQUEST:400,
  INTERNAL:500,
};

export function sendError(res: Response, code: ErrorCode, extra?: any) {
  return res.status(httpMap[code] || 400).json({ success:false, error: code, ...(extra?{details:extra}:{}) });
}
