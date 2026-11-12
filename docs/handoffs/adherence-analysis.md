# Handoff — análise individual de aderência

Implementação da frente `opportunity-analysis`. Sem commits ou push automáticos. As responsabilidades dos colegas permanecem separadas: **não há validador semântico, painel de evidências, registro de revisão humana, resumo comercial, exportação ou subsistema compartilhado de telemetria nesta implementação**.

O código compartilhado de `src/lib/analysis.ts` e as tabelas existentes de perfil, oportunidades, importações e seleções foram preservados. Os novos módulos reutilizam `AnalysisResult` e `analysisResultSchema`. O serviço por ID tem retorno próprio para representar pendência/falha, estados que a antiga interface `AnalysisService.analyze(AnalysisRequest): Promise<AnalysisResult>` não consegue expressar. A adaptação dessa interface é uma decisão da equipe, não uma alteração silenciosa nesta branch.

## Executar e configurar

```bash
npm ci
# Atualize seu .env local com os campos novos de .env.example.
# Não sobrescreva um .env que já contenha configurações suas.
npm run dev
```

| Variável | Padrão / finalidade |
| --- | --- |
| `OPENAI_API_KEY` | Sem padrão; somente no servidor, sem prefixo `NEXT_PUBLIC_` |
| `OPENAI_MODEL` | `gpt-5.6-terra`; substituir pelo modelo autorizado para a conta/equipe |
| `OPENAI_TIMEOUT_MS` | 20.000 por tentativa, entre 100 e 60.000 |
| `OPENAI_DEADLINE_MS` | 45.000 para toda a chamada, entre 1.000 e 120.000, maior ou igual ao timeout |
| `OPENAI_MAX_RETRIES` | 1 nova tentativa; aceita 0–2 |
| `OPENAI_MAX_INPUT_BYTES` | 24.000 bytes UTF-8 de instruções + dados; aceita 4.000–64.000 |
| `OPENAI_MAX_OUTPUT_TOKENS` | 4.000; aceita 512–8.000 |

Sem chave, a aplicação mostra **“IA não configurada”**. Configuração inválida impede chamadas. Nenhum segredo é serializado para componentes cliente ou incluído em mensagens de erro. A fachada da aplicação tem `server-only`; SDK, persistência e preparação de hashes executam em Node.js. O adaptador mantém o endpoint oficial fixo e os logs do SDK desabilitados.

Foi usado o SDK oficial `openai` 7.56.0, com Responses API, `text.format` gerado por `zodTextFormat`, `store: false`, nenhuma ferramenta e `tool_choice: "none"`. O adaptador recebe o texto antes de validá-lo localmente; assim, preserva a distinção entre recebimento e validação estrutural. Recusas, respostas incompletas, erros de credencial, saldo, rate limit, rede e timeout têm estados técnicos próprios, nunca classificações comerciais.

Referências oficiais consultadas: [saída estruturada](https://developers.openai.com/api/docs/guides/structured-outputs), [SDK TypeScript](https://developers.openai.com/api/reference/typescript), [limites e recuperação](https://developers.openai.com/api/docs/guides/rate-limits) e [modelo configurado inicialmente](https://developers.openai.com/api/docs/models/gpt-5.6-terra). Suporte documentado não comprova acesso da conta nem validação externa desta implementação.

Retries automáticos do SDK ficam desativados; o adaptador controla o limite para não multiplicar chamadas. Repete somente falhas transitórias e não repete saldo esgotado, credencial inválida ou configuração inválida. Um `Retry-After` acima de 2 segundos é devolvido como falha temporária, sem repetir antes do prazo. O deadline total também limita espera e tentativas.

## Funções e tipos fornecidos

| Arquivo | Interface |
| --- | --- |
| `src/lib/server/adherence.ts` | `createAdherenceService(integrations?)`, único ponto de composição da aplicação |
| `src/lib/adherence/openai-provider.ts` | `OpenAIAdherenceProvider`, adaptador do SDK com metadados e falhas seguras |
| `src/lib/adherence/service.ts` | `OpportunityAdherenceService`, `AdherenceIntegrations` |
| `src/lib/adherence/repository.ts` | `AdherenceRepository`, acesso a resultados, histórico e bloqueios |
| `src/lib/adherence/inputs.ts` | `prepareInputs`, `contentHash`, `canonicalJson` |
| `src/lib/adherence/prompt.ts` | `CLASSIFICATION_PROMPT_VERSION`, `CLASSIFICATION_INSTRUCTIONS`, `composePrompt` |
| `src/lib/adherence/contracts.ts` | `AnalysisInputs`, `InputIdentity`, `AdherenceResult`, `AnalysisRecord`, `AnalysisView`, interfaces de integração |
| `src/components/adherence/panel.tsx` | `AdherencePanel`, componente isolado com `children` como ponto de composição |
| `src/components/adherence/view.tsx` | `AnalysisStatusBadge`, `AdherenceContent` |

Métodos do serviço:

```ts
getView(opportunityId: string): AnalysisView
getViews(opportunities: Opportunity[]): Record<string, AnalysisView>
analyze(opportunityId: string): Promise<AnalysisView>
revalidate(opportunityId: string, analysisId: string): Promise<AnalysisView>
```

`analyze` carrega perfil e oportunidade persistidos no servidor. O navegador fornece somente identificadores e a operação. A Server Action em `src/app/oportunidades/[id]/analysis-actions.ts` valida esses identificadores e revalida as páginas após a operação. Leituras de páginas e polling de estado **não iniciam chamadas ao modelo**.

## Colega 1 — saída, evidências e revisão

### Proposta mínima de saída, pendente de alinhamento

`modelOutputSchema` usa `analysisResultSchema.pick(...)` para classificação, justificativa, evidências e informações faltantes. Acrescenta apenas os campos que esta frente precisa: `matchedCriteria: string[]` e `conflictingCriteria: string[]`. A versão local é `adherence-proposal.v1`. **Não substitui o contrato definitivo do colega 1.**

Identificadores, hashes, modelo, versão de perfil, data e versão do prompt são acrescentados pelo servidor. O modelo não pode escolher esses valores. `AdherenceResult` contém os campos existentes de `AnalysisResult` mais as duas listas de critérios. A validação local é estrutural e de limites, sem verificar se as evidências estão de fato no texto.

### Adaptador esperado

```ts
interface EvidenceValidator {
  readonly version: string;
  validate(input: {
    analysisId: string;
    inputs: AnalysisInputs;
    result: AdherenceResult;
  }): Promise<{
    status: "approved" | "rejected" | "unavailable";
    codes: string[];
  }>;
}
```

`codes` admite até 20 códigos estáveis no formato `[a-z][a-z0-9_.-]{0,63}`, por exemplo `evidence_not_found`. Não envie mensagens de exceção ou segredos nesse campo. Exceção, resposta incompatível ou prazo acima de 5 segundos mantêm a análise pendente. Não existe adaptador que aprove tudo na aplicação; os aprovadores simulados aparecem apenas nos testes.

`inputs.opportunity.description` contém a descrição original analisada. `additionalInformation` também está disponível, mas o contrato compartilhado atual só permite `field: "description"` nas evidências. A equipe precisa decidir como ampliar isso antes de citar outros campos. Nenhum texto de entrada é truncado: entradas excessivas são rejeitadas antes da API. Os campos disponíveis no snapshot são a totalidade dos dados consultados; não há leitura de anexos.

A seção futura do prompt do colega 1 pode ser composta como:

```ts
type EvidencePromptSection = { version: string; instructions: string };
const service = createAdherenceService({
  evidenceValidator, // implementação real fornecida pelo colega 1
  evidencePrompt: { version: "evidence.v1", instructions: evidenceInstructions },
});
```

Integre os adaptadores reais no ponto de composição `src/lib/server/adherence.ts`, para que as leituras de lista, detalhes e ações usem as mesmas versões. As instruções de classificação permanecem em módulo separado. Quando a seção de evidências não existe, o prompt pede listas vazias nesses campos e o resultado fica preliminar. Adicionar ou alterar a seção muda o hash do prompt e exige geração para as novas instruções. Disponibilizar apenas um validador para uma resposta existente permite revalidá-la sem nova chamada.

O painel isolado aceita `children`; o colega 1 pode compor seus painéis de evidências e revisão usando `analysisId`. `AdherenceRepository.get(id)` fornece resultado completo e snapshot somente no servidor; `AnalysisView` enviado ao cliente não contém resposta bruta, snapshots ou evidências. Esta frente não define banco nem controles de revisão humana. “Validada” aqui significa estrutura + validação de evidências aprovadas; **não significa revisão humana concluída**.

## Colega 2 — registro compartilhado de execuções

```ts
interface ExecutionRecorder {
  record(event: ExecutionEvent): Promise<void>;
}
```

`ExecutionEvent` contém `eventId`, `analysisId`, `operation: "adherence"`, `phase: "generation" | "revalidation"`, `opportunityId`, `inputHash`, estado, início, fim, duração, modelo solicitado, metadados do provedor e falha segura. `ProviderMetadata` inclui modelo retornado, duração da chamada, número de tentativas, response ID, request ID e tokens de entrada/saída/total, cache e raciocínio quando disponíveis. Ausência permanece `null`, não zero inventado.

O evento não contém prompts, descrição, justificativa, perfil ou chave. Forneça `executionRecorder` na mesma composição do servidor. A chamada tem limite de 2 segundos, é best effort e não altera o resultado comercial caso o registrador falhe. Não há fila, tabela genérica de execuções ou retry de entrega concorrente ao trabalho do colega 2. Metadados necessários continuam no registro da análise; podem ser consultados posteriormente pelo ID. O colega 2 deve definir entrega durável/deduplicação no seu componente, se necessário.

Uma reutilização válida não cria outra execução do provedor nem outro evento de geração. Uma revalidação gera evento próprio com `phase: "revalidation"`, preservando os metadados da chamada original. Não foram implementados resumo das selecionadas nem exportação; na tela Selecionadas mudou somente o indicador de estado para não afirmar incorretamente que uma análise existente nunca foi executada.

## Persistência, migração e reutilização

A migração em `src/lib/adherence/migrations/001-adherence.ts` é aplicada automaticamente pelo construtor de `AdherenceRepository`, na primeira leitura/execução da funcionalidade. Cria somente `adherence_analyses`, `adherence_locks` e `adherence_migrations`, com índices e relações com oportunidades existentes. Não altera a migração compartilhada 1, não apaga tabelas e não recria o banco. O namespace próprio evita disputar um número de migração com as outras branches; a consolidação desse registro é uma decisão de integração da equipe.

Não é necessário executar um comando destrutivo para migrar. Atualize as dependências, inicie a aplicação e abra a lista ou os detalhes. A migração é transacional, aditiva e idempotente. Os testes verificam que perfil, versões, oportunidades, seleção e anotação permanecem intactos.

Cada registro preserva:

- Snapshot exato do perfil, incluindo versão, e projeção dos campos relevantes da oportunidade.
- `inputHash`, `profileHash` e `opportunityHash` determinísticos, versão/hash do prompt e do esquema e configuração relevante.
- Hash do registro original, URL da coleta e instante da coleta como proveniência separada.
- Resposta bruta, resultado estrutural, decisão de validação, falha segura e metadados da chamada.
- Instantes separados de recebimento, validação estrutural e avaliação de evidências.

**Decisão para confirmar:** `AnalysisResult.opportunityHash` nesta frente é o hash da projeção relevante analisada. O hash integral original permanece em `identity.sourceRecordHash`. Isso evita invalidar análises quando só mudam metadados não utilizados. Data da coleta, URL da coleta, anotações, seleção e data de alteração do perfil não entram no hash; versão e conteúdo do perfil entram. Campos de negócio efetivamente enviados, incluindo prazos, entram no hash. O prompt proíbe confundir prazo vencido com incompatibilidade comercial.

O fingerprint inclui modelo solicitado, limite de saída e política/limite de entrada. Timeout/retries não alteram o conteúdo da análise e ficam nos metadados da execução. Mudar prompt, esquema, perfil, dados relevantes, modelo ou configuração relevante torna o resultado desatualizado. Mudar somente coleta não o invalida.

Estados persistidos: `processing`, `pending_validation`, `validated`, `rejected`, `failed`. A interface distingue adicionalmente `not_configured`, `not_analyzed` e `stale`. Somente resultado atual, estruturalmente aprovado e aprovado nas evidências é classificação final reutilizável. Pendência nunca é sucesso final. Falha técnica nunca é classificação comercial. Uma resposta pendente é preservada sem repetir desnecessariamente a geração.

Há um bloqueio SQLite por oportunidade, com token de posse e expiração em `deadline + 15 segundos`. Respostas de workers antigos não podem substituir uma execução mais nova. Leituras e novas solicitações recuperam bloqueios expirados; não há worker em segundo plano. Se o processo cair durante a chamada, a próxima leitura após o prazo marca a execução como interrompida. Se cair após a estrutura ter sido aprovada, o resultado continua pendente e pode ser revalidado. A nova tentativa preserva o registro antigo.

Saídas acima de 32.000 caracteres são rejeitadas; apenas o prefixo bruto limitado é preservado, com `rawResponseLimited: true`. Isso é limitação explícita do armazenamento da resposta, não truncamento silencioso das entradas nem aceitação de uma análise parcial.

## Exemplos

Entrada de uma ação: `id=57522468000163-1-000227/2026`, `operation=analyze`. O servidor consulta o perfil salvo e o registro cujo objeto real é “- Aquisição de computadores”. Não recebe um perfil alternativo do navegador.

Exemplo **ilustrativo/simulado**, sem valor de avaliação do modelo:

```json
{
  "classification": "possivel_aderencia",
  "justification": "EXEMPLO SIMULADO: computadores fazem parte do catálogo descrito.",
  "matchedCriteria": ["Produto declarado no perfil"],
  "conflictingCriteria": [],
  "evidence": [],
  "missingInformation": []
}
```

Sem o validador, esse objeto só poderia gerar `pending_validation`, com as etapas `{ responseReceived: true, structureApproved: true, evidenceApproved: false }`. Para revalidar depois: `service.revalidate(opportunityId, analysisId)`. Essa operação recusa entradas desatualizadas e não chama o provedor.

## Avaliação e verificações

Os cinco casos em `docs/evaluations/adherence-cases.json` são registros reais da amostra preservada do PNCP. Incluem compatibilidade clara, incompatibilidade clara, exclusão explícita, descrição insuficiente e ambiguidade de catálogo. Todas as classificações propostas estão marcadas `pending_human_review`; não são gabarito aprovado.

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run smoke -- --url http://127.0.0.1:3001 # com o servidor ativo nessa porta
npm run eval:adherence                      # apenas lista casos, sem custo
npm run eval:adherence -- --run              # até 5 gerações reais, exige chave
```

O comando real usa perfil demonstrativo e banco temporário isolado, não altera a seleção do banco local e preserva resultados/metadados em `data/adherence-evaluations/`, ignorado pelo Git. Cada geração pode ter a tentativa adicional configurada; para limitar a cinco requisições HTTP totais, use `OPENAI_MAX_RETRIES=0`. Não declara precisão com essa amostra. As simulações dos testes verificam o software, não qualidade do modelo.

Nesta implementação não havia credencial disponível. **A integração externa ainda não foi validada por chamada real.** O relatório específico de checks desta frente está em `docs/handoffs/adherence-validation.md`.

## Decisões pendentes da equipe

1. Confirmar extensão de critérios e versão do esquema compartilhado; substituir a proposta local de forma coordenada.
2. Confirmar semântica de `opportunityHash` e o uso de `sourceRecordHash` para rastreabilidade integral.
3. Fornecer validador semântico real, sua versão e a seção de prompt de evidências; decidir campos citáveis adicionais.
4. Compor painel de evidências e revisão humana usando o ID da análise, sem confundir validação de evidências com revisão humana.
5. Conectar o registro de execuções e sua política de entrega/deduplicação; esta frente fornece eventos e metadados.
6. Confirmar modelo disponível, limites e orçamento da conta. Executar e revisar humanamente os cinco casos antes de afirmar qualidade.
7. Consolidar o namespace da migração e a evolução do contrato de serviço no merge das três frentes.
