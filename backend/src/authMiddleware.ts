import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { CONFIG } from './config';
import { getDBProvider } from './dbFactory';
const provider = getDBProvider();

export interface AuthUser { id: string; }

declare global {
  namespace Express {
    interface Request { user?: AuthUser; }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if(!header || !header.startsWith('Bearer ')) return res.status(401).json({ success:false, error:'Missing bearer token' });
  const token = header.substring('Bearer '.length);
  try {
    const decoded = jwt.verify(token, CONFIG.jwtSecret) as any;
    const userId = (decoded as any).sub || (decoded as any).uid;
    if (await provider.isJtiRevoked(decoded.jti)) return res.status(401).json({ success:false, error:'TOKEN_REVOKED' });
    if(!userId) return res.status(401).json({ success:false, error:'Invalid token' });
    const user = await provider.getUserById(userId);
    if(!user) return res.status(401).json({ success:false, error:'User not found' });
    req.user = { id: user.id };
    return next();
  } catch(e:any) {
    return res.status(401).json({ success:false, error:'Invalid token' });
  }
}
