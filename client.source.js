window.__ModuleLoader__.load({
  id: 'dsh-usage',
  factory(require) {
    const React = require('react');
    const { createPortal } = require('react-dom');
    const h = React.createElement;
    /* DSH_USAGE_LOGIC */
    const dictionaries = {
      en: {
        refresh: 'Refresh usage', refreshing: 'Refreshing…',
        keyBalance: 'Account balance', keyTotal: 'Total quota', keyUsed: 'Used quota', keyRequired: 'API key not configured', keyInvalid: 'API key is unavailable', balanceUnavailable: 'Balance endpoint unavailable; retrying automatically', balanceStale: 'Balance data is outdated', capinfoMissing: 'Capinfo balance service unavailable',
        details: 'Usage details', model: 'Model', account: 'Current account', total: 'Total balance', recharge: 'Recharge balance', bonus: 'Bonus balance', fiveHour: '5-hour quota', sevenDay: '7-day quota', quota: 'quota', resetAt: 'Resets at', updatedAt: 'Updated at', refreshIn: 'Refresh in', countdown: '{days} days {hours} hours {minutes} minutes', unknownTime: 'Not reported', remainingValue: '{value}% remaining', close: 'Close usage details',
        label: 'Account usage', loading: 'Loading…', failed: 'Usage unavailable', signedOut: 'Not signed in', empty: 'No quota reported', remaining: 'remaining', active: 'current account', due: 'awaiting reset', balance: 'Account balance (recharge + bonus)', unsupported: 'This route does not use the DSH account balance',
      },
      zh: {
        refresh: '刷新用量', refreshing: '正在刷新…',
        keyBalance: '账户余额', keyTotal: '总额度', keyUsed: '已用额度', keyRequired: '未配置 API 密钥', keyInvalid: 'API Key 当前不可用', balanceUnavailable: '余额接口暂不可用，将自动重试', balanceStale: '余额数据已过期', capinfoMissing: 'Capinfo 余额服务未启用或不可用',
        details: '用量详情', model: '当前模型', account: '当前账号', total: '账户总余额', recharge: '充值余额', bonus: '赠金余额', fiveHour: '5 小时限额', sevenDay: '7 天限额', quota: '限额', resetAt: '重置时间', updatedAt: '数据更新时间', refreshIn: '刷新时间', countdown: '{days} 天 {hours} 小时 {minutes} 分', unknownTime: '暂未提供', remainingValue: '剩余 {value}%', close: '关闭用量详情',
        label: '账户用量', loading: '读取中…', failed: '用量暂不可用', signedOut: '未登录', empty: '暂无额度数据', remaining: '剩余', active: '当前账号', due: '等待重置', balance: '账户余额（充值 + 赠送）', unsupported: '此路由不使用 DSH 账户余额',
      },
    };
    const styles = `
.dshUsage{order:1;display:inline-flex;align-items:center;flex:0 1 auto;flex-wrap:nowrap;gap:14px;min-width:0;max-width:40%;overflow:hidden;white-space:nowrap;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:20px;font-variant-numeric:tabular-nums;background:transparent;border:0;border-radius:6px;padding:1px 8px;min-height:24px;box-sizing:border-box;cursor:pointer;text-align:start;transition:background-color .12s,color .12s}
.dshUsage:hover,.dshUsage[aria-expanded=true]{background:color-mix(in srgb,var(--dsw-alias-label-primary) 7%,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary)}
.dshUsage:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.dshUsagePopover{position:fixed;z-index:1200;box-sizing:border-box;width:min(360px,calc(100vw - 24px));height:auto;max-height:calc(100dvh - 24px);overflow:auto;padding:16px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);box-shadow:0 6px 24px color-mix(in srgb,var(--dsw-alias-label-primary) 12%,transparent);font-family:inherit;font-size:13px;line-height:22px;font-variant-numeric:tabular-nums;text-align:start;outline:none}
.dshUsageHeader{display:flex;align-items:center;gap:8px;color:var(--dsw-alias-label-primary);font-size:14px;font-weight:500;padding-bottom:12px;margin-bottom:10px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.dshUsageSummary{margin-inline-start:auto;font-weight:500;white-space:nowrap}
.dshUsageAccountAction{display:inline-flex;align-items:center;justify-content:center;flex:none;width:26px;height:26px;padding:0;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
.dshUsageAccountAction:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-label-primary) 7%,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary)}
.dshUsageAccountAction:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.dshUsageAccountAction:disabled{cursor:wait;opacity:.5}
.dshUsageActionError{font-size:12px;color:var(--dsw-alias-state-error-primary);margin:0 0 8px;overflow-wrap:anywhere}
.dshUsageDetailRow{display:flex;justify-content:space-between;align-items:baseline;gap:16px;padding:4px 0}
.dshUsageDetailLabel{color:var(--dsw-alias-label-secondary);flex:none}
.dshUsageDetailValue{text-align:end;overflow-wrap:anywhere;min-width:0}
.dshUsageQuotaBlock{padding:10px 0}
.dshUsageQuotaBlock+.dshUsageQuotaBlock{border-top:1px solid var(--dsw-alias-border-l1)}
.dshUsageQuotaName{color:var(--dsw-alias-label-primary);font-weight:500}
.dshUsageDetailNote{font-size:12px;color:var(--dsw-alias-label-secondary);opacity:.85;overflow-wrap:anywhere}
.dshUsageUpdated{border-top:1px solid var(--dsw-alias-border-l1);margin-top:8px;padding-top:10px;font-size:12px}
.dshUsageClose{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;flex:none;border:0;border-radius:4px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:18px;padding:0}
.dshUsageClose:hover{background:var(--dsw-alias-bg-layer-2)}
.dshUsageClose:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
/* Truncate a single inline text flow, not nested flex rows: the dock must
   never grow taller or let usage monopolize the built-in session statistics. */
.dshUsageContent{display:block;flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshUsageAccount{display:inline;white-space:nowrap}
.dshUsageAccount+.dshUsageAccount{margin-inline-start:14px}
.dshUsageName{font-weight:400;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshUsageWindow{display:inline;white-space:nowrap}
.dshUsageWindow+.dshUsageWindow{margin-inline-start:9px}
.dshUsageReset{opacity:.78;margin-inline-start:4px}
.dshUsageLow{color:var(--dsw-alias-state-warn-primary)}
.dshUsageError{color:var(--dsw-alias-state-error-primary)}
.dshUsageReason{color:var(--dsw-alias-label-secondary);opacity:.85;max-width:min(420px,60vw);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
`;
    const unwrap = result => {
      if (result?.ok !== true) throw new Error(result?.error?.message || 'Usage read failed');
      return result.value;
    };
    return {
      inject: ['slots', 'locale', 'modelDirectories', 'configForms'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register('dsh-usage', dictionaries));
        const t = ctx.locale.bind('dsh-usage');
        const directories = ctx.get('modelDirectories');
        const locale = ctx.get('locale');
        const chatSettings = ctx.get('configForms').get('ui-chat');
        const subscribePerformanceUsage = listener => chatSettings.subscribe(listener);
        const getPerformanceUsage = () => chatSettings.getSnapshot().value?.performanceUsage ?? 'detailed';
        const visible = () => document.visibilityState !== 'hidden';
        async function readHostUsage(kind, provider, model, signal, options) {
          const response = await fetch('/api/plugins/usage/read', {
            method: 'POST', credentials: 'same-origin', cache: 'no-store',
            headers: { 'Content-Type': 'application/json' }, signal,
            body: JSON.stringify({
              kind, provider, model, force: options?.force === true,
              ...(kind === 'deepseek' ? { client: { version: '0.2.2-rc.1', locale: locale.getSnapshot().active,
                timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60 } } : {}),
            }),
          });
          if (!response.ok) throw new Error('Usage query failed');
          return unwrap(await response.json());
        }
        const stores = new Map();
        function storeFor(kind, provider, model) {
          const key = JSON.stringify([kind, provider, model]);
          if (!stores.has(key)) stores.set(key, createUsageStore(
            (signal, options) => readHostUsage(kind, provider, model, signal, options),
            { visible, onError: () => console.error(`[dsh-usage] ${kind} query failed`) }));
          return stores.get(key);
        }
        ctx.on('connection/reset', () => stores.forEach(store => store.invalidate()));
        ctx.effect(() => {
          const wake = () => stores.forEach(store => store.wake());
          document.addEventListener('visibilitychange', wake);
          window.addEventListener('focus', wake);
          return () => {
            document.removeEventListener('visibilitychange', wake);
            window.removeEventListener('focus', wake);
            stores.forEach(store => store.dispose());
            stores.clear();
          };
        });
        const detailError = error => Object.hasOwn(dictionaries.en, error) ? t(error) : error;
        function DetailRow({ label, children }) {
          return h('div', { className: 'dshUsageDetailRow' }, h('span', { className: 'dshUsageDetailLabel' }, label), h('span', { className: 'dshUsageDetailValue' }, children));
        }
        function UsageDetails({ snapshot, kind, model, modelName, now }) {
          // Capinfo failures, pending reads and stale data share a quiet placeholder UI.
          if (kind === 'capinfo') {
            const balance = capinfoBalanceView(snapshot.status === 'ready' ? snapshot.value : null, now);
            return h(React.Fragment, null,
              h(DetailRow, { label: t('model') }, modelName || model),
              h(DetailRow, { label: t('keyBalance') }, balance.amount),
              h(DetailRow, { label: t('keyTotal') }, balance.total || '¥--'),
              h(DetailRow, { label: t('keyUsed') }, balance.used || '¥--'),
              h('div', { className: 'dshUsageUpdated' }, h(DetailRow, { label: t('updatedAt') },
                balance.reason ? '--' : formatUsageDate(balance.updatedAt, locale.getSnapshot().active) || '--')));
          }
          if (snapshot.status !== 'ready') return h(React.Fragment, null,
            h('div', { className: 'dshUsageDetailNote' }, t(snapshot.status === 'failed' ? 'failed' : 'loading'), snapshot.error ? ` · ${detailError(snapshot.error)}` : ''));
          const value = snapshot.value;
          if (value.signedOut) return h('div', { className: 'dshUsageDetailNote' }, t('signedOut'));
          const date = milliseconds => formatUsageDate(milliseconds, locale.getSnapshot().active) || t('unknownTime');
          const countdown = resetsAt => {
            const parts = resetCountdown(resetsAt, now);
            if (parts === null) return t('unknownTime');
            if (parts === 'due') return t('due');
            return t('countdown').replace('{days}', parts.days).replace('{hours}', parts.hours).replace('{minutes}', parts.minutes);
          };
          const amount = wallets => wallets?.length ? wallets.map(formatWalletAmount).join(' · ') : '—';
          const modelRow = h(DetailRow, { label: t('model') }, modelName || model);
          if (kind === 'deepseek') return h(React.Fragment, null, modelRow,
            h(DetailRow, { label: t('total') }, amount(value.totals)),
            h(DetailRow, { label: t('recharge') }, amount(value.recharge)),
            h(DetailRow, { label: t('bonus') }, amount(value.bonus)),
            h('div', { className: 'dshUsageUpdated' }, h(DetailRow, { label: t('updatedAt') }, date(value.updatedAt))));
          return h(React.Fragment, null, modelRow,
            value.rows.length ? value.rows.map(account => h('div', { key: account.id },
              h(DetailRow, { label: t('account') }, account.label),
              account.failed && h('div', { className: 'dshUsageActionError' }, `${t('failed')} · ${account.error || t('empty')}`),
              account.email && h('div', { className: 'dshUsageDetailNote' }, account.email),
              quotaWindows(account.usage, model).map(w => h('div', { className: 'dshUsageQuotaBlock', key: w.windowSeconds },
                h('div', { className: 'dshUsageDetailRow' },
                  h('span', { className: 'dshUsageQuotaName' }, windowLabel(w.windowSeconds) === '5h' ? t('fiveHour') : windowLabel(w.windowSeconds) === '7day' ? t('sevenDay') : `${windowLabel(w.windowSeconds)} ${t('quota')}`),
                  h('span', { className: w.remainingPercent <= 20 ? 'dshUsageLow' : 'dshUsageQuotaName' }, t('remainingValue').replace('{value}', Math.round(w.remainingPercent)))),
                h(DetailRow, { label: t('refreshIn') }, countdown(w.resetsAt)),
                h(DetailRow, { label: t('resetAt') }, date(w.resetsAt === null ? null : w.resetsAt * 1000)))),
              !quotaWindows(account.usage, model).length && h('div', { className: 'dshUsageDetailNote' }, t('empty')),
              h('div', { className: 'dshUsageUpdated' }, h(DetailRow, { label: t('updatedAt') }, date(account.usage?.fetchedAt))))) : h('div', null, t('empty')));
        }
        function UsageValue({ kind, provider, model, modelName, providerName, selectionRevision }) {
          const performanceUsage = React.useSyncExternalStore(subscribePerformanceUsage, getPerformanceUsage, getPerformanceUsage);
          const store = storeFor(kind, provider, model);
          const snapshot = React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
          const [now, setNow] = React.useState(Date.now);
          const [open, setOpen] = React.useState(false);
          const [refreshing, setRefreshing] = React.useState(false);
          const mountedRef = React.useRef(false);
          const previousRevision = React.useRef(selectionRevision);
          React.useEffect(() => {
            if (previousRevision.current !== selectionRevision) store.invalidate();
            previousRevision.current = selectionRevision;
          }, [store, selectionRevision]);
          const refresh = async () => {
            if (refreshing) return;
            setRefreshing(true);
            try { await store.refresh({ force: true, reason: 'manual' }); }
            finally { if (mountedRef.current) { setRefreshing(false); setNow(Date.now()); } }
          };
          const [position, setPosition] = React.useState(null);
          const triggerRef = React.useRef(null), panelRef = React.useRef(null);
          const id = React.useId();
          const providerTitle = usageProviderTitle(kind, providerName);
          const close = restoreFocus => { setOpen(false); if (restoreFocus) triggerRef.current?.focus(); };
          React.useEffect(() => { setOpen(false); setPosition(null); }, [kind, provider, model]);
          React.useEffect(() => {
            mountedRef.current = true;
            return () => { mountedRef.current = false; };
          }, []);
          React.useLayoutEffect(() => {
            if (!open) return;
            const panel = panelRef.current, trigger = triggerRef.current;
            if (!panel || !trigger) return;
            const place = () => {
              const next = usagePopoverPosition(trigger.getBoundingClientRect(), panel.getBoundingClientRect(), { width: window.innerWidth, height: window.innerHeight });
              setPosition(previous => previous?.left === next.left && previous?.top === next.top ? previous : next);
            };
            const outside = event => { if (!panel.contains(event.target) && !trigger.contains(event.target)) close(false); };
            const escape = event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); } };
            place();
            panel.focus({ preventScroll: true });
            const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null;
            observer?.observe(panel); observer?.observe(trigger);
            window.addEventListener('resize', place);
            document.addEventListener('scroll', place, true);
            document.addEventListener('pointerdown', outside, true);
            document.addEventListener('focusin', outside, true);
            document.addEventListener('keydown', escape, true);
            return () => {
              observer?.disconnect();
              window.removeEventListener('resize', place);
              document.removeEventListener('scroll', place, true);
              document.removeEventListener('pointerdown', outside, true);
              document.removeEventListener('focusin', outside, true);
              document.removeEventListener('keydown', escape, true);
            };
          }, [open]);
          React.useEffect(() => {
            if (kind !== 'codex' && kind !== 'capinfo') return;
            const timer = setInterval(() => setNow(Date.now()), 15000);
            return () => clearInterval(timer);
          }, [kind]);
          let content;
          if (kind === 'capinfo') content = h('span', { title: t('keyBalance') },
            capinfoBalanceView(snapshot.status === 'ready' ? snapshot.value : null, now).amount);
          else if (snapshot.status !== 'ready') content = h('span', { className: snapshot.status === 'failed' ? 'dshUsageError' : undefined, title: snapshot.error },
            `${kind} ${t(snapshot.status === 'failed' ? 'failed' : 'loading')}`,
            snapshot.status === 'failed' && snapshot.error && h('span', { className: 'dshUsageReason' }, `（${snapshot.error.slice(0, 48)}）`));
          else if (snapshot.value.signedOut) content = h('span', null, `${kind} ${t('signedOut')}`);
          else if (kind === 'deepseek') content = h('span', { title: t('balance') }, snapshot.value.totals.map(formatWalletAmount).join(' · ') || t('empty'));
          else content = snapshot.value.rows.length ? snapshot.value.rows.map(account => {
            // Only the dock summary is compacted; the popover keeps every quota window.
            const windows = quotaWindows(account.usage, model)
              .filter(w => performanceUsage !== 'compact' || windowLabel(w.windowSeconds) !== '7day');
            const title = [account.label, account.email, account.active ? t('active') : '', t('remaining'), account.error].filter(Boolean).join(' · ');
            return h('span', { className: 'dshUsageAccount', key: account.id, title },
              account.failed ? h('span', { className: 'dshUsageError' }, t('failed')) : windows.length ? windows.map(w => {
                const duration = resetDuration(w.resetsAt, now);
                const resetTitle = w.resetsAt ? new Date(w.resetsAt * 1000).toLocaleString() : undefined;
                return h('span', { className: `dshUsageWindow${w.remainingPercent <= 20 ? ' dshUsageLow' : ''}`, key: `${w.windowSeconds}:${w.resetsAt}` },
                  h('span', null, `${windowLabel(w.windowSeconds)} ${Math.round(w.remainingPercent)}%`),
                  duration && h('span', { className: 'dshUsageReset', title: resetTitle }, `↻ ${duration === 'due' ? t('due') : duration}`));
              }) : h('span', null, t('empty')));
          }) : h('span', null, `codex ${t('empty')}`);
          return h(React.Fragment, null,
            h('style', null, styles),
            h('button', {
              type: 'button', className: 'dshUsage', ref: triggerRef,
              'aria-label': `${providerTitle} · ${t('details')}`, 'aria-haspopup': 'dialog',
              'aria-expanded': open, 'aria-controls': open ? id : undefined,
              onClick: () => { setPosition(null); setOpen(value => !value); },
            }, h('span', { className: 'dshUsageContent' }, content)),
            // DSH 0.2.2 contains the docked composer. Keep viewport-positioned
            // details outside that containing block; React still owns cleanup.
            open && createPortal(h('div', {
              id, ref: panelRef, role: 'dialog', tabIndex: -1,
              'aria-labelledby': `${id}-title`, className: 'dshUsagePopover',
              style: { left: position?.left ?? 12, top: position?.top ?? 12 },
            },
              h('div', { className: 'dshUsageHeader' },
                h('svg', { viewBox: '0 0 20 20', width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, 'aria-hidden': true },
                  h('ellipse', { cx: 10, cy: 4, rx: 6, ry: 2.5 }),
                  h('path', { d: 'M4 4v11c0 3.3 12 3.3 12 0V4M4 9c0 3.3 12 3.3 12 0' })),
                h('span', { id: `${id}-title` }, providerTitle),
                h('button', {
                   type: 'button', className: 'dshUsageAccountAction', onClick: refresh, disabled: refreshing,
                   title: t(refreshing ? 'refreshing' : 'refresh'), 'aria-label': t(refreshing ? 'refreshing' : 'refresh'),
                 }, '↻'),
                 h('span', { className: 'dshUsageSummary' }, t('details')),
                h('button', { type: 'button', className: 'dshUsageClose', onClick: () => close(true), 'aria-label': t('close') }, '×')),
              h(UsageDetails, { snapshot, kind, model, modelName, now })), document.body));


        }
        function Usage({ directory }) {
          const state = React.useSyncExternalStore(
            React.useCallback(fn => directory.subscribe(fn), [directory]),
            React.useCallback(() => directory.getSnapshot(), [directory]));
          React.useSyncExternalStore(fn => locale.subscribe(fn), () => locale.getSnapshot());
          const [selectionRevision, setSelectionRevision] = React.useState(0);
          React.useEffect(() => observeModelSelection(directory,
            () => setSelectionRevision(value => value + 1)), [directory]);
          const current = state.current;
          const kind = usageKind(current?.provider);
          const group = state.groups?.find(group => group.id === current?.provider);
          const modelName = group?.models?.find(model => model.id === current?.model)?.name;
          return kind ? h(UsageValue, { kind, provider: current.provider, model: current.model, modelName, providerName: group?.name, selectionRevision, key: JSON.stringify([kind, current.provider, current.model]) }) : null;
        }
        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock', id: 'dsh-usage', order: 20,
          label: () => t('label'),
          inject: sessionId => ({ directory: directories.directoryFor(sessionId).store }),
        }, Usage));
      },
    };
  },
});
