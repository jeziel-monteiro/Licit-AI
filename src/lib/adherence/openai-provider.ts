import { performance } from "node:perf_hooks";
import { setTimeout as wait } from "node:timers/promises";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { modelOutputSchema, type AdherenceProvider, type ProviderMetadata, type ProviderReply, type TokenUsage } from "./contracts";
import { readOpenAIConfiguration, type OpenAIConfiguration } from "./config";
import { AdherenceError } from "./errors";

function safeId(value: unknown): string | null { return typeof value === "string" && /^[a-zA-Z0-9_-]{1,200}$/.test(value) ? value : null; }
function usageValue(value: unknown): number | null { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null; }
export class OpenAIAdherenceProvider implements AdherenceProvider {
  readonly settings;
  readonly configured: boolean;
  readonly configurationFailure: "not_configured" | "invalid_configuration" | null;
  private readonly client: OpenAI | null;
  private readonly pause: (ms: number, signal: AbortSignal) => Promise<void>;
  constructor(configuration: OpenAIConfiguration = readOpenAIConfiguration(), options: { fetcher?: typeof fetch; sleep?: (ms: number, signal: AbortSignal) => Promise<void> } = {}) {
    this.settings = configuration.settings;
    this.configured = Boolean(configuration.apiKey) && configuration.valid;
    this.configurationFailure = !configuration.valid ? "invalid_configuration" : !configuration.apiKey ? "not_configured" : null;
    this.pause = options.sleep ?? ((ms, signal) => wait(ms, undefined, { signal }));
    this.client = this.configured ? new OpenAI({ apiKey: configuration.apiKey!, baseURL: "https://api.openai.com/v1", timeout: this.settings.timeoutMs, maxRetries: 0, logLevel: "off", dangerouslyAllowBrowser: false, fetch: options.fetcher }) : null;
  }
  async generate(input: { instructions: string; data: string }): Promise<ProviderReply> {
    if (!this.client) throw new AdherenceError(this.configurationFailure ?? "not_configured");
    if (Buffer.byteLength(input.instructions, "utf8") + Buffer.byteLength(input.data, "utf8") > this.settings.maxInputBytes) throw new AdherenceError("input_too_large");
    const started = performance.now();
    const signal = AbortSignal.timeout(this.settings.deadlineMs);
    for (let attempt = 1; attempt <= this.settings.maxRetries + 1; attempt++) {
      const metadata = (): ProviderMetadata => ({ model: this.settings.model, durationMs: Math.round(performance.now() - started), attempts: attempt, usage: null, responseId: null, requestId: null });
      try {
        const response = await this.client.responses.create({
          model: this.settings.model,
          instructions: input.instructions,
          input: [{ role: "user", content: input.data }],
          text: { format: zodTextFormat(modelOutputSchema, "adherence_result") },
          max_output_tokens: this.settings.maxOutputTokens,
          store: false,
          tools: [],
          tool_choice: "none",
        }, { signal });
        const reported = response.usage;
        const inputTokens = usageValue(reported?.input_tokens);
        const outputTokens = usageValue(reported?.output_tokens);
        const totalTokens = usageValue(reported?.total_tokens);
        const usage: TokenUsage | null = inputTokens !== null && outputTokens !== null && totalTokens !== null ? {
          inputTokens, outputTokens, totalTokens,
          cachedInputTokens: usageValue(reported?.input_tokens_details?.cached_tokens),
          reasoningTokens: usageValue(reported?.output_tokens_details?.reasoning_tokens),
        } : null;
        const meta = { ...metadata(), model: typeof response.model === "string" && /^[a-zA-Z0-9._:-]{1,150}$/.test(response.model) ? response.model : this.settings.model, usage, responseId: safeId(response.id), requestId: safeId(response._request_id) };
        const refused = response.output?.some((item) => item.type === "message" && item.content.some((part) => part.type === "refusal"));
        if (response.status === "failed" || response.error) throw new AdherenceError("provider", true, meta);
        return { text: response.output_text ?? "", metadata: meta, disposition: refused ? "refused" : response.status === "completed" ? "completed" : "incomplete" };
      } catch (error) {
        if (error instanceof AdherenceError) throw error;
        const meta = metadata();
        let failure: AdherenceError;
        if (signal.aborted || error instanceof OpenAI.APIConnectionTimeoutError || error instanceof OpenAI.APIUserAbortError) failure = new AdherenceError("timeout", true, meta);
        else if (error instanceof OpenAI.APIError && (error.code === "insufficient_quota" || error.code === "billing_hard_limit_reached")) failure = new AdherenceError("quota", false, meta);
        else if (error instanceof OpenAI.APIError && (error.status === 401 || error.status === 403)) failure = new AdherenceError("credentials", false, meta);
        else if (error instanceof OpenAI.APIError && error.status === 429) failure = new AdherenceError("rate_limit", true, meta);
        else if (error instanceof OpenAI.APIConnectionError) failure = new AdherenceError("network", true, meta);
        else if (error instanceof OpenAI.APIError && [400, 404, 422].includes(error.status ?? 0)) failure = new AdherenceError("invalid_configuration", false, meta);
        else failure = new AdherenceError("provider", error instanceof OpenAI.APIError && (error.status === 408 || error.status === 409 || (error.status ?? 0) >= 500), meta);
        if (!failure.failure.retryable || attempt > this.settings.maxRetries || signal.aborted) throw failure;
        const headers = error instanceof OpenAI.APIError ? error.headers : undefined;
        const retryMsHeader = headers?.get("retry-after-ms");
        const retryHeader = headers?.get("retry-after");
        const explicitDelay = retryMsHeader !== null && retryMsHeader !== undefined ? Number(retryMsHeader) : retryHeader ? (/^\d+(?:\.\d+)?$/.test(retryHeader) ? Number(retryHeader) * 1000 : Date.parse(retryHeader) - Date.now()) : null;
        // Um Retry-After maior que o orçamento é devolvido ao usuário; nunca repetimos antes do prazo.
        if (explicitDelay !== null && Number.isFinite(explicitDelay) && explicitDelay > 2000) throw failure;
        const delay = explicitDelay !== null && Number.isFinite(explicitDelay) ? Math.max(0, explicitDelay) : 250 * 2 ** (attempt - 1) + Math.floor(Math.random() * 100);
        try { await this.pause(delay, signal); } catch { throw new AdherenceError("timeout", true, metadata()); }
      }
    }
    throw new AdherenceError("provider", true);
  }
}
