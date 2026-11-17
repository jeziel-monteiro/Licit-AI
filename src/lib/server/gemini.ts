import { performance } from "node:perf_hooks";
import { AdherenceError } from "../adherence/errors";
import type { ProviderMetadata } from "../adherence/contracts";

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

export async function generateGemini(input: { instructions: string; data: string; schema: Record<string, unknown>; maxOutputTokens?: number }, fetcher: typeof fetch = fetch): Promise<{ text: string; metadata: ProviderMetadata }> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new AdherenceError("not_configured");
  const started = performance.now();
  const signal = AbortSignal.timeout(45000);
  const request = { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, signal,
    body: JSON.stringify({ systemInstruction: { parts: [{ text: input.instructions }] }, contents: [{ role: "user", parts: [{ text: input.data }] }], generationConfig: { responseMimeType: "application/json", responseJsonSchema: input.schema, maxOutputTokens: input.maxOutputTokens ?? 4000 } }) };
  let response: Response | null = null;
  let attempts = 0;
  for (attempts = 1; attempts <= 3; attempts++) {
    try { response = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`, request); }
    catch (error) {
      if (attempts < 3 && !signal.aborted) { await new Promise((resolve) => setTimeout(resolve, 300)); continue; }
      throw new AdherenceError(signal.aborted || error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network", true);
    }
    if (response.ok || attempts === 3 || ![502, 503, 504].includes(response.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  if (!response) throw new AdherenceError("network", true);
  if (!response.ok) throw new AdherenceError(response.status === 401 || response.status === 403 ? "credentials" : response.status === 429 ? "rate_limit" : response.status === 400 || response.status === 404 ? "invalid_configuration" : "provider", response.status >= 500 || response.status === 429);
  const body = await response.json();
  const usage = body.usageMetadata;
  const inputTokens = usage?.promptTokenCount;
  const outputTokens = usage?.candidatesTokenCount;
  const text = body.candidates?.[0]?.content?.parts?.filter((part: { text?: string }) => typeof part.text === "string").map((part: { text: string }) => part.text).join("") ?? "";
  if (!text) throw new AdherenceError("incomplete");
  return { text, metadata: { model: GEMINI_MODEL, durationMs: Math.round(performance.now() - started), attempts, responseId: body.responseId ?? null, requestId: null, usage: Number.isInteger(inputTokens) && Number.isInteger(outputTokens) ? { inputTokens, outputTokens, totalTokens: usage.totalTokenCount ?? inputTokens + outputTokens, cachedInputTokens: usage.cachedContentTokenCount ?? null, reasoningTokens: usage.thoughtsTokenCount ?? null } : null } };
}
