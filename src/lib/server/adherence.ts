import "server-only";
import { getStore } from "./store";
import { OpenAIAdherenceProvider } from "../adherence/openai-provider";
import { AdherenceRepository } from "../adherence/repository";
import { OpportunityAdherenceService, type AdherenceIntegrations } from "../adherence/service";

// Único ponto de composição da aplicação. Colegas integram os adaptadores reais aqui.
export function createAdherenceService(integrations: AdherenceIntegrations = {}): OpportunityAdherenceService {
  return new OpportunityAdherenceService(new AdherenceRepository(getStore()), new OpenAIAdherenceProvider(), integrations);
}
