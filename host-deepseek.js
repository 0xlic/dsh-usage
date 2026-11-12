import {UsageError} from './host-cache.js';
import {fingerprint} from './host-codex.js';
import {walletTotals} from './logic.js';
export class DeepSeekUsageAdapter {
  constructor({account, cache, now = Date.now}) { Object.assign(this, {account, cache, now}); }
  async identity() {
    const session = await this.account?.getPlatformSession();
    return session ? fingerprint([session.origin, session.token, session.userId]) : null;
  }
  async read({force = false, client}) {
    const identity = await this.identity();
    if (!identity) { this.cache.invalidate('deepseek'); return {signedOut: true}; }
    return this.cache.read('deepseek', {identity, force, isCurrent: async () => await this.identity() === identity,
      load: async () => {
        const balance = await this.account.getBalance(client);
        if (!balance) throw new UsageError('usage/identity-changed', 'Account credentials changed. Retry the usage query.');
        if (balance.status !== 'ready') throw new UsageError();
        const project = wallets => wallets.filter(row => ['CNY', 'USD'].includes(row.currency)
          && typeof row.balance === 'string' && /^-?\d+(\.\d+)?$/.test(row.balance) && row.balance.length <= 128)
          .map(({currency, balance}) => ({currency, balance}));
        const recharge = project(balance.value ?? []), bonus = project(balance.bonusWallets ?? []);
        return {totals: walletTotals({status: 'ready', value: recharge, bonusWallets: bonus}),
          recharge: walletTotals({status: 'ready', value: recharge}), bonus: walletTotals({status: 'ready', value: bonus}), updatedAt: this.now()};
      }});
  }
  dispose() {}
}
