# Verificação da frente de aderência — 12/11/2026

Branch: `opportunity-analysis`. Ambiente: Node.js 22.23.2, npm 10.9.8, Linux.

## Checks executados

| Verificação | Resultado |
| --- | --- |
| `npm run typecheck` | Passou |
| `npm run lint` | Passou, sem avisos |
| Test runner existente, com reporter `spec` | **84 testes passaram**, zero falhas e zero ignorados |
| `npm run build` | Passou: produção compilada com Webpack |
| `npm run smoke -- --url http://127.0.0.1:3001` | 12 verificações HTTP passaram no build de produção |
| Verificação HTTP específica sem chave | Estado “IA não configurada” visível; botão de análise desabilitado |
| Leitura de lista/detalhes | Nenhuma execução de análise criada; perfil e estatísticas locais preservados |
| Banco local | 200 oportunidades existentes preservadas; migração adicionou somente as tabelas da funcionalidade |
| `npm run eval:adherence` | Cinco casos reais apresentados como propostas pendentes; nenhuma chamada externa |
| Instalação do SDK e auditoria npm | SDK 7.56.0 instalado; zero vulnerabilidades conhecidas reportadas |
| Verificação dos chunks cliente compilados | Endpoint/SDK OpenAI e chave simulada de teste não apareceram nos chunks cliente |
| `git diff --check` | Passou |

Os testes existentes foram mantidos. Foram adicionados 50 testes desta frente, incluindo casos de integração por interfaces e renderização de conteúdo de servidor.

## Cobertura da frente

- Configuração ausente/inválida, Responses API estruturado via SDK oficial e metadados disponíveis/ausentes.
- Timeout real do SDK contra transporte simulado, abort, falhas de rede, credencial inválida, modelo inválido, saldo, rate limit, Retry-After e limite de tentativas sem multiplicação no SDK.
- Recusa, resposta incompleta, JSON inválido, campos inválidos e limites de entrada/saída.
- Validador aprovado, rejeitado, indisponível, com exceção ou resposta incompatível, somente com simuladores nos testes.
- Migração aditiva, snapshots, persistência em arquivo, reabertura e preservação das tabelas/dados anteriores.
- Reutilização, invalidação por perfil/conteúdo/prompt/modelo/esquema/configuração relevante e ausência de invalidação por coleta/metadados não analisados.
- Duas conexões SQLite, prevenção de duplicidade, expiração de execução interrompida e bloqueio de respostas tardias de workers antigos.
- Revalidação posterior sem nova chamada e recusa de revalidação para entradas desatualizadas.
- Metadados para o registrador compartilhado e isolamento de falhas desse registrador.
- Separação entre instruções e dados não confiáveis; mensagens técnicas sem conteúdo privado do erro externo.
- Indicadores de lista e detalhes para resultados preliminares, válidos, desatualizados, rejeitados, falhos e sem configuração; escape de texto do modelo.
- Ausência de execução automática ao consultar detalhes/listagem.
- Os cinco casos de avaliação correspondem a IDs e descrições reais da amostra e mantêm propostas não revisadas.

As simulações verificam comportamento do software. Não verificam qualidade, resistência efetiva do modelo a ataques nem precisão de classificação.

## Limitações verificadas

Não havia `OPENAI_API_KEY` configurada. Não foram feitas chamadas reais à OpenAI; a integração externa ainda precisa ser validada com credencial. O modelo de configuração inicial vem da documentação atual, sem confirmação de acesso na conta. O comando real de avaliação está preparado para até cinco gerações com os limites/retries configurados.

O navegador retornou `The browser access host is unavailable`. Não foram executados screenshots, revisão visual responsiva, teste de teclado ou interação ponta a ponta no navegador. O render de servidor e os testes HTTP não substituem essas verificações.

As integrações dos colegas permanecem ausentes na aplicação: saída estruturalmente válida fica preliminar até validação semântica real. Não há painel de evidências, revisão humana, resumo ou exportação implementados por esta frente. O esquema adicional de critérios, o significado do hash relevante e o namespace da migração precisam de alinhamento conforme `adherence-analysis.md`.
