import client from 'prom-client';
import { registry } from './metrics';

// provider: apple|google, result: ok|auth_fail, event: unified event name
export const webhookEventsTotal = new client.Counter({
  name: 'webhook_events_total',
  help: 'Webhook events processed',
  labelNames: ['provider','result','event'] as const,
  registers: [registry]
});
