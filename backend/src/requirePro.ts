import { Request, Response, NextFunction } from 'express';
import { db } from './db';
import { proAccessAttempts, proAccessDenied } from './metrics';

// Simple helper to determine if user currently has an active (non-expired) subscription.
function userIsPro(userId: string): { isPro: boolean; status: string; productId?: string | null; } {
  const row: any = db.prepare(`SELECT * FROM subscriptions WHERE user_id=? ORDER BY updated_at DESC LIMIT 1`).get(userId);
  if(!row) return { isPro:false, status:'none' };
  const now = Date.now();
  const expiresMs = row.expires_at ? new Date(row.expires_at).getTime() : undefined;
  const expired = expiresMs !== undefined && expiresMs < now;
  if(expired || row.status === 'expired') return { isPro:false, status:'expired', productId: row.product_id };
  if(row.status === 'active') return { isPro:true, status:'active', productId: row.product_id };
  if(row.status === 'canceled') return { isPro:true, status:'active', productId: row.product_id }; // grace period until expiry
  return { isPro:false, status:'none' };
}

export function requirePro(req: Request, res: Response, next: NextFunction) {
  if(!req.user) return res.status(401).json({ success:false, error:'UNAUTHENTICATED' });
  const { isPro } = userIsPro(req.user.id);
  const route = req.baseUrl + (req.route?.path || '');
  proAccessAttempts.inc({ route, granted: isPro ? '1' : '0' });
  if(!isPro) {
    proAccessDenied.inc();
    return res.status(402).json({ success:false, error:'PAYMENT_REQUIRED', code:'PRO_REQUIRED' });
  }
  return next();
}

export function isUserPro(userId: string) {
  return userIsPro(userId).isPro;
}
