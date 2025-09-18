import pino from 'pino';

const level = process.env.LOG_LEVEL || 'info';
export const logger = pino({ level });

export function reqChild(bindings: Record<string, any>) {
  return logger.child(bindings);
}

// Simple error reporter stub – can be swapped with Sentry/NewRelic
export interface ReportErrorOptions { context?: Record<string, any>; tags?: Record<string,string>; level?: 'error'|'warn'|'info'; }
export function reportError(err: any, msg?: string, opts?: ReportErrorOptions){
  const payload = {
    msg: msg || err?.message || 'Unhandled error',
    stack: err?.stack,
    context: opts?.context,
    tags: opts?.tags
  };
  if(opts?.level === 'warn') logger.warn(payload); else logger.error(payload);
  // Hook for Sentry:
  // if (SENTRY_DSN) Sentry.captureException(err, scope => { scope.setExtras(payload.context||{}); return scope; });
}
