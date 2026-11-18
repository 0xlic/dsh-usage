// Model-specific limit matching follows dsh-codex-subscription 3.2.5's
// selectModelQuotaWindows semantics. Original implementation here is MIT.
export function usageKind(provider) {
  if (/^codex-sub-[a-f0-9]{32}$/.test(provider ?? '')) return 'codex';
  if (provider === 'deepseek-account') return 'deepseek';
  if (provider === 'capinfo') return 'capinfo';
  if (provider === 'kimi-coding') return 'kimi-coding';
  // API keys query their own billing account, not the signed-in DSH account.
  if (provider === 'deepseek-official') return 'deepseek-api';
  return null;
}

// One choice per Codex account, not per model. Keep the session's model
// wherever offered; only fall back when an account does not advertise it.
export function codexModelChoices(groups, preferredModel) {
  const accounts = (groups ?? []).filter(group => usageKind(group.id) === 'codex' && group.models?.length);
  if (accounts.length < 2) return [];
  return accounts.map(group => {
    const model = group.models.find(model => model.id === preferredModel) || group.models[0];
    return { provider: group.id, model: model.id, modelName: model.name, providerName: group.name };
  });
}

export function sameUsageModel(a, b) {
  return a?.provider === b?.provider && a?.model === b?.model;
}

export function nextUsageModel(choices, current) {
  if (!choices.length) return null;
  return choices[(choices.findIndex(choice => choice.provider === current?.provider) + 1) % choices.length];
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
  if (seconds % 86400 === 0) return `${seconds / 86400}day`;
  if (seconds % 3600 === 0) return `${seconds / 3600}h`;
  return seconds % 60 === 0 ? `${seconds / 60}m` : `${seconds}s`;
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

export function accountRows(status, allUsage, includeInactive = false) {
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
  })).filter(account => includeInactive || account.active);
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

// Capinfo uses only M / B, always with two decimal places (including zero).
export function formatTokenCount(value) {
  if (!Number.isSafeInteger(value) || value < 0) return '--';
  const billions = value >= 1_000_000_000;
  return `${(value / (billions ? 1_000_000_000 : 1_000_000)).toFixed(2)}${billions ? 'B' : 'M'}`;
}

export function formatCapinfoUnitCost({ amount, tokens }) {
  if (!Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(tokens) || tokens <= 0) return '--';
  const cost = amount * (1_000_000 / tokens);
  return Number.isFinite(cost) ? `¥${cost.toFixed(2)} / 1M Token` : '--';
}

// The dock and details panel render the same raw dsh-capinfo snapshot.
export function capinfoTodayView(snapshot) {
  const value = snapshot?.status === 'ready' ? snapshot.value : null;
  let reason = null;
  if (!value || snapshot.status === 'failed') reason = snapshot?.status === 'failed' ? 'failed' : 'loading';
  else if (value.status === 'missing') reason = 'capinfoMissing';
  else if (value.status !== 'ready' || !value.data) reason = 'failed';
  const data = reason ? null : value.data;
  const amount = Number.isFinite(data?.amount) && data.amount >= 0 ? `¥${data.amount.toFixed(2)}` : '¥--';
  const tokens = Number.isSafeInteger(data?.tokens) && data.tokens >= 0 ? formatTokenCount(data.tokens) : '--';
  const refreshedAt = typeof data?.refreshedAt === 'string' && Number.isFinite(Date.parse(data.refreshedAt))
    ? Date.parse(data.refreshedAt) : null;
  return {amount, tokens, summary: `${amount} · ${tokens}`, refreshedAt, reason};
}

export function usageProviderTitle(kind, providerName) {
  return kind === 'kimi-coding' ? 'Kimi Coding' : kind === 'codex' ? 'Codex' : kind === 'deepseek' ? 'DeepSeek' : kind === 'deepseek-api' ? 'DeepSeek API' : providerName || (kind === 'capinfo' ? 'Capinfo' : kind);
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

// Observe owner state, never intercept model selection or patch its controls.
export function observeModelSelection(directory, onSelected) {
  let pending = !!directory.getSnapshot().pending;
  return directory.subscribe(() => {
    const next = directory.getSnapshot();
    if (pending && !next.pending && next.status === 'ready') onSelected();
    pending = !!next.pending;
  });
}

// One shared read loop per provider/model, irrespective of mounted Session count.
// Abort + generation checks prevent late account/session responses resurfacing.
export function createUsageStore(request, { visible = () => true, schedule = setTimeout, cancel = clearTimeout, interval = 60000, onError = () => {}, cachedFirst = false } = {}) {
  let snapshot = { status: 'loading', value: null };
  let generation = 0, flight, timer, closed = false;
  const listeners = new Set();
  const publish = next => { snapshot = next; for (const listener of listeners) listener(); };
  const stop = () => { if (timer !== undefined) cancel(timer); timer = undefined; };
  const queue = () => { stop(); if (!closed && listeners.size && visible()) timer = schedule(() => { timer = undefined; refresh(); }, interval); };
  const refresh = (options = { force: true, reason: 'timer' }) => {
    if (closed || !listeners.size || !visible() || flight) return flight?.promise;
    stop();
    const own = { generation, controller: new AbortController() };
    flight = own;
    own.promise = Promise.resolve().then(() => request(own.controller.signal, options)).then(value => {
      if (!closed && own.generation === generation) publish({ status: 'ready', value });
    }).catch(error => {
      if (!closed && own.generation === generation) {
        // A background read should not replace this route's last good snapshot.
        const background = ['timer', 'cache', 'revalidate'].includes(options.reason);
        if (background && snapshot.status === 'ready' && error?.code !== 'usage/identity-changed') return;
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
      if (listeners.size === 1) {
        if (!cachedFirst) refresh();
        else {
          // Show this exact route's retained snapshot immediately, ask the Host
          // cache next, then revalidate without replacing content with loading.
          const expected = generation;
          Promise.resolve(refresh({ force: false, reason: 'cache' })).then(() => {
            if (!closed && generation === expected && listeners.size && snapshot.status === 'ready')
              refresh({ force: true, reason: 'revalidate' });
          });
        }
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          generation++; flight?.controller.abort(); flight = undefined; stop();
          if (!cachedFirst || snapshot.status !== 'ready') snapshot = { status: 'loading', value: null };
        }
      };
    },
    refresh, invalidate,
    wake() { if (visible()) refresh(); else stop(); },
    dispose() { closed = true; generation++; stop(); flight?.controller.abort(); flight = undefined; listeners.clear(); },
  };
}
