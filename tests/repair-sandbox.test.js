import { describe, expect, it } from 'vitest';
import { BASE_SOURCE, buildEvidenceMarkdown, runCheckoutInSandbox, runRepairVerification } from '../apps/operator/repair-sandbox.mjs';

const FIXED_SOURCE = `function createCheckout() {
  const receipts = new Map(); let charges = 0;
  return { pay(key) { if (receipts.has(key)) return receipts.get(key); const receipt = { id: 'receipt-' + (++charges), key }; receipts.set(key, receipt); return receipt; }, get charges() { return charges; } };
}`;

describe('repair execution sandbox', () => {
  it('captures the actual failing baseline and accepts the isolated repair', async () => {
    const report = await runRepairVerification({ source: FIXED_SOURCE });
    expect(report.baseline.requiredFailure).toBe(true);
    expect(report.baseline.tests.at(-1).pass).toBe(false);
    expect(report.repair.passed).toBe(true);
    expect(report.outcome).toBe('accepted');
    expect(report.isolation.network).toContain('disabled');
  });

  it('reports a failed repair instead of accepting client-supplied booleans', async () => {
    const report = await runRepairVerification({ source: BASE_SOURCE });
    expect(report.repair.passed).toBe(false);
    expect(report.outcome).toBe('rejected');
  });

  it('does not expose process capabilities to generated code', async () => {
    const report = await runCheckoutInSandbox(`function createCheckout() { return { pay() { return { id: process.env.SECRET }; }, get charges() { return 1; } }; }`);
    expect(report.passed).toBe(false);
    expect(report.error).toMatch(/forbidden|process|sandbox/i);
  });

  it('renders the final report from measured evidence rather than a success flag', () => {
    const report = buildEvidenceMarkdown({ completed: true, mode: 'live', taskId: 'task-1', policyId: 'policy-1', selectedModel: 'zhipu/GLM-4.7-Flash', provider: 'zhipu', quotedPrice: { authorizedMaximum: '100000' }, usage: { actualAtomic: '1' }, payment: { status: 'verified_settlement', transactionReference: '0xtx' }, tests: [{ name: 'Retry reuses receipt', pass: true }], rawOutput: FIXED_SOURCE, verification: { isolation: { environment: 'child', network: 'disabled', filesystem: 'runner-only' } } });
    expect(report).toContain('task-1');
    expect(report).toContain('verified_settlement');
    expect(report).toContain('PASS — Retry reuses receipt');
    expect(report).toContain('function createCheckout');
  });
});
