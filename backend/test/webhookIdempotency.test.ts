import { describe, it, expect } from 'vitest';
import { markWebhookProcessed, isWebhookProcessed } from '../src/db';

describe('Webhook idempotency helpers', () => {
  it('returns false on second insert attempt', () => {
    const id = 'evt-123';
    const first = markWebhookProcessed('apple', id);
    expect(first).toBe(true);
    const seen = isWebhookProcessed('apple', id);
    expect(seen).toBe(true);
    const second = markWebhookProcessed('apple', id);
    expect(second).toBe(false);
  });
});
