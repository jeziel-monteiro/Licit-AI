# Verificação executada em 12/11/2026

Ambiente: Node.js 22.23.2, npm 10.9.8, Linux. Não foram feitos deploy nem chamadas a modelos de IA.

## Checks de código

| Verificação | Resultado |
| --- | --- |
| `npm run typecheck` | Passou: geração de tipos de rotas e TypeScript estrito |
| `npm run lint` | Passou, sem erros ou avisos |
| `npm test` | 34 testes passaram, zero falhas e zero testes ignorados |
| `npm run build` | Passou com Webpack; todas as rotas compiladas para produção |
| `npm run smoke -- --url http://127.0.0.1:3001` | 12 verificações passaram no build final de produção |
| Auditoria npm após ajuste das dependências | Zero vulnerabilidades conhecidas reportadas |
| `git diff --check` | Passou |

Os testes cobrem a resposta real do PNCP, preservação do JSON, null/zero, datas, hash canônico, IDs em rotas, idempotência, snapshots, atualização sem perda da seleção, arquivos antigos, transação por página, filtros, paginação, persistência em disco após reabrir, anotações, amostras históricas, arquivo inválido, erros de rede/HTTP, timeout, novas tentativas e importação parcial.

## CLI e dados reais

- Consulta pequena oficial: HTTP 200, 10 registros e paginação conferida.
- Detalhe oficial por CNPJ/ano/sequencial: HTTP 200, mesmo identificador PNCP.
- Duas importações reais: 100 + 100 novos registros distintos; total local de 200. Limitação dos recortes registrada no histórico.
- Arquivo versionado: 50 registros reais, com origem e instante preservados, sem dados sintéticos na base da demonstração.
- `npm run demo` em banco temporário vazio: 50 novos, todos históricos.
- Repetição de `npm run demo` no mesmo banco temporário: zero novos, 50 sem alteração; total continuou 50. O banco temporário foi removido após a verificação.

## HTTP local

O script `npm run smoke -- --url http://127.0.0.1:3001` verifica 12 condições: páginas principais, paginação, resultado vazio, filtros inválidos, CSS compilado, detalhes com ID codificado, JSON original e respostas 400/404 da API local. O script exige uma base com a amostra carregada ou os registros reais desta entrega.

Durante essa verificação foi detectada e corrigida a decodificação do ID oficial na página de detalhes: o parâmetro de página continha `%2F`, enquanto o handler da API podia entregá-lo decodificado. A normalização agora aceita ambas as formas válidas e possui um teste de regressão. O diagnóstico temporário foi removido.

## Limites da verificação

A ferramenta de navegador retornou `The browser access host is unavailable`. Portanto, **não foram executados screenshots, revisão visual em desktop/celular, teste de teclado nem interação ponta a ponta no navegador**. A responsividade e os recursos de acessibilidade foram implementados, mas sua verificação visual permanece pendente.

O build padrão com Turbopack encontrou restrição a uma porta interna usada para compilar CSS. Foi adotada a opção oficial `next build --webpack` e o build completo passou. O ambiente também exigiu permissão de subprocessos para a compilação e de rede local para iniciar o servidor e realizar os checks HTTP.

O Node 22 emite aviso experimental para SQLite. O acesso HTML direto ao portal PNCP sofreu reset de conexão por `curl`; a API oficial de consulta e detalhe foi validada com sucesso, e o padrão de links do portal foi conferido em publicação de órgão oficial. Não houve validação visual do portal externo.
