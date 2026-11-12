import type { ErrorCode, ProviderMetadata, SafeFailure } from "./contracts";

export const failureMessages: Record<ErrorCode, string> = {
  not_configured: "IA não configurada. Configure a chave da OpenAI no servidor.",
  invalid_configuration: "A configuração da IA é inválida. Confira o modelo e os limites no servidor.",
  credentials: "A credencial da OpenAI não foi aceita ou não tem permissão para este modelo.",
  quota: "O limite de uso ou saldo da OpenAI foi atingido. Confira a conta antes de tentar novamente.",
  rate_limit: "A OpenAI limitou temporariamente as solicitações. Aguarde antes de tentar novamente.",
  timeout: "A análise excedeu o tempo limite. Você pode tentar novamente.",
  network: "Não foi possível comunicar com o provedor de IA. Tente novamente.",
  provider: "O provedor não conseguiu concluir a análise. Tente novamente mais tarde.",
  refusal: "O modelo recusou esta solicitação. Nenhuma classificação comercial foi atribuída.",
  incomplete: "A resposta do modelo ficou incompleta. Nenhuma classificação comercial foi atribuída.",
  invalid_output: "A resposta recebida não passou pela validação estrutural e não pode ser apresentada como análise.",
  output_too_large: "A resposta excedeu o limite de tamanho e não foi aprovada.",
  input_too_large: "Os dados excedem o limite de entrada. Nenhum texto foi truncado e nenhuma chamada à IA foi feita.",
  interrupted: "A execução anterior foi interrompida ou expirou. Você pode tentar novamente.",
  not_found: "A oportunidade não foi encontrada na base local.",
  stale: "As entradas mudaram. Execute uma nova análise para os dados atuais.",
};
export class AdherenceError extends Error {
  readonly failure: SafeFailure;
  constructor(code: ErrorCode, retryable = false, readonly metadata: ProviderMetadata | null = null) {
    super(failureMessages[code]);
    this.name = "AdherenceError";
    this.failure = { code, retryable };
  }
}
export function safeFailure(error: unknown): SafeFailure {
  return error instanceof AdherenceError ? error.failure : { code: "provider", retryable: true };
}
