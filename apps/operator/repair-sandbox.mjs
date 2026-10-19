import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';

export const BASE_SOURCE = `function createCheckout() {
  const receipts = new Map(); let charges = 0;
  return {
    pay(key) { const receipt = { id: 'receipt-' + (++charges), key }; receipts.set(key, receipt); return receipt; },
    get charges() { return charges; }
  };
}`;

const RUNNER = fileURLToPath(new URL('./repair-sandbox-runner.mjs', import.meta.url));
const MAX_SOURCE_BYTES = 30_000;
const MAX_OUTPUT_BYTES = 128 * 1024;

function digest(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function runChild(source, { timeoutMs = 2_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      '--experimental-permission',
      `--allow-fs-read=${RUNNER}`,
      '--max-old-space-size=64',
      '--no-addons',
      RUNNER,
    ], {
      cwd: os.tmpdir(),
      env: { PATH: '', HOME: os.tmpdir(), NODE_NO_WARNINGS: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      error ? reject(error) : resolve(value);
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      const error = new Error(`repair sandbox exceeded ${timeoutMs}ms`);
      error.code = 'sandbox_timeout';
      finish(error);
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (Buffer.byteLength(stdout) > MAX_OUTPUT_BYTES) {
        child.kill('SIGKILL');
        const error = new Error('repair sandbox output exceeded the bounded limit');
        error.code = 'sandbox_output_limit';
        finish(error);
      }
    });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString().slice(0, 4096); });
    child.on('error', (error) => finish(error));
    child.on('close', (code, signal) => {
      if (settled) return;
      let result = null;
      try { result = JSON.parse(stdout); } catch { /* handled below */ }
      if (!result?.ok) {
        const error = new Error(result?.error || stderr || `repair sandbox exited with ${signal || code}`);
        error.code = code === null ? 'sandbox_terminated' : 'sandbox_failed';
        finish(error);
        return;
      }
      finish(null, result);
    });
    child.stdin.end(JSON.stringify({ source }));
  });
}

export async function runCheckoutInSandbox(source = BASE_SOURCE, options = {}) {
  if (Buffer.byteLength(String(source)) > MAX_SOURCE_BYTES) throw new Error('Generated repair is larger than the sandbox limit');
  try {
    const result = await runChild(String(source), options);
    return { tests: result.tests, passed: result.tests.every((test) => test.pass), sourceSha256: digest(source) };
  } catch (error) {
    return {
      tests: [
        { name: 'First request', pass: false },
        { name: 'Distinct keys', pass: false },
        { name: 'Retry reuses receipt', pass: false },
      ],
      passed: false,
      sourceSha256: digest(source),
      error: error.message,
      errorCode: error.code || 'sandbox_failed',
    };
  }
}

export async function runRepairVerification({ source, baselineSource = BASE_SOURCE, timeoutMs = 2_000 } = {}) {
  const baseline = await runCheckoutInSandbox(baselineSource, { timeoutMs });
  const repair = await runCheckoutInSandbox(source, { timeoutMs });
  return {
    schema: 'agentpay.repair-verification.v1',
    executedAt: new Date().toISOString(),
    baseline: { ...baseline, requiredFailure: !baseline.passed },
    repair,
    isolation: {
      environment: 'disposable child process',
      network: 'disabled by Node permission model',
      filesystem: 'runner-only read access; no workspace or credential access',
      timeoutMs,
      maxSourceBytes: MAX_SOURCE_BYTES,
    },
    outcome: repair.passed ? 'accepted' : 'rejected',
  };
}

export function buildEvidenceMarkdown(evidence) {
  const tests = evidence?.tests || evidence?.verification?.repair?.tests || [];
  const lines = [
    '# AgentPay execution evidence',
    '',
    `- Outcome: **${evidence?.completed ? 'accepted' : 'rejected'}**`,
    `- Evidence class: **${evidence?.mode === 'live' ? 'live execution' : 'recorded or simulated'}**`,
    `- Task ID: ${evidence?.taskId || evidence?.purchaseId || 'unknown'}`,
    `- Policy ID: ${evidence?.policyId || 'unknown'}`,
    `- Selected model: **${evidence?.selectedModel || evidence?.proof?.model || 'unknown'}**`,
    `- Provider: **${evidence?.provider || 'unknown'}**`,
    `- Quoted maximum: **${evidence?.quotedPrice?.authorizedMaximum || 'unknown'} atomic USDC**`,
    `- Actual measured cost: **${evidence?.usage?.actualAtomic || evidence?.proof?.actualAtomic || 'unknown'} atomic USDC**`,
    `- Payment state: **${evidence?.payment?.status || 'unknown'}**`,
    `- Transaction: ${evidence?.payment?.transactionReference || evidence?.proof?.txHash || 'none'}`,
    '',
    '## Acceptance tests',
    '',
    ...tests.map((test) => `- ${test.pass ? 'PASS' : 'FAIL'} — ${test.name}`),
    '',
    '## Isolation',
    '',
    `- ${evidence?.verification?.isolation?.environment || 'Not recorded'}`,
    `- Network: ${evidence?.verification?.isolation?.network || 'Not recorded'}`,
    `- Filesystem: ${evidence?.verification?.isolation?.filesystem || 'Not recorded'}`,
    '',
    '## Generated patch',
    '',
    '```javascript',
    String(evidence?.rawOutput || evidence?.patch || '(no generated patch)'),
    '```',
    '',
    '> A live execution is only accepted after payment evidence and the isolated acceptance tests are both verified. Historical and simulated results are not live claims.',
  ];
  return lines.join('\n');
}
