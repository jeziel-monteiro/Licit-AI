# Próximas etapas

## Etapa 3 — análise com IA

- [ ] Escolher provedor/modelo, custos e limites antes de adicionar um SDK.
- [ ] Implementar `AnalysisService` exclusivamente no servidor, com credencial em variável de ambiente sem prefixo público.
- [ ] Separar instruções do sistema de textos externos. Perfil e descrição são dados, inclusive quando contêm instruções maliciosas.
- [ ] Versionar o prompt e vincular cada resultado a `profileVersion`, `opportunityId` e `opportunityHash`.
- [ ] Validar a saída com `analysisResultSchema`; rejeitar classificações fora do domínio e evidências que não existam literalmente na descrição.
- [ ] Registrar modelo, data, justificativa e informações faltantes. Não concluir sobre anexos ou requisitos não consultados.
- [ ] Criar avaliações com casos reais revisados por humano, casos de informação insuficiente e ataques de instruções no texto externo.
- [ ] Adicionar estados de execução, erro, resultado desatualizado e revisão humana. Não executar automaticamente ao abrir uma tela.
- [ ] Medir qualidade e custo; métricas de economia de tempo e impacto comercial ficam para medição posterior.

## Qualidade e continuidade

- [ ] Concluir revisão visual em desktop e celular e testar o fluxo com teclado em navegador disponível.
- [ ] Automatizar o fluxo de salvar, anotar, recarregar e remover no navegador.
- [ ] Ampliar coleta com escolha explícita de modalidades, estratégia de atualização e recuperação de execuções interrompidas.
- [ ] Decidir quando consultar itens/anexos, com rastreabilidade própria e limites de escopo.
- [ ] Implementar exportação das selecionadas com fontes, datas e anotações.
- [ ] Antes de publicação: definir hospedagem Node/SQLite, persistência, backups, autenticação e proteção de acesso. Não publicar esta demonstração sem esse desenho.
- [ ] Atualizar o ESLint quando todos os plugins do Next.js declararem suporte à versão atual, removendo o override transitivo quando o upstream corrigir a dependência.
