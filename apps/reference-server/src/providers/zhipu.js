const config = {
  ai: {
    zhipuModel: process.env.ZHIPU_MODEL || 'GLM-4.7-Flash',
    geminiModel: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  },
  zhipuApiKey: process.env.ZHIPU_APIKEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || process.env.GEMINI_APIKEY || '',
  sandbox: { aiTimeoutMs: Number(process.env.AGENTPAY_PROVIDER_TIMEOUT_MS || 30_000) },
};

/**
 * Raw AI provider adapter for AgentPay (supporting Zhipu and Gemini). It deliberately
 * bypasses subscription entitlement and returns provider-reported usage as an
 * immutable execution record. The demo uses the deterministic fixture unless live mode is opted in.
 */
export async function invokeZhipu({ prompt, messages, inputTokens, outputCap, model, fetcher = fetch, apiKey, timeoutMs = config.sandbox.aiTimeoutMs, recorded = process.env.AGENTPAY_RECORDED !== '0' } = {}) {
  const normalizedMessages = Array.isArray(messages) && messages.length ? messages : [{ role: 'user', content: String(prompt || '') }];
  const isGemini = Boolean(config.geminiApiKey && (!config.zhipuApiKey || process.env.GEMINI_API_KEY));
  const effectiveKey = apiKey || (isGemini ? config.geminiApiKey : config.zhipuApiKey);
  const effectiveModel = model || (isGemini ? config.ai.geminiModel : config.ai.zhipuModel);
  const providerName = isGemini ? 'Gemini' : 'Zhipu';
  const endpoint = isGemini
    ? 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
    : 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

  if (recorded) {
    const text = String(normalizedMessages.at(-1)?.content || prompt || 'Create a payment-aware agent demo');
    const output = `Agent completed: ${text.slice(0, 96)}.\n\nToolkit route fulfilled this request with an owner-bounded upto authorization.`;
    return { result: { output, model: effectiveModel }, usage: { inputTokens: Math.max(1, Math.ceil(text.length / 4)), outputTokens: Math.max(1, Math.ceil(output.length / 4)) }, source: 'recorded' };
  }
  if (!effectiveKey) {
    const error = new Error(`${providerName} credentials are not configured for live AgentPay execution`);
    error.status = 503;
    error.code = 'readiness_unavailable';
    error.retryable = false;
    throw error;
  }
  let response;
  try {
    response = await fetcher(endpoint, {
      method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${effectiveKey}` },
      body: JSON.stringify({ model: effectiveModel, messages: normalizedMessages, ...(Number.isSafeInteger(outputCap) && outputCap > 0 ? { max_tokens: outputCap } : {}), temperature: 0.2, stream: false }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const wrapped = new Error(`${providerName} transport failed after dispatch`); wrapped.code = 'execution_unknown'; wrapped.retryable = false; throw wrapped;
  }
  if (!response.ok) { const error = new Error(`${providerName} definitive response ${response.status}`); error.code = 'failed_unsettled'; error.retryable = false; throw error; }
  const payload = await response.json();
  const usage = payload?.usage;
  const inputUsage = usage?.prompt_tokens;
  const outputUsage = usage?.completion_tokens;
  const content = payload?.choices?.[0]?.message?.content;
  if (!Number.isSafeInteger(inputUsage) || !Number.isSafeInteger(outputUsage) || inputUsage < 0 || outputUsage < 0) {
    const error = new Error(`${providerName} response contained invalid token usage`); error.code = 'failed_unsettled'; error.retryable = false; throw error;
  }
  if (Number.isSafeInteger(inputTokens) && inputUsage > inputTokens) {
    const error = new Error(`${providerName} response exceeded the reserved input bound`); error.code = 'failed_unsettled'; error.retryable = false; throw error;
  }
  if (Number.isSafeInteger(outputCap) && outputUsage > outputCap) {
    const error = new Error(`${providerName} response exceeded the reserved output cap`); error.code = 'failed_unsettled'; error.retryable = false; throw error;
  }
  if (typeof content !== 'string' || !content.trim()) {
    const error = new Error(`${providerName} response did not contain a non-empty text result`); error.code = 'failed_unsettled'; error.retryable = false; throw error;
  }
  return { result: { output: content, model: effectiveModel }, usage: { inputTokens: inputUsage, outputTokens: outputUsage }, source: isGemini ? 'gemini' : 'zhipu' };
}
