import { z } from "zod";
import { analysisResultSchema, type AnalysisResult } from "../analysis";
import type { Opportunity, Profile } from "../domain";

// Proposta isolada v1; o esquema compartilhado continua pertencendo ao colega 1.
export const OUTPUT_SCHEMA_VERSION = "adherence-proposal.v1";
export const modelOutputSchema = analysisResultSchema.pick({
  classification: true, justification: true, evidence: true, missingInformation: true,
}).extend({
  matchedCriteria: z.array(z.string().min(1).max(600)).max(10),
  conflictingCriteria: z.array(z.string().min(1).max(600)).max(10),
}).strict();
export type ModelOutput = z.infer<typeof modelOutputSchema>;
export type AdherenceResult = AnalysisResult & Pick<ModelOutput, "matchedCriteria" | "conflictingCriteria">;

export type ProfileSnapshot = Pick<Profile, "version" | "name" | "description" | "interestTerms" | "exclusionTerms" | "uf">;
export type OpportunitySnapshot = Pick<Opportunity, "id" | "description" | "additionalInformation" | "agency" | "city" | "uf" | "modality" | "estimatedValue" | "publishedAt" | "proposalsStartAt" | "proposalsEndAt" | "sourceStatus">;
export type AnalysisInputs = { profile: ProfileSnapshot; opportunity: OpportunitySnapshot };
export type InputIdentity = {
  inputHash: string; profileHash: string; opportunityHash: string;
  sourceRecordHash: string; sourceCollectedAt: string; sourceUrl: string;
  inputs: AnalysisInputs; inputBytes: number; limitations: string[];
};
export type ProviderSettings = {
  provider: "openai"; model: string; maxOutputTokens: number; maxInputBytes: number;
  timeoutMs: number; deadlineMs: number; maxRetries: number;
};
export type TokenUsage = { inputTokens: number; outputTokens: number; totalTokens: number; cachedInputTokens: number | null; reasoningTokens: number | null };
export type ProviderMetadata = {
  model: string; durationMs: number; attempts: number; usage: TokenUsage | null;
  responseId: string | null; requestId: string | null;
};
export type ErrorCode = "not_configured" | "invalid_configuration" | "credentials" | "quota" | "rate_limit" | "timeout" | "network" | "provider" | "refusal" | "incomplete" | "invalid_output" | "output_too_large" | "input_too_large" | "interrupted" | "not_found" | "stale";
export type SafeFailure = { code: ErrorCode; retryable: boolean };
export type ProviderReply = { text: string; metadata: ProviderMetadata; disposition: "completed" | "refused" | "incomplete" };
export interface AdherenceProvider {
  readonly configured: boolean;
  readonly configurationFailure?: "not_configured" | "invalid_configuration" | null;
  readonly settings: ProviderSettings;
  generate(input: { instructions: string; data: string }): Promise<ProviderReply>;
}

export type SemanticDecision = { status: "approved" | "rejected" | "unavailable"; codes: string[] };
export interface EvidenceValidator {
  readonly version: string;
  validate(input: { analysisId: string; inputs: AnalysisInputs; result: AdherenceResult }): Promise<SemanticDecision>;
}
export type EvidencePromptSection = { version: string; instructions: string };
export type AnalysisStatus = "processing" | "pending_validation" | "validated" | "rejected" | "failed";
export type AnalysisRecord = {
  id: string; opportunityId: string; inputHash: string; identity: InputIdentity;
  settings: ProviderSettings; promptVersion: string; schemaVersion: string;
  status: AnalysisStatus; startedAt: string; finishedAt: string | null;
  responseReceivedAt: string | null; structurallyValidatedAt: string | null; evidenceValidatedAt: string | null;
  rawResponse: string | null; rawResponseLimited: boolean; result: AdherenceResult | null;
  metadata: ProviderMetadata | null; failure: SafeFailure | null;
  validation: { version: string | null; status: "pending" | "approved" | "rejected"; codes: string[] };
};

// Handoff para o colega 2: sem tabela/serviço concorrente de telemetria.
export type ExecutionEvent = {
  eventId: string; analysisId: string; operation: "adherence"; phase: "generation" | "revalidation";
  opportunityId: string; inputHash: string; status: AnalysisStatus;
  startedAt: string; finishedAt: string; durationMs: number;
  requestedModel: string; providerMetadata: ProviderMetadata | null; failure: SafeFailure | null;
};
export interface ExecutionRecorder { record(event: ExecutionEvent): Promise<void> }
export type AnalysisState = "not_configured" | "not_analyzed" | "processing" | "pending_validation" | "validated" | "rejected" | "failed" | "stale";
export type AnalysisView = {
  state: AnalysisState; configured: boolean; canValidate: boolean;
  analysisId: string | null; analyzedAt: string | null;
  result: Pick<AdherenceResult, "classification" | "justification" | "matchedCriteria" | "conflictingCriteria" | "model"> | null;
  failure: SafeFailure | null;
  stages: { responseReceived: boolean; structureApproved: boolean; evidenceApproved: boolean };
};
