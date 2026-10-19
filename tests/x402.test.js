import { describe, expect, it } from 'vitest';
import { ERC20_TRANSFER_TOPIC, MONAD_USDC, matchMonadSettlementReceipt, settleX402Payment, verifyX402Payment } from '../apps/reference-server/src/x402.js';

const payTo = '0x000000000000000000000000000000000000000a';
const payer = '0x000000000000000000000000000000000000000b';
const topic = (address) => `0x${address.slice(2).padStart(64, '0')}`;
const data = (value) => `0x${BigInt(value).toString(16).padStart(64, '0')}`;

describe('x402 payment evidence', () => {
  it('rejects malformed payment headers before contacting a facilitator', async () => {
    const result = await verifyX402Payment({ header: 'not-an-x402-header', requirements: { accepts: [{}] }, facilitatorClient: { verify: async () => { throw new Error('must not be called'); } } });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/valid x402/i);
  });

  it('rejects settlement above the verified upto ceiling', async () => {
    const result = await settleX402Payment({ paymentPayload: {}, requirements: { accepts: [{ amount: '10' }] }, actualAmount: '11', facilitatorClient: { settle: async () => { throw new Error('must not be called'); } } });
    expect(result).toEqual({ ok: false, reason: 'settlement amount exceeds verified upto ceiling' });
  });

  it('requires the exact token, recipient, payer and measured amount in the receipt', () => {
    const receipt = { status: '0x1', transactionHash: '0x' + '12'.repeat(32), logs: [{ address: MONAD_USDC, topics: [ERC20_TRANSFER_TOPIC, topic(payer), topic(payTo)], data: data(7) }] };
    expect(matchMonadSettlementReceipt(receipt, { token: MONAD_USDC, payTo, expectedPayer: payer, expectedAmount: '7', maximumAtomic: '10' }).status).toBe('confirmed');
    expect(matchMonadSettlementReceipt(receipt, { token: MONAD_USDC, payTo, expectedPayer: payer, expectedAmount: '8', maximumAtomic: '10' })).toMatchObject({ status: 'disputed', reason: 'actual_amount_mismatch' });
    expect(matchMonadSettlementReceipt(receipt, { token: MONAD_USDC, payTo: '0x000000000000000000000000000000000000000c', expectedPayer: payer, expectedAmount: '7', maximumAtomic: '10' })).toMatchObject({ status: 'disputed', reason: 'matching_transfer_not_found' });
  });
});
