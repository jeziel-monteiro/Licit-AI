# Arquitetura e decisões

Este documento registra as decisões das etapas 1 e 2. A implementação posterior da frente de análise individual, suas migrações aditivas e os contratos de integração estão no [handoff de aderência](handoffs/adherence-analysis.md).

Aplicação única Next.js 16, React 19, TypeScript estrito e Tailwind CSS 4. O App Router renderiza páginas no servidor; componentes cliente ficam restritos à navegação ativa e aos formulários com feedback e estado de espera. O layout tem navegação responsiva, link de salto, foco visível, rótulos, tabelas semânticas e tratamento de movimento reduzido. A validação visual está pendente conforme o relatório de checks.

## Organização

| Local | Responsabilidade |
| --- | --- |
| `src/app` | Telas, estados de carregamento/erro, Server Actions e rota do JSON original |
| `src/components` | Navegação, formulários e listas reutilizáveis |
| `src/lib/domain.ts` | Tipos, filtros, perfil, busca e regras de proveniência |
| `src/lib/db.ts` | SQLite, consultas parametrizadas e transações |
| `src/lib/server/store.ts` | Fachada `server-only` para o banco da aplicação |
| `src/lib/pncp` | Esquemas verificados, cliente, normalização e importação |
| `src/lib/analysis.ts` | Contrato da etapa 3, sem implementação de modelo |
| `scripts` | Importação CLI e verificação HTTP local |
| `data/pncp-sample.json` | Amostra real versionada, sempre histórica ao importar arquivo |
| `tests` | Resposta real preservada e testes com dados isolados |

## Persistência

`node:sqlite` foi escolhido porque Node 22.23.2 está disponível e fornece SQLite sem compilar extensões nativas de terceiros. O acesso síncrono é adequado a uma demonstração local de pequeno volume, com limites de importação. Não é uma arquitetura para grande concorrência. O aviso experimental do Node 22 está documentado.

Tabelas:

- `opportunities`: ID oficial como chave primária; projeção de exibição, índices para filtros, hash canônico SHA-256, JSON original e proveniência da última observação.
- `imports`: parâmetros, horários, estado, contadores, total informado pela fonte, limitação e erro de cada execução.
- `import_records`: snapshot de cada oportunidade por importação, com JSON, hash, URL, instante e tipo da origem. Importações repetidas não duplicam a oportunidade, mas mantêm evidências por execução.
- `profile_versions`: snapshots imutáveis e numerados do perfil. A aplicação lê a versão mais recente.
- `selections`: uma linha por oportunidade salva e anotação do usuário; relação por chave estrangeira.
- `schema_migrations`: versão inicial do esquema.

Cada página é validada por completo antes da transação. Uma falha na página seguinte não apaga páginas já confirmadas. Reimportações preservam anotações, seleção e primeira coleta. A comparação de instantes impede que arquivos antigos sobrescrevam observações recentes. Uma amostra no mesmo instante não rebaixa uma coleta ao vivo.

O hash ordena as chaves dos objetos e considera todo o registro original; mudanças em campos não exibidos também invalidam a referência de conteúdo. O JSON normalizado não substitui o original.

## Validação e limites

Zod valida entradas de formulários, filtros, parâmetros de coleta, envelopes da API, registros e arquivos. Campos opcionais permanecem `null`; ausência não vira zero. Sem um ID PNCP válido, a página é rejeitada em vez de inventar uma chave. O status da fonte é preservado sem inferir abertura ou elegibilidade.

SQL usa parâmetros. A pesquisa escapa `%`, `_` e barra invertida e normaliza acentos. O foco em informática utiliza uma função SQLite determinística aplicada apenas à descrição. É uma busca lexical documentada; pode incluir serviços ou itens que ainda precisam de revisão humana. Dados externos são renderizados como texto React, sem HTML arbitrário.

Chamadas ao PNCP têm host fixo, sem URL fornecida pelo navegador, timeout, redirects bloqueados e até duas novas tentativas para falhas transitórias. API e SQLite permanecem no servidor. Os comandos CLI reutilizam o mesmo código de domínio e persistência.

## Preparação para IA

`AnalysisService` define uma operação futura de servidor. O resultado estruturado exige classificação, justificativa, citações da descrição, informações faltantes, modelo, versão do prompt, instante, versão do perfil e hash da oportunidade.

Nenhum resultado é gerado nem persistido nesta fase. A UI informa “Análise com IA ainda não executada”. A implementação futura deverá validar o esquema, o vínculo com as versões e a presença literal das citações no texto analisado. Textos do PNCP e do perfil são dados não confiáveis, nunca instruções. Conclusões sobre anexos e requisitos não consultados ficam fora da análise.

## Limitações conhecidas

- Uma empresa demonstrativa, sem autenticação ou isolamento por cliente; execução apenas local.
- Sem leitura de anexos, itens, editais em PDF ou requisitos de habilitação.
- Sem análise com IA, exportação, envio de propostas, agendamento ou publicação.
- Coletas parciais por modalidade/período, sem sincronização contínua, detecção de remoções ou garantia de ordenação estável na fonte.
- Uma coleta interrompida pelo encerramento do processo pode continuar marcada “Em andamento”; não há fila de trabalhos nem recuperação automática de jobs nesta fase.
- O arquivo JSON precisa caber na memória. Seu limite validado é de 5.000 registros; não há upload pela interface.
- Precisão numérica do SQLite/JavaScript é usada apenas para filtros e exibição de valores estimados; não para cálculos contábeis.
- Mudanças futuras na API podem exigir revisão do esquema. Falhas de validação ficam explícitas e não são substituídas por dados sintéticos.
