import { useCallback } from 'react';
import { Platform } from 'react-native';

interface ReportOptions { tag?: string; extra?: Record<string,any>; }

// Simple frontend error reporter stub (console + optional future network send)
export function useErrorReporter(){
  return useCallback((err: any, msg?: string, opts?: ReportOptions) => {
    const payload = {
      msg: msg || err?.message || 'error',
      tag: opts?.tag,
      extra: opts?.extra,
  device: { os: Platform.OS, version: Platform.Version }
    };
    // For now just log; could POST to /errors later
    console.warn('[client-error]', payload, err?.stack?.split('\n').slice(0,5).join('\n'));
  }, []);
}
