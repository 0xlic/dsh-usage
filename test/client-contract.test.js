import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = name => readFile(new URL(name, import.meta.url), 'utf8');

test('composer details use the shared React DOM portal outside the contained dock', async () => {
  // Source contract, not a browser/visual test: fixed descendants of the new
  // composer containing block must not be rendered inline in the dock.
  const source = await read('../client.source.js');
  assert.match(source, /const \{ createPortal \} = require\('react-dom'\)/);
  assert.match(source, /open && createPortal\(h\('div', \{/);
  assert.match(source, /\}\)\), document\.body\)\);/);
  assert.doesNotMatch(source, /open && h\('div', \{/);
  assert.match(source, /panel\.contains\(event\.target\)/);
  assert.match(source, /trigger\.contains\(event\.target\)/);
});

test('composer usage stays on one line and shares constrained dock space', async () => {
  // Source contract only; actual ellipsis and dock height need browser checking.
  const source = await read('../client.source.js');
  const rule = name => source.match(new RegExp(`\\.${name}\\{([^}]+)\\}`))?.[1];
  const trigger = rule('dshUsage');
  assert.match(trigger, /flex:0 1 auto;/);
  assert.match(trigger, /min-width:0;/);
  assert.match(trigger, /max-width:40%;/);
  assert.match(trigger, /flex-wrap:nowrap;/);
  assert.match(trigger, /overflow:hidden;/);
  assert.match(rule('dshUsageContent'), /text-overflow:ellipsis;/);
  assert.match(rule('dshUsageContent'), /white-space:nowrap/);
  assert.match(rule('dshUsageContent'), /min-width:0;/);
  for (const name of ['dshUsageAccount', 'dshUsageWindow']) {
    assert.match(rule(name), /display:inline;/);
    assert.match(rule(name), /white-space:nowrap/);
  }
  assert.match(source, /h\('span', \{ className: 'dshUsageContent' \}, content\)/);
  assert.doesNotMatch(trigger, /flex-wrap:wrap/);
});

test('Codex reset cards are below quotas and require confirmation for the current account', async () => {
  const source = await read('../client.source.js');
  const details = source.slice(source.indexOf('          return h(React.Fragment, null, modelRow,\n            value.rows.length'));
  assert.match(source, /\.dshUsageAccountDetails \.dshUsageQuotaBlock\{border-top:/);
  assert.match(source, /\.dshUsageCards\{border-top:/);
  assert.ok(details.indexOf('quotaWindows(account.usage, model)') < details.indexOf('\n            resetCards,'));
  assert.ok(details.indexOf('\n            resetCards,') < details.indexOf("className: 'dshUsageUpdated'"));
  assert.match(source, /armed\?\.id !== card\.id \|\| !isCurrent\(\)/);
  assert.match(source, /canUse: !changed && !selectionLocked/);
  assert.match(source, /onClick: \(\) => void redeem\(card\)/);
  assert.match(source, /resetCardsRequest\('\/use', \{ provider, creditId: card\.id, requestId, accountRevision: list\.accountRevision \}\)/);
});

test('reset cards show the title, then expiry and a borderless text action', async () => {
  const source = await read('../client.source.js');
  const cards = source.slice(source.indexOf('            cards.map(card => {'), source.indexOf('        function UsageDetails('));
  assert.match(source, /resetCards: '重置卡'/);
  assert.match(source, /\.dshUsageCardButton\{[^}]*border:0;/);
  assert.match(source, /\.dshUsageCardButton:focus-visible\{outline:/);
  assert.match(cards, /dshUsageCardTitle[^\n]*\n\s*h\('div', \{ className: 'dshUsageCardSubtitle' \}/);
  assert.match(cards, /dshUsageCardExpiry[\s\S]+dshUsageCardActions[\s\S]+useResetCard/);
  assert.doesNotMatch(cards, /card\.description|h\(DetailRow/);
});

test('all provider popover headers show provider and details text without usage values', async () => {
  const source = await read('../client.source.js');
  const header = source.slice(source.indexOf("h('div', { className: 'dshUsageHeader' }"), source.indexOf('              h(UsageDetails,'));
  assert.match(header, /h\('span', \{ id: `\$\{id\}-title`, className: 'dshUsageSummary' \}, t\('details'\)\)/);
  assert.match(header, /h\('span', \{ className: 'dshUsageProvider' \}, detailProviderTitle\)/);
  assert.ok(header.indexOf("h('svg'") < header.indexOf("className: 'dshUsageSummary'"));
  assert.ok(header.indexOf("className: 'dshUsageSummary'") < header.indexOf("className: 'dshUsageProvider'"));
  assert.ok(header.indexOf("className: 'dshUsageProvider'") < header.indexOf("h('button'"));
  assert.match(source, /\.dshUsageProvider\{margin-inline-start:auto;/);
  assert.doesNotMatch(source, /\.dshUsageSummary\{[^}]*margin-inline-start:auto/);
  assert.doesNotMatch(header, /capinfoTodayView|formatWalletAmount|snapshot|\.totals|remainingPercent/);
});

test('popover shares official ContextMeter surface and text color tokens', async () => {
  // Source contract against installed DSH 0.2.2-rc.2 ContextMeter.module.css;
  // this does not establish rendered light/dark visual parity.
  const source = await read('../client.source.js');
  const rule = name => source.match(new RegExp(`\\.${name}\\{([^}]+)\\}`))?.[1];
  const panel = rule('dshUsagePopover');
  for (const declaration of ['background:var(--dsw-specific-menu)', 'backdrop-filter:var(--dsw-menu-backdrop-filter)',
    'box-shadow:var(--dsw-elevation-prominent)', '--dsw-elevation-stroke-color:var(--dsw-alias-border-l1)',
    'border-radius:var(--dsw-radius-lg)', 'border:0']) assert.ok(panel.includes(declaration), declaration);
  assert.match(rule('dshUsageDetailLabel'), /color:var\(--dsw-alias-label-secondary\)/);
  assert.match(rule('dshUsageDetailValue'), /color:var\(--dsw-alias-label-primary\)/);
});

test('popover uses the compact official session-statistics spacing rhythm', async () => {
  const source = await read('../client.source.js');
  const rule = name => source.match(new RegExp(`\\.${name}\\{([^}]+)\\}`))?.[1];
  assert.match(rule('dshUsagePopover'), /padding:16px;/);
  assert.match(rule('dshUsagePopover'), /font-size:12px;line-height:18px;/);
  assert.match(rule('dshUsageHeader'), /font-size:12px;line-height:18px;/);
  assert.match(rule('dshUsageHeader'), /padding-bottom:8px;margin-bottom:10px;/);
  assert.match(rule('dshUsageHeader'), /border-bottom:\.5px solid var\(--dsw-alias-border-l2\)/);
  assert.match(rule('dshUsageAccountAction'), /width:18px;height:18px;/);
  assert.match(rule('dshUsageDetailRow'), /padding:0/);
  assert.ok(source.includes('.dshUsageDetailRow+.dshUsageDetailRow{margin-top:6px}'));
  assert.match(rule('dshUsageQuotaBlock'), /padding:8px 0/);
  assert.match(rule('dshUsageAccountDetails'), /padding-top:6px/);
  assert.ok(source.includes('.dshUsageQuotaBlock+.dshUsageUpdated{margin-top:0}'));
});

test('shipped client artifact matches the source and shared logic', async () => {
  const source = await read('../client.source.js');
  const logic = (await read('../logic.js')).replace(/^export /gm, '');
  const built = await read('../client.js');
  assert.equal(built, '// Generated by node build.mjs; edit client.source.js / logic.js.\n' + source.replace('/* DSH_USAGE_LOGIC */', () => logic));
});
