import { db } from './db';

export interface EntitlementsResult {
  tier: 'free'|'pro'|'lifetime';
  isPro: boolean;
  isLifetime: boolean;
  capabilities: { canTag:boolean; canStats:boolean; canCalendarExtras:boolean };
}

export function computeEntitlements(userId: string): EntitlementsResult {
  const row:any = db.prepare(`SELECT * FROM subscriptions WHERE user_id=? ORDER BY updated_at DESC LIMIT 1`).get(userId);
  const lifetimeIds = (process.env.LIFETIME_PRODUCT_IDS||'').split(',').map(s=>s.trim()).filter(Boolean);
  let tier: EntitlementsResult['tier'] = 'free';
  let isLifetime = false;
  let isPro = false;
  if(row) {
    const baseProduct = row.product_id;
    const expiresAtMs = row.expires_at ? new Date(row.expires_at).getTime() : undefined;
    const expired = expiresAtMs !== undefined && expiresAtMs < Date.now();
    if(baseProduct && lifetimeIds.includes(baseProduct)) { isLifetime = true; tier='lifetime'; isPro=true; }
    else if(!expired && (row.status==='active' || row.status==='canceled')) { tier='pro'; isPro=true; }
  }
  const capabilities = { canTag: isPro||isLifetime, canStats: isPro||isLifetime, canCalendarExtras: isPro||isLifetime };
  return { tier, isPro, isLifetime, capabilities };
}

export function requireCapability(cap: keyof EntitlementsResult['capabilities']) {
  return (req:any,res:any,next:any)=>{
    if(!req.user) return res.status(401).json({ success:false, error:'UNAUTHENTICATED' });
    const ent = computeEntitlements(req.user.id);
    if(!ent.capabilities[cap]) return res.status(402).json({ success:false, error:'UPGRADE_REQUIRED', capability: cap });
    next();
  };
}