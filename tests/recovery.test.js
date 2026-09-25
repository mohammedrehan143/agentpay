import { describe, it, expect } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { createSIWxMessage, encodeSIWxHeader } from '@x402/extensions/sign-in-with-x';
import { AgentPayPurchaseService } from '../apps/reference-server/src/purchase_service.js';
import { purchaseService } from '../apps/reference-server/src/agentpay.js';
import { createApp } from '../apps/reference-server/src/index.js';

describe('purchase recovery challenge renewal', () => {
  it.each([false, true])('renews expired/consumed nonces with one race winner (Mongo=%s)', async mongo => {
    let now = Date.now();
    const memory = new AgentPayPurchaseService({ clock: () => now });
    await memory.reservePolicyBudget({ purchaseId:'renew', policyId:'renew-policy', policy:{maxTotalAtomic:'1'}, offer:{offerId:'offer'}, maximumAtomic:'1' });
    const record = memory.memory.get('renew');
    const original = record.accessNonce;
    const collection = {
      findOne: async () => structuredClone(record),
      updateOne: async (filter, update) => {
        const matches = Object.entries(filter).every(([key,value]) => value && typeof value === 'object' && !(value instanceof Date)
          ? ('$ne' in value ? record[key] !== value.$ne : new Date(record[key]).getTime() > value.$gt.getTime())
          : String(record[key]) === String(value));
        if (matches) Object.assign(record, update.$set);
        return {modifiedCount: matches ? 1 : 0};
      },
    };
    const service = mongo ? new AgentPayPurchaseService({clock: () => now, dbProvider: () => ({ collection: () => collection })}) : memory;
    now += 300001;
    const [a,b] = await Promise.all([service.ensureAccessNonce('renew'), service.ensureAccessNonce('renew')]);
    expect(a.accessNonce).toBe(b.accessNonce);
    expect(a.accessNonce).not.toBe(original);
    expect(new Date(a.accessNonceExpiresAt).getTime()).toBe(now + 300000);
    expect(await service.consumeAccessNonce('renew', original)).toBe(false);
    expect(await service.consumeAccessNonce('renew', a.accessNonce)).toBe(true);
    expect(await service.consumeAccessNonce('renew', a.accessNonce)).toBe(false);
    const fresh = await service.ensureAccessNonce('renew');
    expect(fresh.accessNonce).not.toBe(a.accessNonce);
    expect(record.state).toBe('reserved');
    expect(record.events).toHaveLength(1);
  });

  it('recovers an expired legacy reservation with its policy wallet; rejects wrong wallet, path and replay', async () => {
    const account = privateKeyToAccount('0x' + '11'.repeat(32));
    const wrong = privateKeyToAccount('0x' + '22'.repeat(32));
    const id = 'legacy-recovery-test';
    const policy = {policyId:id,agentWallet:account.address,maxTotalAtomic:'1'};
    await purchaseService.reservePolicyBudget({purchaseId:id,policyId:id,policy,offer:{offerId:'offer'},maximumAtomic:'1'});
    const record = purchaseService.memory.get(id);
    record.accessNonceExpiresAt = new Date(Date.now() - 1);
    const oldNonce = record.accessNonce;
    const server = createApp().listen(0,'127.0.0.1');
    await new Promise(resolve => server.once('listening',resolve));
    const url = `http://127.0.0.1:${server.address().port}/api/agentpay/v1/purchases/${id}/reconciliation`;
    const sign = async (info, signer = account) => {
      const payload = {...info, chainId:'eip155:10143',type:'eip191',address:signer.address,signatureScheme:'eip191'};
      return encodeSIWxHeader({...payload,signature:await signer.signMessage({message:createSIWxMessage(payload,signer.address)})});
    };
    try {
      const response = await fetch(url);
      expect(response.headers.get('cache-control')).toBe('no-store');
      const info = (await response.json()).extensions['sign-in-with-x'].info;
      expect(info.nonce).not.toBe(oldNonce);
      expect(Date.parse(info.expirationTime)).toBeGreaterThan(Date.now());
      expect((await fetch(url,{headers:{'sign-in-with-x':await sign(info,wrong)}})).status).toBe(401);
      expect((await fetch(url,{headers:{'sign-in-with-x':await sign({...info,uri:url.replace('reconciliation','result')})}})).status).toBe(401);
      const header = await sign(info);
      const recovered = await fetch(url,{headers:{'sign-in-with-x':header}});
      expect(recovered.status).toBe(200);
      expect((await recovered.json()).state).toBe('reserved');
      expect((await fetch(url,{headers:{'sign-in-with-x':header}})).status).toBe(401);
      const next = (await (await fetch(url)).json()).extensions['sign-in-with-x'].info;
      expect(next.nonce).not.toBe(info.nonce);
      expect((await fetch(url,{headers:{'sign-in-with-x':await sign(next)}})).status).toBe(200);
      expect(record.state).toBe('reserved');
      expect(record.events).toHaveLength(1);
    } finally { await new Promise(resolve => server.close(resolve)); }
  });
});
