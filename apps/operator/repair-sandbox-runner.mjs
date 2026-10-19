import { createContext, runInContext } from 'node:vm';

let input = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) input += chunk;

function fail(message) {
  process.stdout.write(JSON.stringify({ ok: false, error: String(message || 'sandbox failure') }));
  process.exitCode = 1;
}

try {
  const payload = JSON.parse(input);
  const source = String(payload.source || '').trim();
  if (!source.startsWith('function createCheckout(') || source.length > 30000) throw new Error('Expected bounded function createCheckout() source');
  if (/\b(?:import|export|fetch|WebSocket|XMLHttpRequest|require|process|globalThis\.process)\b/.test(source)) throw new Error('Generated source contains a forbidden capability');

  const context = createContext(Object.create(null), { codeGeneration: { strings: false, wasm: false } });
  runInContext(`"use strict";\n${source}\nthis.__createCheckout = createCheckout;`, context, { timeout: 750 });
  const result = runInContext(`(() => {
    const create = this.__createCheckout;
    const first = create();
    const a = first.pay('a');
    const different = create();
    different.pay('a'); different.pay('b');
    const retry = create();
    const original = retry.pay('a');
    const repeated = retry.pay('a');
    return { tests: [
      { name: 'First request', pass: a?.id === 'receipt-1' && first.charges === 1 },
      { name: 'Distinct keys', pass: different.charges === 2 },
      { name: 'Retry reuses receipt', pass: original === repeated && retry.charges === 1 }
    ] };
  })()`, context, { timeout: 750 });
  if (!Array.isArray(result.tests) || result.tests.length !== 3 || result.tests.some((test) => typeof test.pass !== 'boolean')) throw new Error('Sandbox produced an invalid test report');
  process.stdout.write(JSON.stringify({ ok: true, tests: result.tests }));
} catch (error) {
  fail(error?.message || error);
}
