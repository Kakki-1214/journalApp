import client from 'prom-client';

// Global registry
export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method','route','status'] as const,
  registers: [registry]
});

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Request duration seconds',
  labelNames: ['method','route','status'] as const,
  buckets: [0.025,0.05,0.1,0.25,0.5,1,2,5],
  registers: [registry]
});

export const iapVerifyCounter = new client.Counter({
  name: 'iap_verify_total',
  help: 'IAP verify attempts grouped by result',
  labelNames: ['result','platform'] as const,
  registers: [registry]
});

export const subscriptionStatusLookups = new client.Counter({
  name: 'subscription_status_lookups_total',
  help: 'Calls to /iap/status',
  registers: [registry]
});

export const subscriptionStatusTransitions = new client.Counter({
  name: 'subscription_status_transitions_total',
  help: 'Subscription status transitions (iap verify & webhooks)',
  labelNames: ['from','to','source'] as const,
  registers: [registry]
});

export const subscriptionExpirySweeps = new client.Counter({
  name: 'subscription_expiry_sweep_total',
  help: 'Number of subscriptions marked expired in sweeps',
  registers: [registry]
});

export const proAccessAttempts = new client.Counter({
  name: 'pro_access_attempt_total',
  help: 'Attempts to access pro-gated endpoints',
  labelNames: ['route','granted'] as const,
  registers: [registry]
});

export const proAccessDenied = new client.Counter({
  name: 'pro_access_denied_total',
  help: 'Denied pro endpoint access (non-pro user)',
  registers: [registry]
});

export const journalEntryWrites = new client.Counter({
  name: 'journal_entry_writes_total',
  help: 'Journal entry create attempts',
  labelNames: ['result'] as const,
  registers: [registry]
});

export const journalStorageBytes = new client.Gauge({
  name: 'journal_storage_bytes',
  help: 'Current stored journal bytes per user (last write sampling)',
  labelNames: ['userId'] as const,
  registers: [registry]
});

export const journalStorageLimitExceeded = new client.Counter({
  name: 'journal_storage_limit_exceeded_total',
  help: 'Number of times storage limit blocked a write',
  registers: [registry]
});

export function metricsMiddleware(req: any, res: any, next: any) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const route = (req.route && req.route.path) ? req.baseUrl + req.route.path : req.originalUrl.split('?')[0];
    const status = String(res.statusCode);
    httpRequestsTotal.inc({ method: req.method, route, status });
    const durNs = Number(process.hrtime.bigint() - start);
    httpRequestDuration.observe({ method: req.method, route, status }, durNs / 1e9);
  });
  next();
}
