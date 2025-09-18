import { Router, Request, Response } from 'express';
import { requireAuth } from './authMiddleware';
import { db, addAuditLog } from './db';

export const accountRouter = Router();

accountRouter.delete('/', requireAuth, (req: Request, res: Response) => {
  const uid = req.user!.id;
  const trx = db.transaction(() => {
    db.prepare('DELETE FROM subscription_events WHERE user_id=?').run(uid);
    db.prepare('DELETE FROM subscriptions WHERE user_id=?').run(uid);
    db.prepare('DELETE FROM audit_logs WHERE user_id=?').run(uid);
    db.prepare('DELETE FROM users WHERE id=?').run(uid);
  });
  trx();
  addAuditLog('account.delete', uid, {});
  return res.json({ success:true });
});
