import assert from 'node:assert/strict';
import { describe, expect, it } from 'vitest';
import { createApp } from '../apps/reference-server/src/index.js';
import { agentPayDemoState } from '../apps/reference-server/src/agentpay.js';
import { sha256Digest } from '../apps/reference-server/src/protocol_digests.js';
import { AgentPayPurchaseService } from '../apps/reference-server/src/purchase_service.js';
import { invokeZhipu } from '../apps/reference-server/src/providers/zhipu.js';

async function serverForRecorded() {
  process.env.AGENTPAY_RECORDED = '1';
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  return server;
}

describe('server-side procurement controls', () => {
  it('blocks an unaffordable reservation before payment authorization', async () => {
    const server = await serverForRecorded();
    try {
      const base = `http://127.0.0.1:${server.address().port}`;
      const offer = agentPayDemoState().offers.find((item) => item.fulfillment === 'machine');
      const request = { prompt: 'must not be purchased' };
      const requestDigest = sha256Digest({ inputTokens: 64, outputCap: 64, offerId: offer.offerId, body: request });
      const response = await fetch(`${base}/api/agentpay/v1/policies/blocked-policy/reservations`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ purchaseId: '550e8400-e29b-41d4-a716-446655440001', offerId: offer.offerId, request, inputTokens: 64, outputCap: 64, requestDigest, policy: { policyId: 'blocked-policy', maxTotalAtomic: '1', maxPerRequestAtomic: '1', validUntil: Math.floor(Date.now() / 1000) + 60 } }),
      });
      assert.equal(response.status, 403);
      assert.equal((await response.json()).code, 'price_exceeds_policy');
    } finally { await new Promise((resolve) => server.close(resolve)); }
  });

  it('rejects an expired policy before reserving budget', async () => {
    const server = await serverForRecorded();
    try {
      const base = `http://127.0.0.1:${server.address().port}`;
      const offer = agentPayDemoState().offers.find((item) => item.fulfillment === 'machine');
      const request = { prompt: 'expired' };
      const requestDigest = sha256Digest({ inputTokens: 64, outputCap: 64, offerId: offer.offerId, body: request });
      const response = await fetch(`${base}/api/agentpay/v1/policies/expired-policy/reservations`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ purchaseId: '550e8400-e29b-41d4-a716-446655440002', offerId: offer.offerId, request, inputTokens: 64, outputCap: 64, requestDigest, policy: { policyId: 'expired-policy', maxTotalAtomic: '100000', maxPerRequestAtomic: '100000', validUntil: Math.floor(Date.now() / 1000) - 1 } }),
      });
      assert.equal(response.status, 403);
      assert.equal((await response.json()).code, 'policy_expired');
    } finally { await new Promise((resolve) => server.close(resolve)); }
  });

  it('requires an explicit human approval when the signed policy demands it', async () => {
    const server = await serverForRecorded();
    try {
      const base = `http://127.0.0.1:${server.address().port}`;
      const offer = agentPayDemoState().offers.find((item) => item.fulfillment === 'machine');
      const request = { prompt: 'approval required' };
      const requestDigest = sha256Digest({ inputTokens: 64, outputCap: 64, offerId: offer.offerId, body: request });
      const response = await fetch(`${base}/api/agentpay/v1/policies/approval-policy/reservations`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ purchaseId: '550e8400-e29b-41d4-a716-446655440003', offerId: offer.offerId, request, inputTokens: 64, outputCap: 64, requestDigest, policy: { policyId: 'approval-policy', maxTotalAtomic: '100000', maxPerRequestAtomic: '100000', validUntil: Math.floor(Date.now() / 1000) + 60, requireHumanApproval: true } }),
      });
      assert.equal(response.status, 403);
      assert.equal((await response.json()).code, 'policy_invalid');
    } finally { await new Promise((resolve) => server.close(resolve)); }
  });

  it('prevents a Permit2 payer and nonce from being bound to two purchases', async () => {
    const service = new AgentPayPurchaseService();
    const policy = { policyId: 'nonce-policy', maxTotalAtomic: '20', maxPerRequestAtomic: '10' };
    const offer = { offerId: 'nonce-offer', network: 'eip155:10143' };
    await service.reservePolicyBudget({ purchaseId: 'nonce-one', policyId: 'nonce-policy', policy, offer, maximumAtomic: '10' });
    await service.reservePolicyBudget({ purchaseId: 'nonce-two', policyId: 'nonce-policy', policy, offer, maximumAtomic: '10' });
    await service.bindAuthorization('nonce-one', { payer: '0x0000000000000000000000000000000000000001', nonce: '7', signatureDigest: 'sha256:a' });
    await expect(service.bindAuthorization('nonce-two', { payer: '0x0000000000000000000000000000000000000001', nonce: '7', signatureDigest: 'sha256:b' })).rejects.toMatchObject({ code: 'authorization_conflict' });
  });

  it('fails closed on malformed provider output', async () => {
    await expect(invokeZhipu({ recorded: false, apiKey: 'test', prompt: 'x', fetcher: async () => new Response(JSON.stringify({ usage: { prompt_tokens: 1, completion_tokens: 1 }, choices: [{}] }), { status: 200 }) })).rejects.toMatchObject({ code: 'failed_unsettled' });
  });
});
