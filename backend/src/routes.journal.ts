import { Router, Request, Response } from 'express';
import { requireAuth } from './authMiddleware';
import { getDBProvider } from './dbFactory';
const provider = getDBProvider();
import { journalEntryWrites, journalStorageBytes, journalStorageLimitExceeded } from './metrics';

export const journalRouter = Router();

// 上限 (FREE_STORAGE_BYTES 環境変数) - 未設定なら 1MB デフォルト
function freeLimitBytes() {
  return parseInt(process.env.FREE_STORAGE_BYTES || '1048576', 10); // 1MB
}

// シンプルに lifetime/pro 判定は /iap/status の tier をクライアントが使う想定だが、ここでは env や別ロジックに依存せず単に制限のみ:
// (後で requireCapability に差し替え可能)

journalRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  const entries = await provider.listJournalEntries(req.user!.id, 500, 0);
  res.json({ success:true, data: entries });
});

journalRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const content = (req.body?.content || '').toString();
  if(!content) return res.status(400).json({ success:false, error:'CONTENT_REQUIRED' });
  // FREE ストレージ上限 (Pro / lifetime は後で capability でスキップ可能だが現段階未実装: 暫定として上限適用 only free シナリオはクライアント制御)
  const limit = freeLimitBytes();
  const current = await provider.totalJournalBytes(userId);
  const incoming = Buffer.byteLength(content, 'utf8');
  if(current + incoming > limit) {
    journalEntryWrites.inc({ result:'limit_exceeded' });
    journalStorageLimitExceeded.inc();
    return res.status(402).json({ success:false, error:'STORAGE_LIMIT_EXCEEDED', code:'UPGRADE_REQUIRED', currentBytes: current, limitBytes: limit });
  }
  const row = await provider.insertJournalEntry(userId, content);
  journalEntryWrites.inc({ result:'success' });
  journalStorageBytes.set({ userId }, await provider.totalJournalBytes(userId));
  res.json({ success:true, data: row });
});

journalRouter.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const uid = req.user!.id;
  await provider.deleteJournalEntry(uid, req.params.id);
  journalStorageBytes.set({ userId: uid }, await provider.totalJournalBytes(uid));
  res.json({ success:true });
});
