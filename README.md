# LicitAI

**Encontre oportunidades. Acelere sua análise.**

Ferramenta local, em português brasileiro, para pesquisar um recorte de compras públicas do PNCP, conferir a origem e organizar uma seleção comercial. O foco inicial é equipamento de informática em São Paulo. O recorte, a UF e a modalidade são configuráveis.

As etapas 1 e 2 estão implementadas: importação real e rastreável, perfil de uma empresa, pesquisa com filtros e paginação, detalhes, seleção e anotações persistentes. Na frente `opportunity-analysis`, a etapa 3 acrescenta análise individual via OpenAI, persistência, reutilização e indicação de resultados preliminares. Sem chave, a aplicação mostra “IA não configurada”. A validação de evidências e a revisão humana ainda dependem das integrações da equipe.

O produto auxilia a triagem comercial. Não determina habilitação jurídica, não garante elegibilidade e não envia propostas.

## Instalação e execução

Requer Node.js **22.13+ na linha 22, ou 24+**, com `node:sqlite` disponível, e npm. A versão utilizada está em `.nvmrc`. No Node 22, SQLite pode emitir um aviso de recurso experimental.

```bash
nvm use
npm ci
cp .env.example .env
npm run demo
npm run dev
```

Acesse [http://127.0.0.1:3000](http://127.0.0.1:3000). O comando `demo` carrega **50 registros públicos reais como amostra histórica**, sem precisar de acesso ao PNCP. A tela “Coletas e origem” oferece a mesma ação. Também é possível iniciar com a base vazia e importar pela interface.

O banco é criado automaticamente em `data/licitai.sqlite`. Perfil, seleções e anotações permanecem após reiniciar. O banco e seus arquivos auxiliares não são versionados. A amostra JSON pode ser versionada porque contém dados públicos de demonstração; não inclua dados privados nela.

Para executar a versão de produção local:

```bash
npm run build
npm start
```

Os servidores escutam somente em `127.0.0.1`. Esta fase não inclui publicação nem autenticação.

## Importar do PNCP

```bash
# Padrão: últimos 3 dias de publicação em Brasília, SP, pregão eletrônico,
# até 2 páginas de 50 e 100 registros processados.
npm run import:pncp

# Recorte explícito e preservação de uma amostra da primeira página.
npm run import:pncp -- --from 2026-11-10 --to 2026-11-12 --uf SP --modality 6 --page-size 50 --max-pages 2 --max-records 100 --save-sample data/minha-amostra.json

npm run import:pncp -- --help
```

Datas representam **publicação**, não recebimento de propostas. A API exige uma modalidade por consulta; `6` é pregão eletrônico e `8` é dispensa. Esta versão da interface oferece essas duas modalidades. Limites de proteção do importador: 31 dias, 20 páginas e 1.000 registros processados por execução. O tamanho de página aceito é **10 a 50**, conforme o Swagger atual consultado, apesar de o manual antigo citar 500.

`--max-records` limita os registros persistidos. A última página pode trazer mais registros do que o limite restante; o histórico distingue “lidos” de “processados”. A coleta informa quando restam páginas. A base é um recorte, sem promessa de cobertura total do PNCP.

Timeout padrão de 15 segundos por tentativa e até duas novas tentativas para falhas de rede, HTTP 408, 429 e 5xx. Erros 4xx comuns e respostas incompatíveis com o esquema não são repetidos. Páginas anteriores permanecem gravadas se uma página seguinte falhar; o histórico registra a execução como parcial. O comando sai com código 1 se a importação falhar ou ficar parcial por erro.

Configurações opcionais estão em [.env.example](.env.example). As opções da linha de comando prevalecem sobre o ambiente.

## Importar arquivo / trabalhar offline

```bash
npm run import:file -- data/pncp-sample.json
npm run demo
```

O formato está exemplificado em [data/pncp-sample.json](data/pncp-sample.json) e validado por `archiveSchema` em `src/lib/pncp/schema.ts`: `schemaVersion`, `dataKind`, `collectedAt` com offset, `sourceUrl` HTTPS da API PNCP, `description` e `records`. Aceita no máximo 5.000 registros por arquivo. Os registros usam o mesmo esquema conferido na API.

Arquivos importados são apresentados como **amostra histórica**, mesmo se sua coleta for recente. Dados sintéticos exigem `dataKind: "synthetic"` e recebem identificação própria na interface. O marcador de origem do arquivo é uma declaração de quem o preparou; não constitui certificação de autenticidade. Uma amostra antiga nunca substitui uma observação mais recente do mesmo ID.

## Usar a aplicação

1. **Perfil da empresa:** revise nome, descrição, termos e UF. Cada salvamento gera uma versão persistente. A UF define o filtro inicial; termos de interesse e exclusão ficam registrados, sem descartar oportunidades automaticamente.
2. **Oportunidades:** pesquise por descrição, órgão, cidade ou ID. Combine UF, data de publicação e valor. O foco inicial em informática procura palavras no objeto; “Toda a base” desativa esse foco. Valores ausentes não atendem filtros numéricos.
3. **Detalhes:** confira descrição original, prazos, valores, situação e fonte oficial. Campos ausentes aparecem como “Não informado”. Há acesso ao JSON original coletado e à consulta utilizada.
4. **Selecionadas:** salve oportunidades, registre e salve anotações ou remova da seleção. Todas as alterações são persistidas no SQLite.

Busca textual, valores e foco de informática são filtros **locais sobre os dados importados**. Eles não classificam aderência. Uma coleta ao vivo com mais de sete dias passa a ser identificada como histórica. “Coleta recente” descreve somente a idade da coleta; não afirma que a contratação continua recebendo propostas. A situação exibida é a informada pela fonte.

## Testar

```bash
npm run typecheck
npm run lint
npm test
npm run build
# Ou todos os quatro:
npm run check

# Com a aplicação já em execução e a amostra carregada:
npm run smoke
# Porta alternativa:
npm run smoke -- --url http://127.0.0.1:3001
```

Os testes usam uma resposta real preservada e variações **sintéticas restritas aos testes**. Cobrem normalização, campos ausentes, datas, idempotência, histórico, filtros, SQL parametrizado, paginação, persistência ao reabrir o banco, arquivos inválidos, falhas de comunicação, timeout e limite de tentativas. Não dependem da rede pública.

O executor de testes utiliza `--experimental-test-isolation=none` para funcionar em ambientes que restringem subprocessos; cada teste de banco usa uma instância isolada. O build usa a opção oficial `--webpack` para evitar a porta interna de compilação do Turbopack em ambientes restritos. O desenvolvimento usa o padrão do Next.js. A dependência transitiva `minimatch` de `@typescript-eslint/typescript-estree` foi fixada na linha corrigida 11.0.1+; o lockfile registra a resolução. O ESLint 9 é mantido por compatibilidade declarada pelos plugins atuais do Next.js.

O smoke test verifica HTTP, conteúdo renderizado no servidor, CSS e o endpoint do registro original. Ele **não substitui testes de interação nem revisão visual em navegador**.

## Análise de aderência — etapa 3

Atualize seu `.env` com os campos OpenAI de [.env.example](.env.example), mantendo a chave somente no servidor. O modelo inicial configurável é `gpt-5.6-terra`. Em detalhes, “Analisar aderência” compara a oportunidade com o perfil persistido. A execução é explícita; abrir páginas não chama o modelo.

O resultado fica **preliminar** até que o adaptador real de validação de evidências seja integrado. Nenhum validador simulado é utilizado na aplicação. Respostas pendentes podem ser validadas depois sem nova geração; falhas não são reutilizadas como resultados. A migração do banco é automática e aditiva, preservando os dados existentes.

```bash
npm run eval:adherence          # apresenta os cinco casos reais, sem chamada externa
npm run eval:adherence -- --run # exige chave; até cinco gerações, com retries configurados
```

Não havia chave disponível durante a implementação; a API OpenAI **não foi validada com uma chamada real**. As classificações propostas nos casos de avaliação aguardam revisão humana. Veja o [handoff de integração](docs/handoffs/adherence-analysis.md) e o [relatório desta frente](docs/handoffs/adherence-validation.md) para contratos, configuração, testes e pendências dos colegas.

## Dados reais validados nesta entrega

Em **12/11/2026**, foram realizadas consultas HTTP 200 ao endpoint oficial de publicações e ao endpoint de detalhe. O importador gravou **200 oportunidades reais distintas**, em dois recortes pequenos de SP/pregão eletrônico. A amostra versionada preserva 50 registros da primeira página do recorte de 12/11, com fonte e instante da coleta. Os 200 registros estão no banco local desta execução; uma instalação nova começa com 50 ao executar `npm run demo`.

Consulte [docs/pncp.md](docs/pncp.md) para os parâmetros, campos, evidências e limitações da validação. As decisões técnicas estão em [docs/architecture.md](docs/architecture.md), os checks executados em [docs/validation.md](docs/validation.md) e os próximos passos em [docs/next-steps.md](docs/next-steps.md).
