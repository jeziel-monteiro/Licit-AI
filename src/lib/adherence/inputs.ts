import { createHash } from "node:crypto";
import type { Opportunity, Profile } from "../domain";
import type { InputIdentity, ProviderSettings } from "./contracts";

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
export const contentHash = (value: unknown): string => createHash("sha256").update(canonicalJson(value)).digest("hex");
export function prepareInputs(profile: Profile, item: Opportunity, settings: ProviderSettings, prompt: { version: string; instructions: string }, schemaVersion: string, schemaHash: string): InputIdentity {
  const inputs = {
    profile: { version: profile.version, name: profile.name, description: profile.description, interestTerms: [...profile.interestTerms], exclusionTerms: [...profile.exclusionTerms], uf: profile.uf },
    opportunity: { id: item.id, description: item.description, additionalInformation: item.additionalInformation, agency: item.agency, city: item.city, uf: item.uf, modality: item.modality, estimatedValue: item.estimatedValue, publishedAt: item.publishedAt, proposalsStartAt: item.proposalsStartAt, proposalsEndAt: item.proposalsEndAt, sourceStatus: item.sourceStatus },
  };
  const profileHash = contentHash(inputs.profile);
  const opportunityHash = contentHash(inputs.opportunity);
  const inputBytes = Buffer.byteLength(canonicalJson(inputs), "utf8") + Buffer.byteLength(prompt.instructions, "utf8");
  return {
    inputs, profileHash, opportunityHash, inputBytes, limitations: [],
    inputHash: contentHash({ inputs, promptVersion: prompt.version, promptHash: contentHash(prompt.instructions), schemaVersion, schemaHash, configuration: { provider: settings.provider, model: settings.model, maxOutputTokens: settings.maxOutputTokens, maxInputBytes: settings.maxInputBytes, inputPolicy: "reject-without-truncation.v1" } }),
    sourceRecordHash: item.recordHash, sourceCollectedAt: item.collectedAt, sourceUrl: item.sourceUrl,
  };
}
