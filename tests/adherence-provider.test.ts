import { test } from "node:test";
import assert from "node:assert/strict";
import { OpenAIAdherenceProvider } from "../src/lib/adherence/openai-provider";
import { readOpenAIConfiguration } from "../src/lib/adherence/config";
import { AdherenceError } from "../src/lib/adherence/errors";

const TEST_KEY = "dummy-test-key-not-a-real-credential";
const configuration = () => readOpenAIConfiguration({ OPENAI_API_KEY: TEST_KEY, OPENAI_MODEL: "test-model", OPENAI_MAX_RETRIES: "1" });
const input = { instructions: "INSTRUÇÕES SIMULADAS DE TESTE", data: JSON.stringify({ description: "DADOS SIMULADOS DE TESTE" }) };
function response(patch: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({
    id: "resp_test", object: "response", model: "test-model-snapshot", status: "completed", error: null, incomplete_details: null,
    output: [{ id: "msg_test", type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", annotations: [], text: "{\"simulated\":true}" }] }],
    usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15, input_tokens_details: { cached_tokens: 2 }, output_tokens_details: { reasoning_tokens: 1 } }, ...patch,
  }), { headers: { "content-type": "application/json", "x-request-id": "req_test" } });
}
function httpError(status: number, code = "server_error", headers: Record<string, string> = {}) {
  return new Response(JSON.stringify({ error: { code, message: `INFORMAÇÃO PRIVADA ${TEST_KEY}`, type: "api_error" } }), { status, headers: { "content-type": "application/json", ...headers } });
}
async function rejectsCode(work: Promise<unknown>, code: string) {
  await assert.rejects(work, (error: unknown) => error instanceof AdherenceError && error.failure.code === code && !error.message.includes(TEST_KEY) && !error.message.includes("INFORMAÇÃO PRIVADA"));
}

test("cliente não configurado não instancia uma chamada externa", async () => {
  let calls = 0;
  const provider = new OpenAIAdherenceProvider(readOpenAIConfiguration({}), { fetcher: async () => { calls++; return response(); } });
  assert.equal(provider.configured, false); await rejectsCode(provider.generate(input), "not_configured"); assert.equal(calls, 0);
});
test("configuração inválida é identificada sem usar valores inseguros", async () => {
  const provider = new OpenAIAdherenceProvider(readOpenAIConfiguration({ OPENAI_API_KEY: TEST_KEY, OPENAI_MAX_RETRIES: "100" }));
  assert.equal(provider.configured, false); await rejectsCode(provider.generate(input), "invalid_configuration");
});
test("SDK usa Responses estruturado, sem ferramentas, e devolve metadados normalizados", async () => {
  let body: Record<string, unknown> = {}; let url = "";
  const provider = new OpenAIAdherenceProvider(configuration(), { fetcher: async (request, init) => { url = String(request); body = JSON.parse(String(init!.body)); return response(); } });
  const reply = await provider.generate(input);
  assert.equal(url, "https://api.openai.com/v1/responses"); assert.equal(body.store, false); assert.deepEqual(body.tools, []); assert.equal(body.tool_choice, "none"); assert.equal(body.max_output_tokens, 4000);
  const format = (body.text as { format: { type: string; strict: boolean; schema: Record<string, unknown> } }).format;
  assert.equal(format.type, "json_schema"); assert.equal(format.strict, true); assert.equal(format.schema.additionalProperties, false);
  assert.equal(reply.text, '{"simulated":true}'); assert.equal(reply.metadata.model, "test-model-snapshot"); assert.equal(reply.metadata.attempts, 1);
  assert.deepEqual(reply.metadata.usage, { inputTokens: 10, outputTokens: 5, totalTokens: 15, cachedInputTokens: 2, reasoningTokens: 1 });
  assert.equal(reply.metadata.requestId, "req_test"); assert.equal(reply.metadata.responseId, "resp_test");
  assert.equal(JSON.stringify(reply).includes(TEST_KEY), false);
});
test("erro transitório 503 tem tentativas limitadas e pode se recuperar", async () => {
  let calls = 0;
  const provider = new OpenAIAdherenceProvider(configuration(), { fetcher: async () => ++calls === 1 ? httpError(503) : response(), sleep: async () => {} });
  const reply = await provider.generate(input); assert.equal(calls, 2); assert.equal(reply.metadata.attempts, 2);
});
test("limite de tentativas não é multiplicado pelo SDK", async () => {
  let calls = 0;
  const provider = new OpenAIAdherenceProvider(configuration(), { fetcher: async () => { calls++; return httpError(500); }, sleep: async () => {} });
  await rejectsCode(provider.generate(input), "provider"); assert.equal(calls, 2);
});
test("credencial inválida e saldo esgotado não são repetidos nem expostos", async () => {
  for (const [status, code, expected] of [[401, "invalid_api_key", "credentials"], [403, "permission_denied", "credentials"], [429, "insufficient_quota", "quota"], [429, "billing_hard_limit_reached", "quota"]] as const) {
    let calls = 0;
    const provider = new OpenAIAdherenceProvider(configuration(), { fetcher: async () => { calls++; return httpError(status, code); }, sleep: async () => {} });
    await rejectsCode(provider.generate(input), expected); assert.equal(calls, 1);
  }
});
test("429 respeita Retry-After curto e preserva o limite de tentativas", async () => {
  let calls = 0; const delays: number[] = [];
  const provider = new OpenAIAdherenceProvider(configuration(), { fetcher: async () => ++calls === 1 ? httpError(429, "rate_limit_exceeded", { "retry-after-ms": "7" }) : response(), sleep: async (ms) => { delays.push(ms); } });
  await provider.generate(input); assert.equal(calls, 2); assert.deepEqual(delays, [7]);
});
test("Retry-After além do orçamento não é antecipado", async () => {
  let calls = 0; let sleeps = 0;
  const provider = new OpenAIAdherenceProvider(configuration(), { fetcher: async () => { calls++; return httpError(429, "rate_limit_exceeded", { "retry-after": "10" }); }, sleep: async () => { sleeps++; } });
  await rejectsCode(provider.generate(input), "rate_limit"); assert.equal(calls, 1); assert.equal(sleeps, 0);
});
test("falha de rede é normalizada e tem tentativas limitadas", async () => {
  let calls = 0;
  const provider = new OpenAIAdherenceProvider(configuration(), { fetcher: async () => { calls++; throw new TypeError(`Network error ${TEST_KEY}`); }, sleep: async () => {} });
  await rejectsCode(provider.generate(input), "network"); assert.equal(calls, 2);
});
test("timeout do SDK aborta a chamada e produz erro seguro", async () => {
  let aborted = false;
  const config = configuration(); config.settings.timeoutMs = 100; config.settings.deadlineMs = 1000; config.settings.maxRetries = 0;
  const provider = new OpenAIAdherenceProvider(config, { fetcher: async (_request, init) => new Promise<Response>((_resolve, reject) => {
    const keepAlive = setTimeout(() => reject(new Error("Teste sem abort")), 2000);
    init!.signal!.addEventListener("abort", () => { aborted = true; clearTimeout(keepAlive); reject(new DOMException("aborted", "AbortError")); }, { once: true });
  }) });
  await rejectsCode(provider.generate(input), "timeout"); assert.equal(aborted, true);
});
test("modelo inválido não é confundido com aderência comercial", async () => {
  let calls = 0;
  const provider = new OpenAIAdherenceProvider(configuration(), { fetcher: async () => { calls++; return httpError(404, "model_not_found"); } });
  await rejectsCode(provider.generate(input), "invalid_configuration"); assert.equal(calls, 1);
});
test("recusa e resposta incompleta são diferenciadas de saída completa", async () => {
  const refused = new OpenAIAdherenceProvider(configuration(), { fetcher: async () => response({ output: [{ id: "msg_test", type: "message", role: "assistant", status: "completed", content: [{ type: "refusal", refusal: "Recusa simulada." }] }] }) });
  assert.equal((await refused.generate(input)).disposition, "refused");
  const incomplete = new OpenAIAdherenceProvider(configuration(), { fetcher: async () => response({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }) });
  assert.equal((await incomplete.generate(input)).disposition, "incomplete");
});
test("entrada excessiva não chega ao transporte do SDK", async () => {
  let calls = 0;
  const provider = new OpenAIAdherenceProvider(configuration(), { fetcher: async () => { calls++; return response(); } });
  await rejectsCode(provider.generate({ instructions: "instruções", data: "x".repeat(25000) }), "input_too_large"); assert.equal(calls, 0);
});
test("metadados ausentes ou inválidos não são fabricados", async () => {
  const provider = new OpenAIAdherenceProvider(configuration(), { fetcher: async () => response({ usage: null, id: "id com conteúdo inválido" }) });
  const reply = await provider.generate(input); assert.equal(reply.metadata.usage, null); assert.equal(reply.metadata.responseId, null);
});
