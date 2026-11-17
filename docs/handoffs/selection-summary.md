# Handoff — resumo das oportunidades selecionadas

Branch `feat/selection-summary`. Com `GEMINI_API_KEY` em `.env.local`, a aplicação usa `gemini-3.1-flash-lite` para a análise individual e para o resumo. A chave não é enviada ao navegador nem versionada. Sem essa chave, a análise individual ainda pode usar a configuração OpenAI anterior; o resumo requer Gemini. A integração usa a API `generateContent` com JSON estruturado e valida o resultado novamente no servidor.

## Fluxo

Na página `/selecionadas`, a pessoa salva até 50 oportunidades e solicita um resumo. `SelectionSummaryService` lê dados estruturados, anotações e somente análises atuais com evidências aprovadas. Análise ausente ou desatualizada entra como `null`. O prompt `selection-summary.v2` proíbe ranking sem critérios, certezas sobre lacunas, cópia de valores/datas e mistura de identificadores. A resposta tem um resumo geral e exatamente um ponto de atenção por ID. IDs inventados, omitidos ou repetidos impedem a gravação. Sem nenhuma análise aprovada, o servidor substitui o texto geral por uma mensagem cautelosa.

O SQLite guarda cada versão do resumo com hash da seleção, do perfil, das análises, do prompt e do modelo. Mudanças nessas entradas sinalizam resumo desatualizado; o botão gera nova versão. O resumo salvo permanece como histórico. A tela mostra fontes PNCP e os valores/datas diretamente dos registros, sem copiá-los da prosa do modelo. O CSV exporta esses dados estruturados, com neutralização de fórmulas de planilha; a cópia em texto inclui os links das fontes.

`ai_executions` registra operação, duração, uso de tokens quando disponível e código de falha, sem prompt, resposta ou chave. O registro é compartilhado com a análise de aderência. A migração é aditiva: seleções e análises anteriores continuam intactas.

## Verificação e limites

`npm run check` passou com 103 testes, lint, typecheck e build; `npm run smoke` passou 12/12. Um teste real com duas oportunidades da amostra PNCP gerou e persistiu um resumo via Gemini em banco temporário. Um navegador confirmou dois pontos por ID, cópia em texto com links e download CSV. Em 390 px, não houve rolagem horizontal; editar uma anotação tornou o resumo desatualizado e o CSV retornou 409. `tests/summary.test.ts` cobre persistência, invalidação, IDs trocados/omitidos e CSV. Os cinco casos em `docs/evaluations/selection-summary-cases.json` estão prontos para revisão humana; ainda não medem precisão. Citação de ID correta não comprova que o ponto de atenção é verdadeiro: a pessoa deve abrir a fonte antes de usar o texto.

Falha corrigida durante a implementação: a consulta inicial herdou o filtro padrão do setor de informática, ocultando oportunidades selecionadas de outros setores. O resumo agora consulta todas as selecionadas com `sector: ""`.
Na demonstração, o modelo sugeriu alinhamento comercial mesmo sem análises aprovadas; a mensagem geral agora é produzida pelo servidor nesse estado. Os pontos por ID permanecem preliminares e exigem conferência humana.

Pendente com a equipe: avaliação cruzada dos casos, revisão de código e medição da tarefa de preparar o resumo.
Uma revisão técnica assistida dos cinco casos do colega 1 está em `docs/evaluations/evidence-peer-review.md`; ela encontrou e corrigiu uma mensagem enganosa para o estado sem citação. A revisão humana continua pendente.
O vídeo `artifacts/selection-summary-demo.mp4` mostra o fluxo no navegador usando uma resposta real da API em banco temporário. O roteiro de medição, ainda sem participantes, está em `docs/evaluations/summary-measurement.md`.
