# AgentPay

AgentPay is an open reference implementation for autonomous agent procurement on Monad. An agent discovers model prices, selects a machine-fulfillable offer, spends under an owner-signed policy, pays actual metered usage through x402 `upto` + Permit2, and receives a recoverable proof.

Built on Monad Testnet with x402 and Permit2.

[Interactive Simulation](apps/demo/index.html) | [Architecture & Evidence](apps/demo/brief.html) | [Live Repair](apps/demo/live-repair.html)

## Run the demo

Requirements: Node.js 22.23.3 (the pinned version in `.nvmrc`) or a compatible Node 22 runtime.

```bash
npm install
npm test
npm run dev
```

The repository also includes a reproducible container entry point:

```bash
docker build -t agentpay .
docker run --rm -p 4021:4021 --env-file .env.example agentpay
```

## Deploy to Vercel

This repository is configured for instantaneous deployment to [Vercel](https://vercel.com):

1. Push this repository to GitHub: `https://github.com/mohammedrehan143/agentpay`.
2. Import the project in Vercel.
3. Vercel automatically detects the build command (`npm run build`), outputs static files from `dist/`, and serves serverless API routes from `api/index.js`.


`AGENTPAY_RECORDED=1` is the safe default. It is a deterministic demonstration
mode: it does not sign a wallet payment, call a model provider, or claim a live
settlement. Every recorded result is labelled as a fixture or historical
evidence in the UI.

Open `http://127.0.0.1:4021/agentpay/`. The English landing page leads with the completed paid repair, its evidence video and exact settlement. Select **Try the interactive simulation** to enter the six-scene experience at `#hire`. A [Chinese introduction](apps/demo/zh.html) and optional Chinese video captions support community sharing; formal submission materials remain in English.

The entry demo is a six-scene interactive commission: hire KITE-07 to fix a duplicate-charge teaching fixture, choose a task budget (0.500000, 5.000000, or 25.000000 USDC) and autonomy policy, execute the failing baseline, inspect model channels on aiplans.dev, follow the recorded Toolkit purchase, then run acceptance tests and download the runnable fix. After acceptance, the overview maps the complete loop; a preview button exposes that map without claiming the task was run. The task budget is distinct from the 0.100000 USDC per-inference authorization ceiling. Hash URLs (`#hire`, `#work`, `#market`, `#connect`, `#delivery`, `#overview`) preserve browser navigation; local storage restores the commission. A counterfactual button applies a deliberately insufficient 0.010000 USDC budget to demonstrate a blocked purchase. The manual mode waits for approval; declining preserves the checkpoint.

The investigation, capacity trigger, and repair are scripted. Tests execute in the browser against the local fixture, including a genuinely failing duplicate-charge case. The fixture is synchronous and process-local, not production payment code. The historical provider output did not generate this fixture. Changing the commission controls the simulation and never generates a new model call, transaction, or receipt. The evidence panel always identifies the September 7 trace as historical.

The original animated control room remains available at `replay.html`. Both experiences retain September 2026 captures of the real aiplans.dev and Toolkit pages, with links to open the products and verify pricing and payment evidence.

## Executable live repair workflow

The attended operator is the live path; it is separate from the static landing
page and the recorded simulation. When configured and funded, it performs this
sequence without substituting scripted success:

1. The operator submits a task and runs the original duplicate-charge fixture
   in a server-owned disposable sandbox. Procurement cannot start unless the
   baseline actually fails.
2. The SDK reads the configured aiplans discovery provider and Toolkit offer
   feed, rejects human-checkout routes, compares eligible machine offers, and
   selects a route that fits the requested token bounds and signed budget.
3. The owner signs the Procurement Policy and ReservationIntent. The x402
   `upto` + Permit2 payment signature is requested only after those checks.
4. The merchant verifies the payment with the configured facilitator before
   invoking the provider. It records usage, calculates the integer metered
   charge, submits settlement, independently verifies the Monad receipt and
   Transfer, and only then issues a paid delivery receipt.
5. The returned model source is validated and sent to a disposable child
   process using Node's permission model, a 2-second timeout, a 64 MB heap
   limit, no network permissions, and no workspace/credential read access.
   The server runs the baseline and acceptance tests itself; client-supplied
   booleans are not trusted.
6. The operator exposes a unified execution record and can download a Markdown
   evidence report containing the task/policy IDs, selected model, quote,
   measured usage/cost, payment state, transaction reference, response digest,
   generated patch, isolation details, and test outcome.

Run it with:

```bash
npm run operator
# open http://127.0.0.1:4022/ in a browser wallet connected to Monad Testnet
```

The live merchant must be configured separately. Copy `.env.example` to a
private environment file and set `AGENTPAY_RECORDED=0`, a non-zero merchant
recipient, merchant signing key, Monad RPC URL, facilitator URL and allowlisted
facilitator signer, and `ZHIPU_APIKEY`. The readiness endpoint must return
`mode: "live-capable"` before a purchase is possible. Missing credentials, an
expired policy, an unaffordable quote, invalid payment, unverified settlement,
malformed provider output, or a failed repair stops the workflow. None of
those states is converted into a successful live run.

For a repeatable no-wallet demonstration of the repair boundary, run:

```bash
npx vitest run tests/repair-sandbox.test.js
```

This demonstrates both a failed repair and a successful repair in the same
restricted execution boundary. It is not evidence of a paid live inference.

## Verified testnet evidence

**Latest acceptance, September 10, 2026:** OpenRouter `z-ai/glm-5.3-flash` generated the checkout retry fix. The unchanged output passed all three isolated browser Worker tests, and the same purchase settled **0.000033 test USDC** for **131 input + 89 output = 220 tokens**, within a **0.1 test USDC** ceiling.

The [public evidence bundle](apps/demo/assets/live-repair.json) preserves the prompt, output, digest, tests and matched transaction. The [54-second video](apps/demo/brief.html) reviews the completed operator-assisted run; it does not reenact signatures or create another purchase. Tests are owner-reported, not cryptographic attestations. Evidence is pinned to commit `15025fa6f9538b0e33530ae35e127ea1b89842ec` with asset checksums.

**Earlier integration used by the interactive simulation:**

On September 7, 2026, the reference flow discovered `zhipu/GLM-4.7-Flash` through aiplans.dev, reserved a `0.100000 USDC` ceiling, bounded the request at a `1,024`-token input estimate and `256`-token output cap, then settled `0.000001 USDC` on Monad Testnet. The provider reported `17` input tokens and `256` output tokens, or `273` total.

The market reference shown in the demo is the aiplans.dev listing for GLM-4.7-Flash: Zhipu direct at `CNY 0 / 0` and OpenRouter at `USD 0.06 / 0.40` per one million input/output tokens. The selected Toolkit route uses the explicitly labeled testnet demo rate `2 / 8 atomic USDC` per one million input/output tokens (`toolkit-demo-2026-09`). At integer precision, both the bounded preflight and actual metered request round up to `1` atomic USDC.

- [Monad transaction](https://testnet.monadexplorer.com/tx/0xc1b583605f251c6141597bbe896406491e9ab08b0e57f3d32eaeca43cf263ed2)
- [Redacted public proof](https://staging.toolkit.fun/api/agentpay/v1/proofs/proof_97ae4853f5eb26ee)
- Purchase ID: `627c4d7a-765e-40b9-9b2f-f45474a4f6ff`

The chain receipt contains a USDC `Transfer` of exactly `1` atomic unit from the Agent wallet to the configured Toolkit merchant. The proof exposes no prompt, model output, credential, or private key.

## Agent loop

```ts
import { createAgentPay, createAiplansDiscovery } from '@toolkitfun/agentpay-sdk';

const agentpay = createAgentPay({
  policy,
  policySignature,
  discovery: createAiplansDiscovery({
    baseUrl: 'https://aiplans.dev',
    toolkitBaseUrl: 'https://staging.toolkit.fun',
  }),
  baseUrl: 'https://staging.toolkit.fun',
});

const purchase = await agentpay.buy({
  policyId: policy.policyId,
  body: { prompt: 'Implement the next task' },
  inputTokens: 1_024,
  outputCap: 256,
  signReservation,
  signPayment,
  waitForSettlement: true,
});
```

`buy()` returns `status: "pending"` while Monad confirmation is unresolved and
`status: "matched"` only after a response contains the expected purchase ID,
paid receipt, actual amount and proof ID. The public reference store is
process-local; production durability requires a different adapter.

## Repository layout

```text
apps/demo/                 interactive simulation and real paid-repair evidence
apps/operator/             attended browser-wallet testnet purchase companion
apps/reference-server/     x402 merchant and purchase state machine
packages/protocol/         policy, digest, state, receipt, and error contracts
packages/sdk/              discovery, signing, purchase, and recovery client
examples/                  agent integration examples
docs/architecture.md       trust boundaries and lifecycle
apps/operator/repair-sandbox.mjs server-owned generated-code verifier
tests/                      policy, payment, reconciliation, isolation and smoke checks
```

## Reference merchant live mode

For the public reference merchant's Zhipu route, set `AGENTPAY_RECORDED=0` and provide:

- `AGENTPAY_PAY_TO`
- `AGENTPAY_MERCHANT_PRIVATE_KEY`
- `MONAD_RPC_URL`
- `X402_FACILITATOR_URL`
- `X402_FACILITATOR_ADDRESS` or `X402_FACILITATOR_SIGNER_ALLOWLIST`
- `ZHIPU_APIKEY`

The reference server fails closed if readiness is incomplete. A production deployment should replace the included process-local store with a transactional durable adapter.

The reference server exposes `GET /api/agentpay/v1/policies/{policyId}/budget`
for the current committed, reserved and remaining atomic budget. Reservation
responses include the same snapshot. The signed policy binds the owner, agent
wallet, network, asset, merchant/model allowlists, expiry, total budget,
per-inference authorization ceiling, and the optional `requireHumanApproval`
flag. The model output has no authority to change any of those values.

## Safety properties

- Human-checkout offers are rejected before authorization.
- The owner policy binds wallet, merchant, model, budget, chain, asset, and expiry.
- A reservation binds the complete provider request and token caps before execution.
- Permit2 authorizes a ceiling; settlement passes only the actual metered amount.
- Settlement retries reuse recorded provider output while the purchase state is retained; disputed chain evidence becomes `failed_unsettled`, pending evidence is backed off for reconciliation, and production crash recovery still requires durable storage.
- A Permit2 payer/nonce pair binds to one purchase.
- Delayed chain visibility remains pending rather than being reported as success.

## Submission Materials

- [English submission write-up](docs/hackathon-submission.md)
- [Readiness checklist and remaining submission steps](docs/submission-checklist.md)
- [Walkthrough script and recording instructions](docs/video-script.md)
- [Architecture and trust boundaries](docs/architecture.md)
- [Provider selection and wallet troubleshooting](docs/operator-providers.md)
- [Contributor setup](CONTRIBUTING.md) and [security reporting](SECURITY.md)

## Browser Wallet Operator

Run `npm run operator`, then open `http://127.0.0.1:4022/` in a browser with an Ethereum wallet. This local companion uses the public SDK against Toolkit staging; the static judge demo never requests payment. It pins Monad Testnet, the documented USDC asset and Toolkit merchant, with a maximum of 0.1 test USDC for one purchase per server session. The optional allowance transaction authorizes exactly 0.1 USDC to Permit2, never an unlimited amount.

The current live operator is pinned to the configured Zhipu machine offer on
the reference merchant. The OpenRouter purchase in the static evidence bundle
is historical and is not silently replayed by this operator. Do not set an
unsupported provider selector and assume it changed the payment route; the
session displays the actual selected provider and model. See [provider
selection](docs/operator-providers.md) for recovery and disabled-button
troubleshooting.

Connect the wallet, check readiness and funds, run the failing baseline, consent to the maximum, and start. Confirm each typed-data signature in the wallet. The owner and agent are the same connected wallet in this operator-assisted run; it is not unattended delegation. The page recovers the model output, independently checks its onchain transfer, and sends the output to the server-owned disposable repair sandbox with a two-second timeout. Generated code is not executed in the main backend process, Node workspace, or developer credential context. The final test report is produced by the server harness, not accepted from browser booleans. Reject malformed output rather than substituting the teaching fixture.

Keep the local server running while settlement is pending. Reconcile the same purchase instead of buying again. The downloadable evidence contains the public task, raw output, digest, usage, receipt and test result, but no private key, payment signature or progress token. This companion uses in-memory state and is for an attended testnet run only. Wallet confirmations and a funded account are still required; no successful live repair is claimed merely because the companion exists.

## Status

This is hackathon-quality Developer Preview software. Do not use it to custody production funds without an independent security review, a durable store implementation, and OS/container hardening beyond the included child-process boundary. The sandbox is a practical demo boundary, not a claim of perfect isolation against a hostile kernel or a replacement for a dedicated container/VM service.

Real paid-repair acceptance, the pinned v0.2.0 release and evidence video are complete. Metropolis project details are saved under **Consumer Products & Payments**; final submission remains pending. The authenticated platform opens submission **September 22, 2026 at 11:59** and closes **October 14 at 11:59**, Asia/Singapore (UTC+8).

Apache-2.0 licensed. See [NOTICE](NOTICE) for attribution.
