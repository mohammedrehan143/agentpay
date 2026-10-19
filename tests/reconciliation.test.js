import { describe, expect, it } from 'vitest';
import { AgentPayPurchaseService } from '../apps/reference-server/src/purchase_service.js';
import { reconcileClaim } from '../apps/reference-server/src/reconciliation_job.js';

async function facilitatorPurchase() {
  const service = new AgentPayPurchaseService();
  await service.reservePolicyBudget({ purchaseId: 'reconcile-1', policyId: 'reconcile-policy', policy: { maxTotalAtomic: '20', maxPerRequestAtomic: '10' }, offer: { offerId: 'offer', network: 'eip155:10143' }, maximumAtomic: '10' });
  await service.bindAuthorization('reconcile-1', { payer: '0x0000000000000000000000000000000000000001', nonce: '1', signatureDigest: 'sha256:1' });
  await service.startExecution('reconcile-1', { executionToken: 'token' });
  await service.recordExecution('reconcile-1', { result: { output: 'x' }, usage: { inputTokens: 1, outputTokens: 1 }, actualAtomic: '1' });
  await service.recordFacilitatorSettlement('reconcile-1', { txHash: '0x' + '11'.repeat(32), amount: '1' });
  return { service, claim: await service.get('reconcile-1') };
}

describe('payment reconciliation state machine', () => {
  it('terminalizes disputed chain evidence instead of claiming settlement', async () => {
    const { service, claim } = await facilitatorPurchase();
    const result = await reconcileClaim(claim, { service, chainReader: async () => ({ status: 'disputed', reason: 'wrong_recipient' }) });
    expect(result.state).toBe('failed_unsettled');
    expect(result.reconciliation).toBe('failed_unsettled');
  });

  it('backs off while chain confirmation is still pending', async () => {
    const { service, claim } = await facilitatorPurchase();
    const before = new Date(claim.nextReconcileAt).getTime();
    const result = await reconcileClaim(claim, { service, chainReader: async () => ({ status: 'pending', reason: 'receipt_not_visible' }) });
    expect(result.state).toBe('facilitator_settled');
    expect(new Date(result.nextReconcileAt).getTime()).toBeGreaterThan(before);
    expect(result.reconciliation).toBe('chain_confirmation_pending');
  });
});
