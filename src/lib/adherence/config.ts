import { z } from "zod";
import type { ProviderSettings } from "./contracts";

const configurationSchema = z.object({
  model: z.string().trim().min(1).max(150).regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/),
  maxOutputTokens: z.coerce.number().int().min(512).max(8000),
  maxInputBytes: z.coerce.number().int().min(4000).max(64000),
  timeoutMs: z.coerce.number().int().min(100).max(60000),
  deadlineMs: z.coerce.number().int().min(1000).max(120000),
  maxRetries: z.coerce.number().int().min(0).max(2),
}).refine((v) => v.deadlineMs >= v.timeoutMs);
export type OpenAIConfiguration = { apiKey: string | null; valid: boolean; settings: ProviderSettings };
export function readOpenAIConfiguration(env: Readonly<Record<string, string | undefined>> = process.env): OpenAIConfiguration {
  const defaults: ProviderSettings = { provider: "openai", model: "gpt-5.6-terra", maxOutputTokens: 4000, maxInputBytes: 24000, timeoutMs: 20000, deadlineMs: 45000, maxRetries: 1 };
  const parsed = configurationSchema.safeParse({
    model: env.OPENAI_MODEL ?? defaults.model,
    maxOutputTokens: env.OPENAI_MAX_OUTPUT_TOKENS ?? defaults.maxOutputTokens,
    maxInputBytes: env.OPENAI_MAX_INPUT_BYTES ?? defaults.maxInputBytes,
    timeoutMs: env.OPENAI_TIMEOUT_MS ?? defaults.timeoutMs,
    deadlineMs: env.OPENAI_DEADLINE_MS ?? defaults.deadlineMs,
    maxRetries: env.OPENAI_MAX_RETRIES ?? defaults.maxRetries,
  });
  return { apiKey: env.OPENAI_API_KEY?.trim() || null, valid: parsed.success, settings: parsed.success ? { provider: "openai", ...parsed.data } : defaults };
}
