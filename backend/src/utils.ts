import { sign, type Secret, type SignOptions } from 'jsonwebtoken';
import { CONFIG } from './config';
import { SessionTokenPayload, User } from './types';
import { randomUUID } from 'crypto';

export function signSession(user: User) {
  const payload: SessionTokenPayload = { uid: user.id, ver: 1, jti: randomUUID() };
  const options: SignOptions = { expiresIn: CONFIG.jwtExpiresIn as unknown as SignOptions['expiresIn'] };
  return sign(payload, CONFIG.jwtSecret as unknown as Secret, options);
}

export function nowIso() { return new Date().toISOString(); }
