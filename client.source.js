window.__ModuleLoader__.load({
  id: 'dsh-usage',
  factory(require) {
    const React = require('react');
    const { createPortal } = require('react-dom');
    const h = React.createElement;
    /* DSH_USAGE_LOGIC */
    const dictionaries = {
      en: {
        refresh: 'Refresh usage', refreshing: 'Refreshing…', switchModel: 'Preview next Codex account', confirmModel: 'Confirm model switch', switchingModel: 'Switching model…', switchFailed: 'Model switch failed',
        capinfoToday: "Today's cost & tokens", capinfoAmount: "Today's cost", capinfoTokens: "Today's tokens", capinfoUnitCost: 'Unit cost', capinfoMissing: 'Capinfo usage service is unavailable', keyRequired: 'API key not configured',
        apiBalance: 'DeepSeek API account balance', apiKeyRejected: 'API key is invalid or lacks permission', apiConfiguration: 'Check the DeepSeek API provider settings', apiQueryFailed: 'API balance is temporarily unavailable; retry later',
        apiUnsupported: 'Balance query is not supported for custom API endpoints',
        kimiUnsupported: 'Usage query is not supported for custom Kimi endpoints', kimiConfiguration: 'Check the Kimi Coding provider settings', kimiQueryFailed: 'Kimi Coding usage is temporarily unavailable; retry later',
        details: 'Usage details', model: 'Model', account: 'Current account', total: 'Total balance', recharge: 'Recharge balance', bonus: 'Bonus balance', fiveHour: '5-hour quota', sevenDay: '7-day quota', quota: 'quota', resetAt: 'Resets at', updatedAt: 'Updated at', refreshIn: 'Refresh in', countdown: '{days} days {hours} hours {minutes} minutes', unknownTime: 'Not reported', remainingValue: '{value}% remaining',
        label: 'Account usage', loading: 'Loading…', failed: 'Usage unavailable', signedOut: 'Not signed in', empty: 'No quota reported', remaining: 'remaining', active: 'current account', due: 'awaiting reset', balance: 'Account balance (recharge + bonus)', unsupported: 'This route does not use the DSH account balance',
        resetCards: 'Codex reset cards', resetCard: 'Codex quota reset', noResetCards: 'No available reset cards', resetCardsFailed: 'Could not load reset cards.',
        expiresAt: 'Expires at', noExpiration: 'No expiration', useResetCard: 'Use', confirmUseResetCard: 'Confirm use', usingResetCard: 'Using…', cancelUseResetCard: 'Cancel', retryResetCards: 'Retry',
        resetCardWarning: 'Use this one-time card to reset the eligible Codex quotas for the account shown above? This cannot be undone.',
        resetCardUsed: 'Reset card used. Refreshing quotas.', resetCardNothing: 'There is nothing to reset. The card was not used.', resetCardUnavailable: 'This reset card is no longer available.',
        resetCardUseUnknown: 'Could not confirm the result. Check the refreshed list before retrying.', resetCardAccountChanged: 'The current account changed. Reopen usage details before using a card.',
      },
      zh: {
        refresh: '刷新用量', refreshing: '正在刷新…', switchModel: '预览下一个 Codex 账号', confirmModel: '确认切换模型', switchingModel: '正在切换模型…', switchFailed: '模型切换失败',
        capinfoToday: '今日费用与 Token', capinfoAmount: '今日费用', capinfoTokens: '今日 Token', capinfoUnitCost: '单位成本', capinfoMissing: 'Capinfo 用量服务未启用或不可用', keyRequired: '未配置 API 密钥',
        apiBalance: 'DeepSeek API 所属账户余额', apiKeyRejected: 'API 密钥无效或无查询权限', apiConfiguration: '请检查 DeepSeek API 提供商设置', apiQueryFailed: 'API 余额暂不可用，请稍后重试',
        apiUnsupported: '自定义 API 地址不支持官方余额查询',
        kimiUnsupported: '自定义 Kimi 地址不支持官方用量查询', kimiConfiguration: '请检查 Kimi Coding 提供商设置', kimiQueryFailed: 'Kimi Coding 用量暂不可用，请稍后重试',
        details: '用量详情', model: '当前模型', account: '当前账号', total: '账户总余额', recharge: '充值余额', bonus: '赠金余额', fiveHour: '5 小时限额', sevenDay: '7 天限额', quota: '限额', resetAt: '重置时间', updatedAt: '数据更新时间', refreshIn: '刷新时间', countdown: '{days} 天 {hours} 小时 {minutes} 分', unknownTime: '暂未提供', remainingValue: '剩余 {value}%',
        label: '账户用量', loading: '读取中…', failed: '用量暂不可用', signedOut: '未登录', empty: '暂无额度数据', remaining: '剩余', active: '当前账号', due: '等待重置', balance: '账户余额（充值 + 赠送）', unsupported: '此路由不使用 DSH 账户余额',
        resetCards: '重置卡', resetCard: 'Codex 限额重置卡', noResetCards: '暂无可用的重置卡', resetCardsFailed: '暂时无法读取重置卡。',
        expiresAt: '过期时间', noExpiration: '无到期时间', useResetCard: '使用', confirmUseResetCard: '确认使用', usingResetCard: '正在使用…', cancelUseResetCard: '取消', retryResetCards: '重试',
        resetCardWarning: '使用这张一次性重置卡，为上方账号重置符合条件的 Codex 限额？此操作不可撤销。',
        resetCardUsed: '已使用重置卡，正在刷新限额。', resetCardNothing: '当前无需重置，未消耗重置卡。', resetCardUnavailable: '此重置卡已不可用。',
        resetCardUseUnknown: '暂无法确认结果，请查看刷新后的列表再决定是否重试。', resetCardAccountChanged: '当前账号已变更，请重新打开用量详情后再使用。',
      },
    };
    const styles = `
.dshUsage{order:1;display:inline-flex;align-items:center;flex:0 1 auto;flex-wrap:nowrap;gap:14px;min-width:0;max-width:40%;overflow:hidden;white-space:nowrap;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:20px;font-variant-numeric:tabular-nums;background:transparent;border:0;border-radius:6px;padding:1px 8px;min-height:24px;box-sizing:border-box;cursor:pointer;text-align:start;transition:background-color .12s,color .12s}
.dshUsage:hover,.dshUsage[aria-expanded=true]{background:color-mix(in srgb,var(--dsw-alias-label-primary) 7%,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary)}
.dshUsage:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.dshUsagePopover{position:fixed;z-index:1200;box-sizing:border-box;width:min(360px,calc(100vw - 24px));height:auto;max-height:calc(100dvh - 24px);overflow:auto;padding:16px;border:0;border-radius:var(--dsw-radius-lg);background:var(--dsw-specific-menu);backdrop-filter:var(--dsw-menu-backdrop-filter);--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);box-shadow:var(--dsw-elevation-prominent);font-family:inherit;font-size:12px;line-height:18px;font-variant-numeric:tabular-nums;text-align:start;outline:none}
.dshUsageHeader{display:flex;align-items:center;gap:6px;color:var(--dsw-alias-label-primary);font-size:12px;line-height:18px;font-weight:500;padding-bottom:8px;margin-bottom:10px;border-bottom:.5px solid var(--dsw-alias-border-l2)}
.dshUsageHeader>svg{flex:none;width:14px;height:14px}
.dshUsageSummary{font-weight:500;white-space:nowrap}
.dshUsageProvider{margin-inline-start:auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshUsageAccountAction{display:inline-flex;align-items:center;justify-content:center;flex:none;width:18px;height:18px;padding:0;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;line-height:18px;cursor:pointer}
.dshUsageAccountAction:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-label-primary) 7%,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary)}
.dshUsageAccountAction:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.dshUsageAccountAction:disabled{cursor:wait;opacity:.5}
.dshUsageActionError{font-size:12px;color:var(--dsw-alias-state-error-primary);margin:0 0 8px;overflow-wrap:anywhere}
.dshUsageDetailRow{display:flex;justify-content:space-between;align-items:baseline;gap:16px;padding:0}
.dshUsageDetailRow+.dshUsageDetailRow{margin-top:6px}
.dshUsageAccountDetails{padding-top:6px}
.dshUsageDetailLabel{color:var(--dsw-alias-label-secondary);flex:none}
.dshUsageDetailValue{color:var(--dsw-alias-label-primary);text-align:end;overflow-wrap:anywhere;min-width:0}
.dshUsageQuotaBlock{padding:8px 0}
.dshUsageQuotaBlock+.dshUsageQuotaBlock,.dshUsageAccountDetails .dshUsageQuotaBlock{border-top:.5px solid var(--dsw-alias-border-l2)}
.dshUsageAccountDetails .dshUsageQuotaBlock{margin-top:8px}
.dshUsageAccountDetails .dshUsageQuotaBlock+.dshUsageQuotaBlock{margin-top:0}
.dshUsageCards{border-top:.5px solid var(--dsw-alias-border-l2);padding:8px 0}
.dshUsageCard{display:grid;gap:2px;padding:4px 0;overflow-wrap:anywhere}
.dshUsageCard+.dshUsageCard{border-top:.5px solid var(--dsw-alias-border-l2)}
.dshUsageCardTitle{color:var(--dsw-alias-label-primary);font-weight:500;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshUsageCardSubtitle{display:flex;align-items:baseline;justify-content:space-between;gap:8px;color:var(--dsw-alias-label-secondary)}
.dshUsageCardExpiry{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshUsageVisuallyHidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.dshUsageCardActions{display:flex;gap:8px;margin-inline-start:auto;white-space:nowrap}
.dshUsageCardButton{font:inherit;color:var(--dsw-alias-brand-primary);background:none;border:0;padding:0;cursor:pointer}
.dshUsageCardButton:hover:not(:disabled){text-decoration:underline}
.dshUsageCardButton:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.dshUsageCardButton:disabled{color:var(--dsw-alias-label-secondary);cursor:default}
.dshUsageQuotaName{color:var(--dsw-alias-label-primary);font-weight:500}
.dshUsageDetailNote{font-size:12px;color:var(--dsw-alias-label-secondary);opacity:.85;overflow-wrap:anywhere}
.dshUsageUpdated{border-top:.5px solid var(--dsw-alias-border-l2);margin-top:8px;padding-top:10px;font-size:12px}
.dshUsageQuotaBlock+.dshUsageUpdated{margin-top:0}
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
      if (result?.ok !== true) throw Object.assign(new Error(result?.error?.message || 'Usage read failed'), { code: result?.error?.code });
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
          const queryFailed = kind === 'kimi-coding' ? 'kimiQueryFailed' : 'apiQueryFailed';
          if (!response.ok) throw new Error(['deepseek-api', 'kimi-coding'].includes(kind) ? t(queryFailed) : 'Usage query failed');
          const result = await response.json();
          if (['deepseek-api', 'kimi-coding'].includes(kind) && result?.ok !== true) {
            const code = result?.error?.code;
            throw Object.assign(new Error(t({
              'usage/auth-required': 'apiKeyRejected', 'usage/configuration': kind === 'kimi-coding' ? 'kimiConfiguration' : 'apiConfiguration',
            }[code] || queryFailed)), { code });
          }
          return unwrap(result);
        }
        const stores = new Map();
        function storeFor(kind, provider, model) {
          const key = JSON.stringify([kind, provider, model]);
          if (!stores.has(key)) stores.set(key, createUsageStore(
            (signal, options) => readHostUsage(kind, provider, model, signal, options),
            { visible, cachedFirst: kind === 'codex', onError: () => console.error(`[dsh-usage] ${kind} query failed`) }));
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
        // Preserve the operation ID on uncertain retries, even if the panel was closed.
        const resetRequests = new Map();
        const resetActivity = new Map();
        const resetListeners = new Set();
        let resetResultRevision = 0;
        const subscribeReset = listener => { resetListeners.add(listener); return () => resetListeners.delete(listener); };
        function publishReset(provider, next) {
          resetActivity.delete(provider);
          if (next) resetActivity.set(provider, next);
          for (const listener of resetListeners) listener();
        }
        function newResetRequestId() {
          // randomUUID is unavailable on non-secure browser origins; getRandomValues is not.
          if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
          const bytes = crypto.getRandomValues(new Uint8Array(16));
          bytes[6] = (bytes[6] & 0x0f) | 0x40;
          bytes[8] = (bytes[8] & 0x3f) | 0x80;
          const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
          return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
        }
        async function resetCardsRequest(path, body, signal) {
          const response = await fetch(`/api/plugins/usage/codex-reset-cards${path}`, {
            method: 'POST', credentials: 'same-origin', cache: 'no-store', signal,
            headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
          });
          const result = await response.json();
          if (!response.ok || result?.ok !== true) {
            throw Object.assign(new Error('Codex reset card request failed'), { code: result?.error?.code });
          }
          return result.value;
        }
        const detailError = error => Object.hasOwn(dictionaries.en, error) ? t(error) : error;
        function DetailRow({ label, children }) {
          return h('div', { className: 'dshUsageDetailRow' }, h('span', { className: 'dshUsageDetailLabel' }, label), h('span', { className: 'dshUsageDetailValue' }, children));
        }
        function CodexResetCards({ provider, refreshRevision, canUse, isCurrent, onRedeemed, now }) {
          const [list, setList] = React.useState({ status: 'loading' });
          const [reload, setReload] = React.useState(0);
          const [confirmation, setConfirmation] = React.useState(null);
          const [feedback, setFeedback] = React.useState(null);
          const activity = React.useSyncExternalStore(subscribeReset, () => resetActivity.get(provider));
          const busy = activity?.busy === true;
          const heading = React.useRef(null);
          const cancelButton = React.useRef(null);
          const useButtons = React.useRef(new Map());
          const returnFocus = React.useRef(null);
          const requestRevision = `${refreshRevision}:${reload}:${activity?.resultId ?? ''}`;
          const fresh = list.revision === requestRevision && list.status === 'ready';
          const resultMessage = activity?.busy ? 'usingResetCard' :
            (fresh && list.accountRevision === activity?.accountRevision) || activity?.message === 'resetCardAccountChanged' ? activity?.message : null;
          React.useEffect(() => {
            const controller = new AbortController();
            resetCardsRequest('', { provider, force: refreshRevision > 0 || reload > 0 || !!activity?.resultId }, controller.signal).then(value => {
              if (!controller.signal.aborted) setList({ ...value, status: 'ready', revision: requestRevision });
            }).catch(() => {
              if (!controller.signal.aborted) setList({ status: 'failed', revision: requestRevision });
            });
            return () => controller.abort();
          }, [provider, refreshRevision, reload, requestRevision]);
          const cards = fresh ? list.cards.filter(card => card.expiresAt === null || card.expiresAt > now) : [];
          const armed = canUse && confirmation?.revision === requestRevision ? confirmation : null;
          const armedAvailable = !!armed && cards.some(card => card.id === armed.id);
          React.useLayoutEffect(() => {
            if (armedAvailable) cancelButton.current?.focus();
            else if (returnFocus.current) {
              (useButtons.current.get(returnFocus.current) || heading.current)?.focus();
              returnFocus.current = null;
            }
          }, [armedAvailable]);
          React.useEffect(() => {
            if (confirmation && !armedAvailable && !busy) {
              if (armed && fresh) setFeedback('resetCardUnavailable');
              setConfirmation(null);
            }
          }, [confirmation, armedAvailable, armed, fresh, busy]);
          const focusHeading = () => {
            if (heading.current && (document.activeElement === document.body || heading.current.parentElement.contains(document.activeElement))) heading.current.focus();
          };
          const redeem = async card => {
            if (!canUse || !fresh || resetActivity.get(provider)?.busy || armed?.id !== card.id || !isCurrent()) return;
            if (card.expiresAt !== null && card.expiresAt <= Date.now()) {
              focusHeading(); setConfirmation(null); setFeedback('resetCardUnavailable'); setReload(value => value + 1);
              return;
            }
            const key = JSON.stringify([provider, list.accountRevision, card.id]);
            publishReset(provider, { busy: true, resultId: activity?.resultId });
            setFeedback(null);
            let message;
            try {
              let requestId = resetRequests.get(key);
              if (!requestId) {
                requestId = newResetRequestId();
                resetRequests.set(key, requestId);
                if (resetRequests.size > 256) resetRequests.delete(resetRequests.keys().next().value);
              }
              const result = await resetCardsRequest('/use', { provider, creditId: card.id, requestId, accountRevision: list.accountRevision });
              message = new Map([['reset', 'resetCardUsed'], ['already_redeemed', 'resetCardUsed'], ['nothing_to_reset', 'resetCardNothing'], ['no_credit', 'resetCardUnavailable']]).get(result.code);
              if (!message) throw new Error('Unexpected reset card result');
              resetRequests.delete(key);
              if (message === 'resetCardUsed') onRedeemed();
            } catch (error) {
              message = error?.code === 'usage/identity-changed' ? 'resetCardAccountChanged' : 'resetCardUseUnknown';
            } finally {
              focusHeading();
              publishReset(provider, { accountRevision: list.accountRevision, message, resultId: ++resetResultRevision });
            }
          };
          const date = milliseconds => formatUsageDate(milliseconds, locale.getSnapshot().active) || t('unknownTime');
          const titleId = React.useId();
          return h('section', { className: 'dshUsageCards', 'aria-labelledby': titleId },
            h('div', { id: titleId, className: 'dshUsageQuotaName', role: 'heading', 'aria-level': 3, tabIndex: -1, ref: heading }, t('resetCards')),
            (feedback || resultMessage) && h('div', { className: 'dshUsageDetailNote', role: 'status' }, t(feedback || resultMessage)),
            list.revision === requestRevision && list.status === 'failed' ? h('div', { className: 'dshUsageDetailRow' },
              h('span', { className: 'dshUsageDetailNote', role: 'status' }, t('resetCardsFailed')),
              h('button', { type: 'button', className: 'dshUsageCardButton', onClick: () => { heading.current?.focus(); setReload(value => value + 1); } }, t('retryResetCards')))
              : !fresh ? h('div', { className: 'dshUsageDetailNote', role: 'status' }, t('loading'))
                : !cards.length ? h('div', { className: 'dshUsageDetailNote' }, t('noResetCards')) : null,
            cards.map(card => {
              const confirming = armed?.id === card.id;
              const title = card.title || t('resetCard');
              const expiry = card.expiresAt === null ? t('noExpiration') : date(card.expiresAt);
              return h('div', { key: card.id, className: 'dshUsageCard' },
                h('div', { className: 'dshUsageCardTitle', title }, title),
                h('div', { className: 'dshUsageCardSubtitle' },
                  h('span', { className: 'dshUsageCardExpiry', title: expiry },
                    card.expiresAt !== null && h('span', { className: 'dshUsageVisuallyHidden' }, `${t('expiresAt')}: `), expiry),
                  canUse && h('div', { className: 'dshUsageCardActions' }, confirming ? [
                  h('button', { key: 'cancel', type: 'button', className: 'dshUsageCardButton', disabled: busy,
                    ref: cancelButton, 'aria-describedby': `${titleId}-warning`, onClick: () => setConfirmation(null) }, t('cancelUseResetCard')),
                  h('button', { key: 'confirm', type: 'button', className: 'dshUsageCardButton', disabled: busy,
                    'aria-describedby': `${titleId}-warning`, onClick: () => void redeem(card) }, t(busy ? 'usingResetCard' : 'confirmUseResetCard')),
                ] : h('button', { type: 'button', className: 'dshUsageCardButton', disabled: busy || armedAvailable,
                  ref: node => { if (node) useButtons.current.set(card.id, node); else useButtons.current.delete(card.id); },
                  'aria-label': `${t('useResetCard')} · ${title}`, onClick: () => { setFeedback(null); returnFocus.current = card.id; setConfirmation({ id: card.id, revision: requestRevision }); } }, t('useResetCard')))),
                confirming && h('div', { className: 'dshUsageDetailNote', id: `${titleId}-warning` }, t('resetCardWarning')));
            }));
        }
        function UsageDetails({ snapshot, kind, model, modelName, now, resetCards }) {
          // The same dsh-capinfo snapshot drives the dock and this panel.
          if (kind === 'capinfo') {
            const today = capinfoTodayView(snapshot);
            const modelRow = h(DetailRow, { label: t('model') }, modelName || model);
            if (today.reason) return h(React.Fragment, null, modelRow,
              h('div', { className: 'dshUsageDetailNote' }, t(today.reason)),
              h('div', { className: 'dshUsageUpdated' }, h(DetailRow, { label: t('updatedAt') }, '--')));
            return h(React.Fragment, null, modelRow,
              h(DetailRow, { label: t('capinfoAmount') }, today.amount),
              h(DetailRow, { label: t('capinfoTokens') }, today.tokens),
              h(DetailRow, { label: t('capinfoUnitCost') }, formatCapinfoUnitCost(snapshot.value.data)),
              h('div', { className: 'dshUsageUpdated' }, h(DetailRow, { label: t('updatedAt') },
                today.refreshedAt ? formatUsageDate(today.refreshedAt, locale.getSnapshot().active) || '--' : '--')));
          }
          if (snapshot.status !== 'ready') return h(React.Fragment, null,
            h('div', { className: 'dshUsageDetailNote' }, t(snapshot.status === 'failed' ? 'failed' : 'loading'), snapshot.error ? ` · ${detailError(snapshot.error)}` : ''),
            resetCards);
          const value = snapshot.value;
          if (value.signedOut || value.unconfigured || value.unsupported) return h('div', { className: 'dshUsageDetailNote' },
             t(value.unconfigured ? 'keyRequired' : value.unsupported ? (kind === 'kimi-coding' ? 'kimiUnsupported' : 'apiUnsupported') : 'signedOut'));
          const date = milliseconds => formatUsageDate(milliseconds, locale.getSnapshot().active) || t('unknownTime');
          const countdown = resetsAt => {
            const parts = resetCountdown(resetsAt, now);
            if (parts === null) return t('unknownTime');
            if (parts === 'due') return t('due');
            return t('countdown').replace('{days}', parts.days).replace('{hours}', parts.hours).replace('{minutes}', parts.minutes);
          };
          const amount = wallets => wallets?.length ? wallets.map(formatWalletAmount).join(' · ') : '—';
          const modelRow = h(DetailRow, { label: t('model') }, modelName || model);
          if (kind === 'kimi-coding') return h(React.Fragment, null, modelRow,
            value.windows.length ? value.windows.map((w, index) => h('div', { className: 'dshUsageQuotaBlock', key: index },
              h('div', { className: 'dshUsageDetailRow' },
                h('span', { className: 'dshUsageQuotaName' }, windowLabel(w.windowSeconds) === '5h' ? t('fiveHour') : windowLabel(w.windowSeconds) === '7day' ? t('sevenDay') : `${windowLabel(w.windowSeconds)} ${t('quota')}`),
                h('span', { className: w.remainingPercent <= 20 ? 'dshUsageLow' : 'dshUsageQuotaName' }, t('remainingValue').replace('{value}', Math.round(w.remainingPercent)))),
              h(DetailRow, { label: t('refreshIn') }, countdown(w.resetsAt)),
              h(DetailRow, { label: t('resetAt') }, date(w.resetsAt === null ? null : w.resetsAt * 1000)))) : h('div', { className: 'dshUsageDetailNote' }, t('empty')),
            h('div', { className: 'dshUsageUpdated' }, h(DetailRow, { label: t('updatedAt') }, date(value.updatedAt))));
          if (kind === 'deepseek' || kind === 'deepseek-api') return h(React.Fragment, null, modelRow,
            value.totals?.length > 0 && h(DetailRow, { label: t('total') }, amount(value.totals)),
            value.recharge?.length > 0 && h(DetailRow, { label: t('recharge') }, amount(value.recharge)),
            value.bonus?.length > 0 && h(DetailRow, { label: t('bonus') }, amount(value.bonus)),
            !value.totals?.length && !value.recharge?.length && !value.bonus?.length && h('div', { className: 'dshUsageDetailNote' }, t('empty')),
            h('div', { className: 'dshUsageUpdated' }, h(DetailRow, { label: t('updatedAt') }, date(value.updatedAt))));
          return h(React.Fragment, null, modelRow,
            value.rows.length ? value.rows.map(account => h('div', { className: 'dshUsageAccountDetails', key: account.id },
              h(DetailRow, { label: t('account') }, account.label),
              account.failed && h('div', { className: 'dshUsageActionError' }, `${t('failed')} · ${account.error || t('empty')}`),
              account.email && h('div', { className: 'dshUsageDetailNote' }, account.email),
              quotaWindows(account.usage, model).map(w => h('div', { className: 'dshUsageQuotaBlock', key: w.windowSeconds },
                h('div', { className: 'dshUsageDetailRow' },
                  h('span', { className: 'dshUsageQuotaName' }, windowLabel(w.windowSeconds) === '5h' ? t('fiveHour') : windowLabel(w.windowSeconds) === '7day' ? t('sevenDay') : `${windowLabel(w.windowSeconds)} ${t('quota')}`),
                  h('span', { className: w.remainingPercent <= 20 ? 'dshUsageLow' : 'dshUsageQuotaName' }, t('remainingValue').replace('{value}', Math.round(w.remainingPercent)))),
                h(DetailRow, { label: t('refreshIn') }, countdown(w.resetsAt)),
                h(DetailRow, { label: t('resetAt') }, date(w.resetsAt === null ? null : w.resetsAt * 1000)))),
              !quotaWindows(account.usage, model).length && h('div', { className: 'dshUsageDetailNote' }, t('empty')))) : h('div', null, t('empty')),
            resetCards,
            value.rows.length > 0 && h('div', { className: 'dshUsageUpdated' }, h(DetailRow, { label: t('updatedAt') }, date(value.rows[0].usage?.fetchedAt))));
        }
        function UsageValue({ kind, provider, model, modelName, providerName, selectionRevision, controller, directoryState }) {
          const performanceUsage = React.useSyncExternalStore(subscribePerformanceUsage, getPerformanceUsage, getPerformanceUsage);
          const store = storeFor(kind, provider, model);
          const snapshot = React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
          const [now, setNow] = React.useState(Date.now);
          const [open, setOpen] = React.useState(false);
          const [refreshing, setRefreshing] = React.useState(false);
          const [cardRefreshRevision, setCardRefreshRevision] = React.useState(0);
          const [preview, setPreview] = React.useState(null);
          const [previewHeight, setPreviewHeight] = React.useState(0);
          const [switching, setSwitching] = React.useState(false);
          const [switchError, setSwitchError] = React.useState(null);
          const openRevision = React.useRef(0);
          const choices = kind === 'codex' ? codexModelChoices(directoryState.groups, model) : [];
          const selectedPreview = open && choices.find(choice => sameUsageModel(choice, preview));
          const detailModel = selectedPreview || { provider, model, modelName, providerName };
          const detailStore = storeFor(kind, detailModel.provider, detailModel.model);
          const detailSnapshot = React.useSyncExternalStore(detailStore.subscribe, detailStore.getSnapshot, detailStore.getSnapshot);
          const changed = !!selectedPreview && !sameUsageModel(selectedPreview, { provider, model });
          const selectionLocked = switching || directoryState.status === 'selecting' || !!directoryState.pending;
          const previewNext = () => {
            setPreviewHeight(panelRef.current?.getBoundingClientRect().height || 0);
            setPreview(nextUsageModel(choices, detailModel));
            setSwitchError(null);
          };
          const confirmModel = async () => {
            if (!changed || selectionLocked) return;
            // Revalidate against the live catalog immediately before submitting.
            const latest = controller.store.getSnapshot();
            const target = codexModelChoices(latest.groups, latest.current?.model).find(choice => sameUsageModel(choice, selectedPreview));
            if (!target || latest.pending || latest.status === 'selecting') return;
            const revision = openRevision.current;
            setSwitching(true); setSwitchError(null);
            try {
              unwrap(await controller.select({ provider: target.provider, model: target.model }));
              if (mountedRef.current && revision === openRevision.current) { setPreview(null); setOpen(false); triggerRef.current?.focus(); }
            } catch (error) {
              if (mountedRef.current && revision === openRevision.current) setSwitchError(error?.message || t('switchFailed'));
            } finally { if (mountedRef.current) setSwitching(false); }
          };
          const mountedRef = React.useRef(false);
          const previousRevision = React.useRef(selectionRevision);
          React.useEffect(() => {
            if (previousRevision.current !== selectionRevision) {
              if (kind === 'codex') store.refresh({ force: true, reason: 'selection' });
              else store.invalidate();
            }
            previousRevision.current = selectionRevision;
          }, [store, selectionRevision, kind]);
          const refresh = async () => {
            if (refreshing) return;
            setRefreshing(true);
            if (kind === 'codex') setCardRefreshRevision(value => value + 1);
            try { await detailStore.refresh({ force: true, reason: 'manual' }); }
            finally { if (mountedRef.current) { setRefreshing(false); setNow(Date.now()); } }
          };
          const [position, setPosition] = React.useState(null);
          const triggerRef = React.useRef(null), panelRef = React.useRef(null);
          const id = React.useId();
          const providerTitle = usageProviderTitle(kind, providerName);
          const detailProviderTitle = usageProviderTitle(kind, detailModel.providerName);
          const close = restoreFocus => { openRevision.current++; setOpen(false); setPreview(null); setSwitchError(null); if (restoreFocus) triggerRef.current?.focus(); };
          React.useEffect(() => { setOpen(false); setPosition(null); setPreview(null); setSwitchError(null); }, [kind, provider, model]);
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
            if (kind !== 'codex' && kind !== 'capinfo' && kind !== 'kimi-coding') return;
            const timer = setInterval(() => setNow(Date.now()), 15000);
            return () => clearInterval(timer);
          }, [kind]);
          // Keep the subscription alive so enabling dsh-capinfo can reveal the
          // entry on the next read. Hide both the trigger and any open portal
          // while discovery is pending or the optional service is absent.
          // This guard must stay after all hooks.
          if (kind === 'capinfo' && (snapshot.status === 'loading' ||
            (snapshot.status === 'ready' && snapshot.value?.status === 'missing'))) return null;
          let content;
          // Only today's cost and token count, separated by a middle dot.
          if (kind === 'capinfo') content = h('span', { title: t('capinfoToday') },
            capinfoTodayView(snapshot).summary);
          else if (snapshot.status !== 'ready') content = h('span', { className: snapshot.status === 'failed' ? 'dshUsageError' : undefined, title: snapshot.error },
            `${kind} ${t(snapshot.status === 'failed' ? 'failed' : 'loading')}`,
            snapshot.status === 'failed' && snapshot.error && h('span', { className: 'dshUsageReason' }, `（${snapshot.error.slice(0, 48)}）`));
          else if (snapshot.value.signedOut) content = h('span', null, `${kind} ${t('signedOut')}`);
          else if (snapshot.value.unconfigured || snapshot.value.unsupported) content = h('span', null, t(snapshot.value.unconfigured ? 'keyRequired' : kind === 'kimi-coding' ? 'kimiUnsupported' : 'apiUnsupported'));
          else if (kind === 'deepseek' || kind === 'deepseek-api') content = h('span', { title: t(kind === 'deepseek-api' ? 'apiBalance' : 'balance') },
            snapshot.value.totals.map(formatWalletAmount).join(' · ') ||
            ['recharge', 'bonus'].flatMap(key => snapshot.value[key]?.length ? [`${t(key)} ${snapshot.value[key].map(formatWalletAmount).join(' · ')}`] : []).join(' · ') ||
            t('empty'));
          else if (kind === 'kimi-coding') {
            const windows = snapshot.value.windows.filter(w => performanceUsage !== 'compact' || windowLabel(w.windowSeconds) !== '7day');
            content = windows.length ? windows.map((w, index) => {
              const duration = resetDuration(w.resetsAt, now);
              return h('span', { className: `dshUsageWindow${w.remainingPercent <= 20 ? ' dshUsageLow' : ''}`, key: index, title: t('remaining') },
                h('span', null, `${windowLabel(w.windowSeconds)} ${Math.round(w.remainingPercent)}%`),
                duration && h('span', { className: 'dshUsageReset' }, `↻ ${duration === 'due' ? t('due') : duration}`));
            }) : h('span', null, t('empty'));
          }
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
              onClick: () => {
                openRevision.current++; setPosition(null); setPreview(null); setPreviewHeight(0); setSwitchError(null);
                const next = !open;
                setOpen(next);
                // Opening the Capinfo panel re-reads the live dsh-capinfo snapshot.
                if (next && kind === 'capinfo') void detailStore.refresh({ force: true, reason: 'open' });
              },
            }, h('span', { className: 'dshUsageContent' }, content)),
            // DSH 0.2.2 contains the docked composer. Keep viewport-positioned
            // details outside that containing block; React still owns cleanup.
            open && createPortal(h('div', {
              id, ref: panelRef, role: 'dialog', tabIndex: -1,
              'aria-labelledby': `${id}-title`, className: 'dshUsagePopover',
              style: { left: position?.left ?? 12, top: position?.top ?? 12,
                 minHeight: previewHeight ? `min(${previewHeight}px, calc(100dvh - 24px))` : undefined },
            },
              h('div', { className: 'dshUsageHeader' },
                h('svg', { viewBox: '0 0 20 20', width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, 'aria-hidden': true },
                  h('ellipse', { cx: 10, cy: 4, rx: 6, ry: 2.5 }),
                  h('path', { d: 'M4 4v11c0 3.3 12 3.3 12 0V4M4 9c0 3.3 12 3.3 12 0' })),
                h('span', { id: `${id}-title`, className: 'dshUsageSummary' }, t('details')),
                h('span', { className: 'dshUsageProvider' }, detailProviderTitle),
                h('button', {
                   type: 'button', className: 'dshUsageAccountAction', onClick: refresh, disabled: refreshing,
                   title: t(refreshing ? 'refreshing' : 'refresh'), 'aria-label': t(refreshing ? 'refreshing' : 'refresh'),
                 }, '↻'),
                 choices.length > 0 && h('button', {
                   type: 'button', className: 'dshUsageAccountAction', onClick: previewNext, disabled: selectionLocked,
                   title: t('switchModel'), 'aria-label': t('switchModel'),
                 }, '→'),
                 changed && h('button', {
                   type: 'button', className: 'dshUsageAccountAction', onClick: confirmModel, disabled: selectionLocked,
                   title: t(switching ? 'switchingModel' : 'confirmModel'), 'aria-label': t(switching ? 'switchingModel' : 'confirmModel'),
                 }, '✓')),
              switchError && h('div', { className: 'dshUsageActionError', role: 'alert' }, switchError),
              kind === 'codex' && (detailSnapshot.status !== 'ready' || detailSnapshot.value.signedOut) && h(React.Fragment, null,
                h(DetailRow, { label: t('model') }, detailModel.modelName || detailModel.model),
                h(DetailRow, { label: t('account') }, detailModel.providerName || detailModel.provider)),
              h(UsageDetails, { snapshot: detailSnapshot, kind, model: detailModel.model, modelName: detailModel.modelName, now,
                resetCards: kind === 'codex' && h(CodexResetCards, {
                  key: detailModel.provider, provider: detailModel.provider, refreshRevision: cardRefreshRevision, now,
                  canUse: !changed && !selectionLocked,
                  isCurrent: () => {
                    const latest = controller.store.getSnapshot();
                    return !latest.pending && latest.status !== 'selecting' && sameUsageModel(latest.current, detailModel);
                  },
                  onRedeemed: () => {
                    for (const [key, target] of stores) {
                      const [route, accountProvider] = JSON.parse(key);
                      if (route === 'codex' && accountProvider === detailModel.provider) target.invalidate();
                    }
                  },
                }),
              })), document.body));


        }
        function Usage({ controller }) {
          const directory = controller.store;
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
          return kind ? h(UsageValue, { kind, provider: current.provider, model: current.model, modelName, providerName: group?.name, selectionRevision, controller, directoryState: state }) : null;
        }
        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock', id: 'dsh-usage', order: 20,
          label: () => t('label'),
          inject: sessionId => ({ controller: directories.directoryFor(sessionId) }),
        }, Usage));
      },
    };
  },
});
