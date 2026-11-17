import "server-only";
import { getStore } from "./store";
import { OpenAIAdherenceProvider } from "../adherence/openai-provider";
import { GeminiAdherenceProvider } from "../adherence/gemini-provider";
import { ExecutionLog } from "./executions";
import { AdherenceRepository } from "../adherence/repository";
import { OpportunityAdherenceService, type AdherenceIntegrations } from "../adherence/service";
import { evidencePrompt } from "../adherence/evidence-prompt";
import { evidenceValidator } from "../adherence/evidence";

// Único ponto de composição da aplicação. Colegas integram os adaptadores reais aqui.
export function createAdherenceService(integrations: AdherenceIntegrations = {}): OpportunityAdherenceService {
  const store = getStore();
  return new OpportunityAdherenceService(new AdherenceRepository(store), process.env.GEMINI_API_KEY ? new GeminiAdherenceProvider() : new OpenAIAdherenceProvider(), { evidencePrompt, evidenceValidator, executionRecorder: new ExecutionLog(store), ...integrations });
}
