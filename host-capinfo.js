import {UsageError} from './host-cache.js';

// Read only the live in-memory snapshot exposed by the dsh-capinfo plugin.
// This adapter never performs an HTTP request and never resolves API keys.
export class CapinfoUsageAdapter {
  constructor({capinfoUsage, now = Date.now}) {
    this.capinfoUsage = capinfoUsage;
    this.now = now;
  }
  async read() {
    const service = this.capinfoUsage?.();
    if (!service || typeof service.today !== 'function') {
      return {status: 'missing', data: null, checkedAt: null, updatedAt: null, error: null};
    }
    let today;
    try {
      today = service.today();
    } catch {
      throw new UsageError('usage/unavailable');
    }
    if (!today || typeof today !== 'object' || Array.isArray(today)
      || !Number.isSafeInteger(today.tokens) || today.tokens < 0
      || (today.amount !== null && (!Number.isFinite(today.amount) || today.amount < 0))
      || (today.refreshedAt !== null && (typeof today.refreshedAt !== 'string' || !Number.isFinite(Date.parse(today.refreshedAt))))) {
      throw new UsageError('usage/unavailable');
    }
    return {status: 'ready', data: {amount: today.amount, tokens: today.tokens, refreshedAt: today.refreshedAt},
      checkedAt: new Date(this.now()).toISOString(), updatedAt: today.refreshedAt, error: null};
  }
  dispose() {}
}
