import { Router, Request, Response } from 'express';
import { requireAuth } from './authMiddleware';
import { getDBProvider } from './dbFactory';
const provider = getDBProvider();
import { computeEntitlements } from './entitlements';

export const entitlementsRouter = Router();

entitlementsRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  const uid = req.user!.id;
  const { tier, isPro, isLifetime, capabilities } = computeEntitlements(uid);
  const storageBytes = await provider.totalJournalBytes(uid);
  const limitBytes = parseInt(process.env.FREE_STORAGE_BYTES || '1048576', 10);
  res.json({ success:true, data:{ tier, isPro, isLifetime, capabilities, storage:{ usedBytes: storageBytes, limitBytes } } });
});
