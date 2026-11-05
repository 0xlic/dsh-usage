// Model-specific limit matching follows dsh-codex-subscription 3.2.5's
// selectModelQuotaWindows semantics. Original implementation here is MIT.
export function usageKind(provider) {
  if (provider === 'openai-codex') return 'codex';
  if (provider === 'deepseek-account') return 'deepseek';
  // An API-key route is not billed to the signed-in DSH account.
  return null;
}

export function quotaWindows(usage, model) {
  const normalize = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const exact = limit => normalize(model).length > 0 && [limit.id, limit.name].some(value => typeof value === 'string' && normalize(value) === normalize(model));
  const limits = Array.isArray(usage?.rateLimits) ? usage.rateLimits : [];
  const hasExact = limits.some(exact);
  return limits.filter(limit => {
    if (hasExact) return exact(limit);
    if (normalize(model) === 'gpt-reserve') return false;
    if (/\bspark\b/.test(normalize(model))) return /\bspark\b/.test(normalize(`${limit.id ?? ''} ${limit.name ?? ''}`));
    return limit.id === 'codex';
  }).flatMap(limit => Array.isArray(limit.windows) ? limit.windows : [])
    .filter(w => Number.isFinite(w.remainingPercent) && w.remainingPercent >= 0 && w.remainingPercent <= 100 && Number.isFinite(w.windowSeconds) && w.windowSeconds > 0)
    .map(w => ({ remainingPercent: w.remainingPercent, windowSeconds: w.windowSeconds, resetsAt: Number.isSafeInteger(w.resetsAt) ? w.resetsAt : null }))
    .sort((a, b) => a.windowSeconds - b.windowSeconds);
}

export function windowLabel(seconds) {
  if (Math.abs(seconds - 18000) < 60) return '5h';
  if (Math.abs(seconds - 604800) < 60) return '7day';
  return seconds % 86400 === 0 ? `${seconds / 86400}day` : `${Math.round(seconds / 3600)}h`;
}

export function resetDuration(resetsAt, now = Date.now()) {
  if (!Number.isSafeInteger(resetsAt)) return null;
  const minutes = Math.ceil((resetsAt * 1000 - now) / 60000);
  if (minutes <= 0) return 'due';
  if (minutes >= 1440) return `${Math.floor(minutes / 1440)}d${Math.floor(minutes % 1440 / 60)}h`;
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h${minutes % 60}m`;
  return `${minutes}m`;
}

export function resetCountdown(resetsAt, now = Date.now()) {
  if (!Number.isSafeInteger(resetsAt)) return null;
  const totalMinutes = Math.ceil((resetsAt * 1000 - now) / 60000);
  if (totalMinutes <= 0) return 'due';
  return {
    days: Math.floor(totalMinutes / 1440),
    hours: Math.floor(totalMinutes % 1440 / 60),
    minutes: totalMinutes % 60,
  };
}

export function accountRows(status, allUsage) {
  if (status?.authenticated !== true) return [];
  const accounts = Array.isArray(status.accounts) ? status.accounts : [];
  const values = new Map((Array.isArray(allUsage?.accounts) ? allUsage.accounts : []).map(entry => [entry.id, entry]));
  return accounts.map((account, index) => ({
    id: account.id,
    label: account.label || `#${index + 1}`,
    // Emails are kept in the tooltip, not the always-visible status row.
    email: account.email || '',
    active: account.active === true || accounts.length === 1,
    usage: values.get(account.id)?.usage,
    failed: !!values.get(account.id)?.error,
    error: typeof values.get(account.id)?.error === 'string' ? values.get(account.id).error.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 300) : '',
  })).filter(account => account.active);
}

// Exact decimal addition: bonus wallets are separate from recharge wallets.
// Currency values remain strings, with no binary floating-point summation.
export function walletTotals(balance) {
  if (balance?.status !== 'ready') return [];
  const groups = new Map();
  for (const wallet of [...(balance.value ?? []), ...(balance.bonusWallets ?? [])]) {
    if (!['CNY', 'USD'].includes(wallet.currency) || !/^-?\d+(\.\d+)?$/.test(String(wallet.balance))) continue;
    const text = String(wallet.balance);
    const negative = text.startsWith('-');
    const [integer, fraction = ''] = text.replace(/^-/, '').split('.');
    const current = groups.get(wallet.currency) ?? { units: 0n, scale: 0 };
    const scale = Math.max(current.scale, fraction.length);
    const units = BigInt(integer + fraction) * (negative ? -1n : 1n);
    groups.set(wallet.currency, {
      units: current.units * 10n ** BigInt(scale - current.scale) + units * 10n ** BigInt(scale - fraction.length), scale,
    });
  }
  return [...groups].map(([currency, { units, scale }]) => {
    const target = Math.max(2, scale);
    const digits = (units < 0n ? -units : units).toString().padStart(scale + 1, '0');
    const integer = scale ? digits.slice(0, -scale) : digits;
    const fraction = (scale ? digits.slice(-scale) : '').padEnd(target, '0').replace(/0+$/, '').padEnd(2, '0');
    return { currency, amount: `${units < 0n ? '-' : ''}${integer}.${fraction}` };
  });
}

// Round the exact decimal total only at presentation time (half away from zero).
export function formatWalletAmount({ currency, amount }) {
  const negative = amount.startsWith('-');
  const [integer, fraction = ''] = amount.replace(/^-/, '').split('.');
  let cents = BigInt(integer) * 100n + BigInt(fraction.padEnd(2, '0').slice(0, 2));
  if (Number(fraction[2] ?? '0') >= 5) cents += 1n;
  const symbol = currency === 'CNY' ? '¥' : currency === 'USD' ? '$' : currency;
  return `${symbol}${negative && cents !== 0n ? '-' : ''}${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
}

export function usageProviderTitle(kind, providerName) {
  return kind === 'codex' ? 'Codex' : kind === 'deepseek' ? 'DeepSeek' : providerName || kind;
}

export function formatUsageDate(milliseconds, locale = 'zh-CN', timeZone) {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return null;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    hourCycle: 'h23', ...(timeZone ? { timeZone } : {}),
  }).format(new Date(milliseconds));
}

// Stay above the trigger when possible, otherwise below, within the viewport.
export function usagePopoverPosition(anchor, panel, viewport) {
  const inset = 12, gap = 8;
  const left = Math.max(inset, Math.min(anchor.right - panel.width, viewport.width - panel.width - inset));
  const above = anchor.top - panel.height - gap;
  const below = anchor.bottom + gap;
  const top = above >= inset ? above : below + panel.height <= viewport.height - inset ? below : Math.max(inset, viewport.height - panel.height - inset);
  return { left, top };
}

// One shared read loop per provider, irrespective of mounted Session count.
// Abort + generation checks prevent late account/session responses resurfacing.
export function createUsageStore(request, { visible = () => true, schedule = setTimeout, cancel = clearTimeout, interval = 60000, onError = () => {} } = {}) {
  let snapshot = { status: 'loading', value: null };
  let generation = 0, flight, timer, closed = false;
  const listeners = new Set();
  const publish = next => { snapshot = next; for (const listener of listeners) listener(); };
  const stop = () => { if (timer !== undefined) cancel(timer); timer = undefined; };
  const queue = () => { stop(); if (!closed && listeners.size && visible()) timer = schedule(() => { timer = undefined; refresh(); }, interval); };
  const refresh = () => {
    if (closed || !listeners.size || !visible() || flight) return flight?.promise;
    stop();
    const own = { generation, controller: new AbortController() };
    flight = own;
    own.promise = Promise.resolve().then(() => request(own.controller.signal)).then(value => {
      if (!closed && own.generation === generation) publish({ status: 'ready', value });
    }).catch(error => {
      if (!closed && own.generation === generation) {
        try { onError(error); } catch {}
        publish({ status: 'failed', value: null, error: String(error?.message ?? error).replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 300) });
      }
    }).finally(() => { if (flight === own) { flight = undefined; queue(); } });
    return own.promise;
  };
  const invalidate = () => {
    generation++; flight?.controller.abort(); flight = undefined; stop();
    publish({ status: 'loading', value: null });
    refresh();
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) refresh();
      return () => {
        listeners.delete(listener);
        if (!listeners.size) { generation++; flight?.controller.abort(); flight = undefined; stop(); snapshot = { status: 'loading', value: null }; }
      };
    },
    refresh, invalidate,
    wake() { if (visible()) refresh(); else stop(); },
    dispose() { closed = true; generation++; stop(); flight?.controller.abort(); flight = undefined; listeners.clear(); },
  };
}
