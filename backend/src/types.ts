import { z } from 'zod';

// Auth
export const EmailAuthRequest = z.object({ email: z.string().email(), password: z.string().min(6) });
export type EmailAuthRequest = z.infer<typeof EmailAuthRequest>;

export interface User {
  id: string;
  email?: string;
  name?: string;
  providers: { type: 'email' | 'google' | 'apple'; subject: string }[];
  createdAt: string;
  updatedAt: string;
  proUntil?: string | null;
}

// IAP
export const IapVerifyRequest = z.object({ platform: z.enum(['ios','android']), receipt: z.string().min(10), productId: z.string().min(3).optional() });
export type IapVerifyRequest = z.infer<typeof IapVerifyRequest>;

export interface SubscriptionStatus {
  isPro: boolean;
  productId?: string;
  expiryDate?: string | null;
  source?: 'iap' | 'manual';
}

// Tokens
export interface SessionTokenPayload { uid: string; ver: number; jti?: string; }

export const GoogleCodeExchangeRequest = z.object({ code: z.string().min(5), redirectUri: z.string().url() });
export type GoogleCodeExchangeRequest = z.infer<typeof GoogleCodeExchangeRequest>;

export const AppleVerifyRequest = z.object({ identityToken: z.string().min(20) });
export type AppleVerifyRequest = z.infer<typeof AppleVerifyRequest>;

export interface ApiResponse<T> { success: boolean; data?: T; error?: string; }
