window.__ModuleLoader__.load({
  id: 'dsh-usage',
  factory(require) {
    const React = require('react');
    const { createPortal } = require('react-dom');
    const h = React.createElement;
    /* DSH_USAGE_LOGIC */
    const dictionaries = {
      en: {
        cycleAccount: 'Preview next account', applyAccount: 'Activate previewed account', previewAccount: 'Previewed account', applying: 'Activating…', applyFailed: 'Could not activate this account. Please retry.', 'account-removed': 'This account is no longer available. Refresh and retry.', 'active-account-changed': 'The active account changed elsewhere. Review and retry.', 'account-selection-unconfirmed': 'Account activation could not be confirmed. Please retry.',
        details: 'Usage details', model: 'Model', account: 'Current account', total: 'Total balance', recharge: 'Recharge balance', bonus: 'Bonus balance', fiveHour: '5-hour quota', sevenDay: '7-day quota', quota: 'quota', resetAt: 'Resets at', updatedAt: 'Updated at', refreshIn: 'Refresh in', countdown: '{days} days {hours} hours {minutes} minutes', unknownTime: 'Not reported', remainingValue: '{value}% remaining', close: 'Close usage details',
        label: 'Account usage', loading: 'Loading…', failed: 'Usage unavailable', signedOut: 'Not signed in', empty: 'No quota reported', remaining: 'remaining', active: 'current account', due: 'awaiting reset', balance: 'Account balance (recharge + bonus)', unsupported: 'This route does not use the DSH account balance',
      },
      zh: {
        cycleAccount: '切换预览账号', applyAccount: '启用此账号', previewAccount: '预览账号', applying: '正在启用…', applyFailed: '账号启用失败，请重试。', 'account-removed': '该账号已不可用，请刷新后重试。', 'active-account-changed': '活动账号已在其他位置更改，请核对后重试。', 'account-selection-unconfirmed': '暂时无法确认账号是否启用，请重试。',
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
      inject: ['slots', 'locale', 'connection', 'remote', 'modelDirectories'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register('dsh-usage', dictionaries));
        const t = ctx.locale.bind('dsh-usage');
        const connection = ctx.get('connection');
        /* Resolved per read, not once at apply time: the account namespace is a
           `remote.account` child service that may mount after this plugin. */
        const accountService = () => ctx.get('remote.account') ?? ctx.get('remote')?.account;
        const directories = ctx.get('modelDirectories');
        const locale = ctx.get('locale');
        const visible = () => document.visibilityState !== 'hidden';
        async function codexCall(endpoint, signal, payload = { force: false }) {
          return unwrap(await connection.rpc.call('/api', `codex-subscription/${endpoint}`, payload, signal));
        }
        const identity = status => JSON.stringify([status?.authenticated, ...(status?.accounts ?? []).map(a => [a.id, a.active])]);
        async function readCodex(signal) {
          const timeout = new AbortController();
          const abort = () => timeout.abort();
          signal.addEventListener('abort', abort, { once: true });
          if (signal.aborted) abort();
          const timer = setTimeout(abort, 30000);
          try {
            const status = await codexCall('status', timeout.signal);
            if (!status?.authenticated) return { signedOut: true, rows: [], accounts: [] };
            const usage = await codexCall('usage', timeout.signal);
            const after = await codexCall('status', timeout.signal);
            if (identity(status) !== identity(after)) throw new Error('Account changed');
            const accounts = after.accounts ?? [];
            const active = accounts.find(account => account.active === true) ?? (accounts.length === 1 ? accounts[0] : null);
            return {
              rows: accountRows(after, { accounts: active ? [{ id: active.id, usage }] : [] }),
              accounts: accountRows(after, { accounts: [] }, true),
            };
          } finally { clearTimeout(timer); signal.removeEventListener('abort', abort); }
        }
        // Only retained while a multi-account Codex details popup is open.
        // This read-only endpoint never changes the account used by inference.
        async function readCodexPreview(signal) {
          const timeout = new AbortController();
          const abort = () => timeout.abort();
          signal.addEventListener('abort', abort, { once: true });
          if (signal.aborted) abort();
          const timer = setTimeout(abort, 30000);
          try {
            const status = await codexCall('status', timeout.signal);
            if (!status?.authenticated) return { signedOut: true, rows: [] };
            const usage = await codexCall('usage/accounts', timeout.signal);
            const after = await codexCall('status', timeout.signal);
            if (identity(status) !== identity(after)) throw new Error('active-account-changed');
            return { rows: accountRows(after, usage, true) };
          } finally { clearTimeout(timer); signal.removeEventListener('abort', abort); }
        }
        async function readDeepSeek(signal) {
          const account = accountService();
          if (!account) throw new Error('Account service unavailable');
          const client = {
            version: '0.2.1-rc.5',
            locale: locale.getSnapshot().active,
            timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
          };
          const state = unwrap(await account.getState());
          if (state?.status !== 'credential-stored') return { signedOut: true, totals: [] };
          let timer;
          const balance = await Promise.race([
            Promise.resolve().then(() => account.getBalance(client)).then(unwrap),
            new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Balance query timed out')), 20000); }),
          ]).finally(() => clearTimeout(timer));
          if (signal.aborted) throw new Error('Cancelled');
          if (balance === null) return { signedOut: true, totals: [] };
          if (balance.status !== 'ready') throw new Error('Platform balance query failed');
          return {
            totals: walletTotals(balance),
            recharge: walletTotals({ status: 'ready', value: balance.value }),
            bonus: walletTotals({ status: 'ready', value: balance.bonusWallets }),
            updatedAt: Date.now(),
          };
        }
        const stores = {
          codex: createUsageStore(readCodex, { visible, onError: error => console.error('[dsh-usage] codex', error?.message ?? error) }),
          codexPreview: createUsageStore(readCodexPreview, { visible, onError: error => console.error('[dsh-usage] codex preview', error?.message ?? error) }),
          deepseek: createUsageStore(readDeepSeek, { visible, onError: error => console.error('[dsh-usage] deepseek', error?.message ?? error) }),
        };
        ctx.effect(() => {
          const wake = () => Object.values(stores).forEach(store => store.wake());
          const invalidateCodex = () => { stores.codex.invalidate(); stores.codexPreview.invalidate(); };
          document.addEventListener('visibilitychange', wake);
          window.addEventListener('focus', wake);
          // This is the account-change notification used by the existing plugin.
          window.addEventListener('dsh-codex-subscription:refresh-quick-quota', invalidateCodex);
          return () => {
            document.removeEventListener('visibilitychange', wake);
            window.removeEventListener('focus', wake);
            window.removeEventListener('dsh-codex-subscription:refresh-quick-quota', invalidateCodex);
            Object.values(stores).forEach(store => store.dispose());
          };
        });
        const idlePreview = Object.freeze({ status: 'loading', value: null });
        const idleSubscribe = () => () => {};
        const getIdlePreview = () => idlePreview;
        function useCodexPreview(enabled) {
          return React.useSyncExternalStore(
            enabled ? stores.codexPreview.subscribe : idleSubscribe,
            enabled ? stores.codexPreview.getSnapshot : getIdlePreview,
            getIdlePreview);
        }
        const detailError = error => Object.hasOwn(dictionaries.en, error) ? t(error) : error;
        function DetailRow({ label, children }) {
          return h('div', { className: 'dshUsageDetailRow' }, h('span', { className: 'dshUsageDetailLabel' }, label), h('span', { className: 'dshUsageDetailValue' }, children));
        }
        function UsageDetails({ snapshot, kind, model, modelName, now, isPreview, previewAccount }) {
          if (snapshot.status !== 'ready') return h(React.Fragment, null,
            isPreview && previewAccount && h(DetailRow, { label: t('previewAccount') }, previewAccount.label),
            isPreview && previewAccount?.email && h('div', { className: 'dshUsageDetailNote' }, previewAccount.email),
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
              h(DetailRow, { label: t(isPreview ? 'previewAccount' : 'account') }, account.label),
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
        function UsageValue({ kind, model, modelName, providerName }) {
          const store = stores[kind];
          const snapshot = React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
          const [now, setNow] = React.useState(Date.now);
          const [open, setOpen] = React.useState(false);
          const [previewId, setPreviewId] = React.useState(null);
          const [applying, setApplying] = React.useState(false);
          const [actionError, setActionError] = React.useState(null);
          const actionRef = React.useRef(null), mountedRef = React.useRef(false), cycleRef = React.useRef(null);
          const previewEnabled = open && kind === 'codex' && snapshot.status === 'ready' && (snapshot.value.accounts?.length ?? 0) > 1;
          const previewSnapshot = useCodexPreview(previewEnabled);
          const preview = codexPreviewState(snapshot, previewSnapshot, previewId);
          const [position, setPosition] = React.useState(null);
          const triggerRef = React.useRef(null), panelRef = React.useRef(null);
          const id = React.useId();
          const providerTitle = usageProviderTitle(kind, providerName);
          const close = restoreFocus => { setOpen(false); if (restoreFocus) triggerRef.current?.focus(); };
          React.useEffect(() => { setOpen(false); setPosition(null); setPreviewId(null); setActionError(null); }, [kind, model]);
          React.useEffect(() => { if (!open) { setPreviewId(null); setActionError(null); } }, [open]);
          React.useEffect(() => {
            mountedRef.current = true;
            return () => { mountedRef.current = false; actionRef.current?.abort(); };
          }, []);
          const cycleAccount = () => {
            if (actionRef.current) return;
            setActionError(null);
            setPreviewId(nextPreviewAccountId(preview.accounts, preview.selectedId, preview.activeId));
          };
          // Selecting a billing/credential identity requires the user's explicit
          // check-mark confirmation. No model tool auto-activates an account.
          const applyAccount = async () => {
            if (kind !== 'codex' || !open || !preview.isPreview || actionRef.current) return;
            const controller = new AbortController();
            actionRef.current = controller;
            setApplying(true); setActionError(null);
            const timer = setTimeout(() => controller.abort(), 30000);
            try {
              await activateCodexAccount((endpoint, payload, signal) => codexCall(endpoint, signal, payload), preview.selectedId, preview.activeId, controller.signal);
              if (mountedRef.current) { setPreviewId(null); cycleRef.current?.focus(); }
            } catch (error) {
              if (mountedRef.current) setActionError(t(['account-removed', 'active-account-changed', 'account-selection-unconfirmed'].includes(error?.code) ? error.code : 'applyFailed'));
            } finally {
              clearTimeout(timer);
              actionRef.current = null;
              if (mountedRef.current) {
                setApplying(false);
                // Reconcile even after a transport error: the Host may already
                // have committed the switch. Reuse the original quota event.
                window.dispatchEvent(new Event('dsh-codex-subscription:refresh-quick-quota'));
                panelRef.current?.focus({ preventScroll: true });
              }
            }
          };
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
            if (kind !== 'codex') return;
            const timer = setInterval(() => setNow(Date.now()), 15000);
            return () => clearInterval(timer);
          }, [kind]);
          let content;
          if (snapshot.status !== 'ready') content = h('span', { className: snapshot.status === 'failed' ? 'dshUsageError' : undefined, title: snapshot.error },
            `${kind} ${t(snapshot.status === 'failed' ? 'failed' : 'loading')}`,
            snapshot.status === 'failed' && snapshot.error && h('span', { className: 'dshUsageReason' }, `（${snapshot.error.slice(0, 48)}）`));
          else if (snapshot.value.signedOut) content = h('span', null, `${kind} ${t('signedOut')}`);
          else if (kind === 'deepseek') content = h('span', { title: t('balance') }, snapshot.value.totals.map(formatWalletAmount).join(' · ') || t('empty'));
          else content = snapshot.value.rows.length ? snapshot.value.rows.map(account => {
            const windows = quotaWindows(account.usage, model);
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
                kind === 'codex' && preview.accounts.length > 1 && h('button', {
                  type: 'button', className: 'dshUsageAccountAction', ref: cycleRef,
                  onClick: cycleAccount, disabled: applying, title: t('cycleAccount'), 'aria-label': t('cycleAccount'),
                }, h('svg', { viewBox: '0 0 20 20', width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
                  h('path', { d: 'M3 6h13m-3-3 3 3-3 3M17 14H4m3-3-3 3 3 3' }))),
                kind === 'codex' && preview.isPreview && h('button', {
                  type: 'button', className: 'dshUsageAccountAction', onClick: applyAccount, disabled: applying,
                  title: t(applying ? 'applying' : 'applyAccount'), 'aria-label': t(applying ? 'applying' : 'applyAccount'),
                }, h('svg', { viewBox: '0 0 20 20', width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: 'm4 10 4 4 8-8' }))),
                h('span', { className: 'dshUsageSummary' }, kind === 'deepseek' && snapshot.status === 'ready' && !snapshot.value.signedOut ? snapshot.value.totals.map(formatWalletAmount).join(' · ') : t('details')),
                h('button', { type: 'button', className: 'dshUsageClose', onClick: () => close(true), 'aria-label': t('close') }, '×')),
              actionError && h('div', { className: 'dshUsageActionError', role: 'alert' }, actionError),
              h(UsageDetails, { snapshot: kind === 'codex' ? preview.detailSnapshot : snapshot, kind, model, modelName, now, isPreview: preview.isPreview, previewAccount: preview.accounts.find(account => account.id === preview.selectedId) })), document.body));


        }
        function Usage({ directory }) {
          const state = React.useSyncExternalStore(
            React.useCallback(fn => directory.subscribe(fn), [directory]),
            React.useCallback(() => directory.getSnapshot(), [directory]));
          React.useSyncExternalStore(fn => locale.subscribe(fn), () => locale.getSnapshot());
          const current = state.current;
          const kind = usageKind(current?.provider);
          const group = state.groups?.find(group => group.id === current?.provider);
          const modelName = group?.models?.find(model => model.id === current?.model)?.name;
          return kind ? h(UsageValue, { kind, model: current.model, modelName, providerName: group?.name, key: kind }) : null;
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
