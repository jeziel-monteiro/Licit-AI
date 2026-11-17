import { z } from "zod";
import { modelOutputSchema, type AdherenceProvider, type ProviderReply } from "./contracts";
import { generateGemini, GEMINI_MODEL } from "../server/gemini";

const { $schema: _schema, ...jsonSchema } = z.toJSONSchema(modelOutputSchema);
void _schema;
export class GeminiAdherenceProvider implements AdherenceProvider {
  readonly configured = Boolean(process.env.GEMINI_API_KEY?.trim());
  readonly configurationFailure = this.configured ? null : "not_configured" as const;
  readonly settings = { provider: "gemini" as const, model: GEMINI_MODEL, maxOutputTokens: 4000, maxInputBytes: 24000, timeoutMs: 45000, deadlineMs: 45000, maxRetries: 0 };
  async generate(input: { instructions: string; data: string }): Promise<ProviderReply> {
    const { text, metadata } = await generateGemini({ ...input, schema: jsonSchema, maxOutputTokens: this.settings.maxOutputTokens });
    return { text, metadata, disposition: "completed" };
  }
}
