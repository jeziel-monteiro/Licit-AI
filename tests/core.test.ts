import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/lib/db";
import { DEMO_PROFILE, filterSchema, hasItTerms, isHistorical, parseRouteId } from "../src/lib/domain";
import { collectionDate, money, sourceDate } from "../src/lib/format";
import { normalize, type IngestionContext } from "../src/lib/pncp/normalize";
import { pncpPageSchema, pncpRecordSchema } from "../src/lib/pncp/schema";
import { PncpClient, PncpError, publicationQuerySchema, publicationUrl } from "../src/lib/pncp/client";
import { importArchive, importPublications } from "../src/lib/pncp/importer";
import { analysisResultSchema } from "../src/lib/analysis";

// Fixture REAL: primeira página obtida do PNCP em 12/11/2026. Variações abaixo são SINTÉTICAS e existem apenas em testes isolados.
const realPage = JSON.parse(readFileSync(new URL("./pncp-real-page.json", import.meta.url), "utf8"));
const real = realPage.data[0];
const context: IngestionContext = { sourceUrl: "https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?dataInicial=20261110&dataFinal=20261112&codigoModalidadeContratacao=6&uf=SP&pagina=1&tamanhoPagina=10", collectedAt: "2026-11-12T20:45:42.000Z", ingestionKind: "live", dataKind: "real" };
const query = publicationQuerySchema.parse({ from: "2026-11-10", to: "2026-11-12", uf: "SP", pageSize: 10, maxPages: 2, maxRecords: 20 });
const stores: Store[] = [];
function database() { const store = new Store(":memory:"); stores.push(store); return store; }
afterEach(() => { for (const store of stores.splice(0)) store.close(); });
function ingest(store: Store, records: unknown[], ctx = context) {
  const run = store.startImport("live", {});
  store.ingestPage(run.id, records, ctx, { fetched: records.length, totalSource: records.length });
  return store.finishImport(run.id);
}
function synthetic(sequence: number, patch: Record<string, unknown> = {}) {
  return { ...real, numeroControlePNCP: `00000000000000-1-${String(sequence).padStart(6, "0")}/2026`, objetoCompra: "DADO SINTÉTICO DE TESTE: aquisição de computadores", ...patch };
}
const syntheticContext: IngestionContext = { ...context, dataKind: "synthetic" };
function pageResponse(records = realPage.data, page = 1, total = 2) {
  return new Response(JSON.stringify({ data: records, numeroPagina: page, totalPaginas: total, totalRegistros: total * 10, paginasRestantes: total - page, empty: records.length === 0 }), { status: 200 });
}

test("normaliza resposta real validada e mantém campos originais e ID oficial", () => {
  assert.equal(pncpPageSchema.parse(realPage).data.length, 10);
  const item = normalize(real, context);
  assert.equal(item.id, "05051955000191-1-000027/2026");
  assert.equal(item.agency, real.orgaoEntidade.razaoSocial);
  assert.equal(item.estimatedValue, 74357769.52);
  assert.equal(item.officialUrl, "https://pncp.gov.br/app/editais/05051955000191/2026/27");
  assert.deepEqual(JSON.parse(item.rawJson), real);
  assert.equal(item.publishedAt, real.dataPublicacaoPncp);
  assert.equal(item.proposalsEndAt, real.dataEncerramentoProposta);
});
test("rota reconhece ID PNCP cru ou codificado e rejeita codificação inválida", () => {
  assert.equal(parseRouteId(real.numeroControlePNCP), real.numeroControlePNCP);
  assert.equal(parseRouteId(encodeURIComponent(real.numeroControlePNCP)), real.numeroControlePNCP);
  assert.equal(parseRouteId("%ZZ"), null);
  assert.equal(parseRouteId(encodeURIComponent(encodeURIComponent(real.numeroControlePNCP))), null);
  assert.equal(parseRouteId("https://example.com"), null);
});
test("campos ausentes viram null; valor ausente não vira zero", () => {
  const item = normalize({ numeroControlePNCP: real.numeroControlePNCP }, context);
  for (const key of ["description", "agency", "city", "uf", "estimatedValue", "publishedAt", "proposalsStartAt", "proposalsEndAt", "sourceStatus"] as const) assert.equal(item[key], null);
});
test("zero explícito é preservado e valores inválidos são rejeitados", () => {
  assert.equal(normalize({ ...real, valorTotalEstimado: 0 }, context).estimatedValue, 0);
  assert.throws(() => normalize({ ...real, valorTotalEstimado: -1 }, context));
  assert.throws(() => normalize({ ...real, valorTotalEstimado: "123" }, context));
});
test("registros sem ID oficial e datas impossíveis são rejeitados", () => {
  assert.equal(pncpRecordSchema.safeParse({ objetoCompra: "Sem ID" }).success, false);
  assert.equal(pncpRecordSchema.safeParse({ ...real, dataPublicacaoPncp: "2026-02-30T12:00:00" }).success, false);
});
test("hash do conteúdo é estável para diferentes ordens de propriedades", () => {
  const reversed = Object.fromEntries(Object.entries(real).reverse());
  assert.equal(normalize(real, context).recordHash, normalize(reversed, context).recordHash);
  assert.notEqual(normalize({ ...real, objetoCompra: "Alteração sintética" }, context).recordHash, normalize(real, context).recordHash);
});
test("reimportação é idempotente e cada execução mantém sua evidência", () => {
  const store = database();
  assert.equal(ingest(store, [real]).inserted, 1);
  assert.equal(ingest(store, [real]).unchanged, 1);
  assert.equal(store.stats().total, 1);
  assert.equal(store.db.prepare("SELECT COUNT(*) AS count FROM import_records").get()!.count, 2);
  assert.deepEqual(store.rawRecord(real.numeroControlePNCP), real);
});
test("atualização mantém notas, seleção e primeira coleta", () => {
  const store = database();
  ingest(store, [real]); store.setSaved(real.numeroControlePNCP, true); store.saveNote(real.numeroControlePNCP, "Conferir o edital.");
  const run = ingest(store, [{ ...real, objetoCompra: "Descrição atualizada no teste" }], { ...context, collectedAt: "2026-11-12T21:00:00.000Z" });
  const item = store.getOpportunity(real.numeroControlePNCP)!;
  assert.equal(run.updated, 1); assert.equal(item.saved, true); assert.equal(item.note, "Conferir o edital."); assert.equal(item.firstCollectedAt, context.collectedAt); assert.equal(item.collectedAt, "2026-11-12T21:00:00.000Z");
});
test("arquivo antigo não sobrescreve dado mais recente e não rebaixa coleta ao vivo", () => {
  const store = database(); ingest(store, [real]);
  const old = ingest(store, [{ ...real, objetoCompra: "Antigo sintético" }], { ...context, collectedAt: "2026-11-11T00:00:00.000Z", ingestionKind: "archive" });
  assert.equal(old.unchanged, 1); assert.equal(store.getOpportunity(real.numeroControlePNCP)!.description, real.objetoCompra);
  ingest(store, [real], { ...context, ingestionKind: "archive" });
  assert.equal(store.getOpportunity(real.numeroControlePNCP)!.ingestionKind, "live");
});
test("página inválida é atômica e não grava o primeiro registro válido", () => {
  const store = database(); const run = store.startImport("file", {});
  assert.throws(() => store.ingestPage(run.id, [real, { objetoCompra: "Sem ID" }], context, { fetched: 2, totalSource: 2 }));
  assert.equal(store.stats().total, 0);
});
test("filtros combinam texto sem acentos, UF, publicação e intervalo de valores", () => {
  const store = database();
  ingest(store, [synthetic(1, { objetoCompra: "DADO SINTÉTICO: Aquisição de informática", valorTotalEstimado: 500, dataPublicacaoPncp: "2026-11-10T10:00:00" }), synthetic(2, { unidadeOrgao: { ufSigla: "RJ" }, valorTotalEstimado: 900 }), synthetic(3, { valorTotalEstimado: null })], syntheticContext);
  const result = store.list({ q: "aquisicao", uf: "SP", from: "2026-11-10", to: "2026-11-10", min: 400, max: 600, sector: "" });
  assert.equal(result.total, 1); assert.equal(result.items[0].estimatedValue, 500);
  assert.equal(store.list({ min: 0, sector: "" }).total, 2);
});
test("período da pesquisa usa publicação e não recebimento de propostas", () => {
  const store = database(); ingest(store, [real]);
  assert.equal(store.list({ from: "2026-11-25", to: "2026-11-25", sector: "" }).total, 0);
  assert.equal(store.list({ from: "2026-11-10", to: "2026-11-10", sector: "" }).total, 1);
});
test("busca escapa curingas SQL e não permite injeção", () => {
  const store = database(); ingest(store, [real]);
  for (const q of ["%", "_", "' OR 1=1 --"]) assert.equal(store.list({ q, sector: "" }).total, 0);
});
test("foco de informática reconhece palavras e não confunde monitor com monitoramento", () => {
  assert.equal(hasItTerms("Computador e monitor"), true);
  assert.equal(hasItTerms("Aquisição de monitores e periféricos"), true);
  assert.equal(hasItTerms("Serviços de videomonitoramento"), false);
  const store = database(); ingest(store, [synthetic(1), synthetic(2, { objetoCompra: "DADO SINTÉTICO: videomonitoramento" })], syntheticContext);
  assert.equal(store.list({ sector: "it" }).total, 1);
  assert.equal(store.list({ sector: "" }).total, 2);
});
test("paginação é estável e limita páginas fora do resultado", () => {
  const store = database(); ingest(store, Array.from({ length: 12 }, (_, i) => synthetic(i + 1)), syntheticContext);
  const first = store.list({ sector: "", page: 1 }); const second = store.list({ sector: "", page: 2 });
  assert.equal(first.items.length, 10); assert.equal(second.items.length, 2); assert.equal(first.pages, 2);
  assert.equal(new Set([...first.items, ...second.items].map((v) => v.id)).size, 12);
  assert.equal(store.list({ sector: "", page: 100 }).page, 2);
});
test("filtros rejeitam intervalo invertido, UF inválida e datas inexistentes", () => {
  for (const input of [{ from: "2026-12-01", to: "2026-11-01" }, { min: 20, max: 10 }, { uf: "XX" }, { from: "2026-02-30" }, { page: -1 }]) assert.equal(filterSchema.safeParse(input).success, false);
});
test("perfil, versão, seleção e anotação persistem depois de reabrir SQLite", () => {
  const directory = mkdtempSync(join(tmpdir(), "licitai-test-")); const path = join(directory, "test.sqlite");
  let store = new Store(path);
  try {
    const original = store.getProfile();
    store.saveProfile({ ...DEMO_PROFILE, name: "Empresa sintética de teste", uf: "AM" });
    ingest(store, [real]); store.setSaved(real.numeroControlePNCP, true); store.setSaved(real.numeroControlePNCP, true); store.saveNote(real.numeroControlePNCP, "Observação persistida.");
    store.close(); store = new Store(path);
    assert.equal(store.getProfile().name, "Empresa sintética de teste"); assert.equal(store.getProfile().version, original.version + 1);
    assert.equal(store.stats().selected, 1); assert.equal(store.getOpportunity(real.numeroControlePNCP)!.note, "Observação persistida.");
    assert.equal(store.db.prepare("SELECT COUNT(*) AS count FROM profile_versions").get()!.count, 2);
    store.setSaved(real.numeroControlePNCP, false); assert.equal(store.stats().selected, 0); assert.equal(store.stats().total, 1);
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});
test("anotações exigem seleção e têm tamanho limitado", () => {
  const store = database(); ingest(store, [real]);
  assert.throws(() => store.saveNote(real.numeroControlePNCP, "Teste"));
  store.setSaved(real.numeroControlePNCP, true);
  assert.throws(() => store.saveNote(real.numeroControlePNCP, "a".repeat(4001)));
});
test("arquivo de amostra real tem proveniência e é sempre marcado como histórico", () => {
  const archive = JSON.parse(readFileSync(new URL("../data/pncp-sample.json", import.meta.url), "utf8"));
  const store = database(); const run = importArchive(store, archive, "pncp-sample.json");
  assert.equal(run.status, "success"); assert.equal(run.processed, archive.records.length);
  const item = store.getOpportunity(archive.records[0].numeroControlePNCP)!;
  assert.equal(item.dataKind, "real"); assert.equal(isHistorical(item), true);
});
test("arquivo inválido gera falha rastreável sem registros", () => {
  const store = database(); const run = importArchive(store, { records: [{ objetoCompra: "Inválido" }] }, "invalido.json");
  assert.equal(run.status, "failed"); assert.match(run.error!, /esquema verificado/); assert.equal(store.stats().total, 0); assert.equal(store.recentImports().length, 1);
});
test("arquivo rejeita origem não oficial e coleta no futuro", () => {
  const archive = JSON.parse(readFileSync(new URL("../data/pncp-sample.json", import.meta.url), "utf8")); const store = database();
  assert.equal(importArchive(store, { ...archive, sourceUrl: "https://example.com" }, "falso.json").status, "failed");
  assert.equal(importArchive(store, { ...archive, collectedAt: "2099-01-01T00:00:00Z" }, "futuro.json").status, "failed");
});
test("coleta antiga vira histórica independentemente da data de publicação", () => {
  assert.equal(isHistorical({ ...context, collectedAt: "2026-11-01T00:00:00Z" }, new Date("2026-11-12T00:00:00Z")), true);
  assert.equal(isHistorical(context, new Date("2026-11-12T21:00:00Z")), false);
});
test("formatação pt-BR preserva null, zero e horário de Brasília", () => {
  assert.equal(money(null), "Não informado"); assert.match(money(0), /0,00/);
  assert.equal(sourceDate(null), "Não informado");
  assert.equal(sourceDate("2026-11-25T09:30:00", true), "25/11/2026 às 09:30 (Brasília)");
  assert.equal(sourceDate("2026-11-25T12:30:00Z", true), "25/11/2026 às 09:30 (Brasília)");
  assert.match(collectionDate("2026-11-12T20:45:42Z"), /17:45/);
});
test("URL da API usa somente parâmetros oficiais e limites atuais", () => {
  const url = new URL(publicationUrl(query, 1));
  assert.equal(url.searchParams.get("dataInicial"), "20261110"); assert.equal(url.searchParams.get("codigoModalidadeContratacao"), "6"); assert.equal(url.searchParams.get("tamanhoPagina"), "10");
  assert.equal(publicationQuerySchema.safeParse({ ...query, pageSize: 51 }).success, false);
  assert.equal(publicationQuerySchema.safeParse({ ...query, from: "2026-01-01" }).success, false);
});
test("cliente valida uma página real e trata 204 como resultado vazio", async () => {
  const client = new PncpClient({ fetcher: async () => new Response(JSON.stringify(realPage)), retries: 0 });
  assert.equal((await client.page(query, 1)).page.data.length, 10);
  const empty = new PncpClient({ fetcher: async () => new Response(null, { status: 204 }) });
  assert.equal((await empty.page(query, 1)).page.empty, true);
});
test("HTTP 500 tem no máximo duas novas tentativas e 400 não é repetido", async () => {
  for (const [status, attempts] of [[500, 3], [400, 1]]) {
    let calls = 0;
    const client = new PncpClient({ fetcher: async () => { calls++; return new Response(null, { status }); }, retries: 2, sleep: async () => {} });
    await assert.rejects(client.page(query, 1), (error: unknown) => error instanceof PncpError && error.status === status);
    assert.equal(calls, attempts);
  }
});
test("HTTP 429 respeita espera limitada e pode se recuperar", async () => {
  let calls = 0; const waits: number[] = [];
  const client = new PncpClient({ fetcher: async () => ++calls === 1 ? new Response(null, { status: 429, headers: { "retry-after": "1000" } }) : pageResponse(), sleep: async (ms) => { waits.push(ms); } });
  assert.equal((await client.page(query, 1)).page.data.length, 10); assert.deepEqual(waits, [2000]);
});
test("falha de rede é limitada e não silenciada", async () => {
  let calls = 0;
  const client = new PncpClient({ fetcher: async () => { calls++; throw new TypeError("Network error"); }, sleep: async () => {} });
  await assert.rejects(client.page(query, 1), (error: unknown) => error instanceof PncpError && error.kind === "network"); assert.equal(calls, 3);
});
test("timeout aborta a requisição", async () => {
  let aborted = false;
  const client = new PncpClient({ timeoutMs: 10, retries: 0, fetcher: async (_url, init) => new Promise<Response>((_resolve, reject) => {
    const keepAlive = setTimeout(() => reject(new Error("Teste não recebeu abort")), 100);
    init!.signal!.addEventListener("abort", () => { aborted = true; clearTimeout(keepAlive); reject(init!.signal!.reason); }, { once: true });
  }) });
  await assert.rejects(client.page(query, 1), PncpError); assert.equal(aborted, true);
});
test("esquema inválido, JSON inválido e página trocada falham sem nova tentativa", async () => {
  for (const build of [() => new Response("not json"), () => new Response(JSON.stringify({ data: [] })), () => pageResponse(realPage.data, 2)]) {
    let calls = 0; const client = new PncpClient({ fetcher: async () => { calls++; return build(); } });
    await assert.rejects(client.page(query, 1), (error: unknown) => error instanceof PncpError && error.kind === "schema"); assert.equal(calls, 1);
  }
});
test("importação respeita paginação, máximo de registros e informa recorte limitado", async () => {
  const store = database(); const seen: number[] = [];
  const client = new PncpClient({ fetcher: async (input) => {
    const page = Number(new URL(String(input)).searchParams.get("pagina")); seen.push(page);
    return pageResponse(Array.from({ length: 10 }, (_, i) => synthetic((page - 1) * 10 + i + 1)), page, 3);
  } });
  const run = await importPublications(store, { ...query, maxPages: 2, maxRecords: 15 }, client);
  assert.deepEqual(seen, [1, 2]); assert.equal(run.processed, 15); assert.equal(run.fetched, 20); assert.equal(run.limited, true); assert.equal(store.stats().total, 15);
});
test("falha da segunda página preserva a primeira e registra importação parcial", async () => {
  const store = database(); let calls = 0;
  const client = new PncpClient({ retries: 0, fetcher: async () => ++calls === 1 ? pageResponse() : new Response(null, { status: 503 }) });
  const run = await importPublications(store, query, client);
  assert.equal(run.status, "partial"); assert.equal(run.processed, 10); assert.match(run.error!, /503/); assert.equal(store.stats().total, 10);
});
test("falha completa é registrada no histórico", async () => {
  const store = database(); const client = new PncpClient({ retries: 0, fetcher: async () => new Response(null, { status: 502 }) });
  const run = await importPublications(store, query, client);
  assert.equal(run.status, "failed"); assert.equal(store.recentImports()[0].status, "failed"); assert.equal(store.stats().total, 0);
});
test("contrato de análise futura exige evidência, modelo e versões sem executar IA", () => {
  assert.equal(analysisResultSchema.safeParse({ classification: "possivel_aderencia" }).success, false);
});
