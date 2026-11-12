# PNCP: consulta verificada

Documentação consultada em 12/11/2026:

- [Dados abertos](https://www.gov.br/pncp/pt-br/acesso-a-informacao/dados-abertos).
- [Swagger de consultas](https://pncp.gov.br/api/consulta/swagger-ui/index.html).
- [OpenAPI obtido com sucesso](https://pncp.gov.br/api/consulta/v3/api-docs); recorte preservado em `pncp-openapi.snapshot.json`.
- [Manual oficial de consultas, versão 1.0](https://www.gov.br/pncp/pt-br/pncp/manuais/versoes-anteriores/ManualPNCPAPIConsultasVerso1.0.pdf/@@download/file), especialmente seção 6.3.
- Documentação atual de [Next.js](https://nextjs.org/docs/app/getting-started/installation), [Tailwind CSS](https://tailwindcss.com/docs/installation/framework-guides/nextjs), [Zod](https://zod.dev/basics) e [SQLite do Node](https://nodejs.org/api/sqlite.html). Guias do Next.js instalado também foram lidos em `node_modules/next/dist/docs/`.

## Requisição pequena executada

```text
GET https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?dataInicial=20261110&dataFinal=20261112&codigoModalidadeContratacao=6&uf=SP&pagina=1&tamanhoPagina=10
```

HTTP **200**. A resposta real está em `tests/pncp-real-page.json`, coletada em 12/11/2026 por volta de 20:45 UTC (16:45 em Manaus, 17:45 em Brasília). Retornou 10 registros; metadados: `totalRegistros=1150`, `totalPaginas=115`, `numeroPagina=1`, `paginasRestantes=114`, `empty=false`.

O cliente usa `/v1/contratacoes/publicacao`, cujo período é de **publicação**. Não usa esse período para concluir que propostas estão abertas. O endpoint de propostas é um serviço diferente e não é utilizado nesta fase.

Obrigatórios: `dataInicial`, `dataFinal` em `yyyyMMdd`, `codigoModalidadeContratacao` e `pagina` a partir de 1. `uf` é opcional na API e é informada pelo importador. `tamanhoPagina` é opcional; **o OpenAPI atual especifica mínimo 10 e máximo 50**. O manual 1.0 cita outro limite máximo, 500. A implementação segue o esquema atual mais restritivo e sempre envia o tamanho.

A resposta tem `data`, `totalRegistros`, `totalPaginas`, `numeroPagina`, `paginasRestantes` e `empty`. HTTP 204 representa ausência de conteúdo. A coleta percorre as páginas a partir de 1 e para no fim ou nos limites configurados.

## Campos observados

| Campo PNCP | Uso |
| --- | --- |
| `numeroControlePNCP` | Chave oficial, sem substituição por ID inventado |
| `objetoCompra` | Descrição original |
| `informacaoComplementar` | Informações adicionais |
| `orgaoEntidade.razaoSocial` | Órgão |
| `unidadeOrgao.municipioNome`, `ufSigla` | Localização |
| `modalidadeNome` | Modalidade |
| `valorTotalEstimado` | Estimativa, mantendo ausência como `null` |
| `dataPublicacaoPncp` | Publicação e filtros locais de período |
| `dataAberturaProposta`, `dataEncerramentoProposta` | Prazos, conforme informados |
| `situacaoCompraNome` | Situação literal da fonte |

Na resposta real, `situacaoCompraId` veio como número embora o OpenAPI o descreva como string enumerada; o esquema aceita ambas as representações. Campos extras são preservados. Registros sem ID, tipos inválidos ou datas impossíveis interrompem a página com erro explícito.

O manual define horário de Brasília para o recebimento de propostas. As strings sem offset são preservadas e exibidas como horário de Brasília, sem usar o fuso do navegador. Publicação é usada como data civil original, sem assumir um instante UTC. Instantes de coleta são gerados em UTC e apresentados com fuso explícito de Brasília. A documentação do produto diferencia esse horário de Manaus.

Valor ausente é “Não informado”. Zero informado pela fonte continua zero e recebe observação: segundo o manual, o retorno zero também pode representar orçamento sigiloso. Não há conclusão de abertura com base em publicação ou status “Divulgada no PNCP”.

## Link oficial

O formato do identificador de contratação é `CNPJ-1-SEQUENCIAL/ANO`. A URL do portal é construída como `https://pncp.gov.br/app/editais/{cnpj}/{ano}/{sequencial}`. Esse padrão também está publicado por [órgãos oficiais de SP](https://www1.sap.sp.gov.br/licitacoes/licitacoes-sede.html), com pares de ID e URL.

Foi consultado com sucesso o endpoint de detalhe documentado:

```text
GET https://pncp.gov.br/api/consulta/v1/orgaos/05051955000191/compras/2026/27
```

O retorno confirmou `05051955000191-1-000027/2026`. O acesso HTML direto ao portal por `curl` sofreu reset de conexão neste ambiente; não foi considerado uma validação visual do portal. A UI disponibiliza também a URL da consulta da coleta e o JSON original persistido.

## Importações executadas

| Publicação / UF / modalidade | Páginas × tamanho | Lidos | Novos | Total informado pela fonte |
| --- | --- | --- | --- | --- |
| 10–12/11/2026 / SP / 6 | 2 × 50 | 100 | 100 | 1.150 |
| 12/11/2026 / SP / 6 | 2 × 50 | 100 | 100 | 349 |

As duas execuções foram bem-sucedidas e limitadas, com 200 IDs distintos. A amostra em `data/pncp-sample.json` contém 50 registros reais da primeira página da segunda coleta, incluindo equipamentos de informática. Ela preserva a URL utilizada e o instante efetivo: `2026-11-12T20:59:43.496Z`.

Não há pretensão de esgotar o período, a modalidade ou o setor. Os filtros locais só enxergam os registros efetivamente importados. O acesso ao PNCP pode falhar ou ficar lento; a aplicação registra o erro e continua permitindo trabalhar com a base preservada.
