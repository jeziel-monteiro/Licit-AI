import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Store } from "../src/lib/db";
import { AdherenceRepository } from "../src/lib/adherence/repository";
import { OpportunityAdherenceService } from "../src/lib/adherence/service";
import { readOpenAIConfiguration } from "../src/lib/adherence/config";
import { SelectionSummaryService, summaryCsv } from "../src/lib/summary";

const sample = JSON.parse(readFileSync(new URL("../data/pncp-sample.json", import.meta.url), "utf8"));
const records = sample.records.slice(0, 2);
const ids: string[] = records.map((record: { numeroControlePNCP: string }) => record.numeroControlePNCP);
function fixture() {
  const store = new Store(":memory:");
  const run = store.startImport("file", {});
  store.ingestPage(run.id, records, { sourceUrl: sample.sourceUrl, collectedAt: sample.collectedAt, ingestionKind: "archive", dataKind: "real" }, { fetched: 2, totalSource: 2 });
  store.finishImport(run.id);
  for (const id of ids) store.setSaved(id, true);
  const provider = { configured: false, settings: readOpenAIConfiguration({}).settings, async generate() { throw new Error("Não deve chamar modelo de aderência."); } };
  const adherence = new OpportunityAdherenceService(new AdherenceRepository(store), provider);
  return { store, adherence };
}
const metadata = { model: "gemini-test", durationMs: 7, attempts: 1, usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30, cachedInputTokens: null, reasoningTokens: null }, responseId: null, requestId: null };

test("resumo usa IDs atuais, persiste e invalida com mudanças da seleção", async () => {
  const previous = process.env.GEMINI_API_KEY; process.env.GEMINI_API_KEY = "test-only";
  const { store, adherence } = fixture();
  let calls = 0;
  const service = new SelectionSummaryService(store, adherence, async ({ data }) => {
    calls++;
    const input = JSON.parse(data);
    assert.deepEqual(input.items.map((item: { id: string }) => item.id).sort(), [...ids].sort());
    assert.ok(input.items.every((item: { analysis: unknown }) => item.analysis === null));
    return { text: JSON.stringify({ summary: "Resumo preliminar.", points: ids.map((opportunityId) => ({ opportunityId, attention: "Conferir o edital." })) }), metadata };
  });
  try {
    const record = await service.generateSummary();
    assert.equal(record.points.length, 2);
    assert.match(record.summary, /Não há análises de aderência aprovadas/);
    assert.equal((await service.generateSummary()).id, record.id);
    assert.equal(calls, 1);
    assert.equal(new SelectionSummaryService(store, adherence).latest().stale, false);
    assert.equal(store.db.prepare("SELECT COUNT(*) AS count FROM ai_executions").get()!.count, 1);
    const csv = summaryCsv(record);
    assert.ok(csv.includes(ids[0]));
    assert.ok(csv.includes(String(record.sources[0].estimatedValue)));
    store.saveNote(ids[0], "Nova observação.");
    assert.equal(service.latest().stale, true);
  } finally { store.close(); if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous; }
});

test("resumo com ID omitido ou inventado não é salvo", async () => {
  const previous = process.env.GEMINI_API_KEY; process.env.GEMINI_API_KEY = "test-only";
  const { store, adherence } = fixture();
  const service = new SelectionSummaryService(store, adherence, async () => ({ text: JSON.stringify({ summary: "Errado", points: [{ opportunityId: ids[0], attention: "Conferir." }, { opportunityId: "outro", attention: "Conferir." }] }), metadata }));
  try {
    await assert.rejects(service.generateSummary(), /omitiu ou misturou/);
    assert.equal(service.latest().record, null);
    assert.equal(store.db.prepare("SELECT COUNT(*) AS count FROM ai_executions WHERE operation='selection_summary'").get()!.count, 1);
  } finally { store.close(); if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous; }
});

test("resumo usa somente análise atual com evidências aprovadas", async () => {
  const previous = process.env.GEMINI_API_KEY; process.env.GEMINI_API_KEY = "test-only";
  const { store } = fixture();
  const provider = { configured: true, settings: readOpenAIConfiguration({}).settings, async generate() { return { text: JSON.stringify({ classification: "possivel_aderencia", justification: "Conferir compatibilidade.", matchedCriteria: [], conflictingCriteria: [], evidence: [{ field: "description", excerpt: store.getOpportunity(ids[0])!.description!.slice(0, 12) }], missingInformation: [] }), disposition: "completed" as const, metadata }; } };
  const adherence = new OpportunityAdherenceService(new AdherenceRepository(store), provider, { evidenceValidator: { version: "test.v1", async validate() { return { status: "approved" as const, codes: [] }; } } });
  try {
    assert.equal((await adherence.analyze(ids[0])).state, "validated");
    const service = new SelectionSummaryService(store, adherence, async ({ data }) => {
      const input = JSON.parse(data);
      assert.equal(input.items.find((item: { id: string }) => item.id === ids[0]).analysis.classification, "possivel_aderencia");
      assert.equal(input.items.find((item: { id: string }) => item.id === ids[1]).analysis, null);
      return { text: JSON.stringify({ summary: "Resumo preliminar.", points: ids.map((opportunityId) => ({ opportunityId, attention: "Conferir." })) }), metadata };
    });
    await service.generateSummary();
    store.saveProfile({ ...store.getProfile(), description: "Perfil empresarial alterado com novos produtos de informática." });
    assert.equal(service.latest().stale, true);
  } finally { store.close(); if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous; }
});

test("valores e datas no texto do modelo são recusados; os dados exportados vêm da fonte", async () => {
  const previous = process.env.GEMINI_API_KEY; process.env.GEMINI_API_KEY = "test-only";
  const { store, adherence } = fixture();
  const service = new SelectionSummaryService(store, adherence, async () => ({ text: JSON.stringify({ summary: "Valor R$ 9.999,99 e prazo 01/12/2026.", points: ids.map((opportunityId) => ({ opportunityId, attention: "Conferir." })) }), metadata }));
  try {
    await assert.rejects(service.generateSummary(), /incluiu valor ou data/);
    assert.equal(service.latest().record, null);
  } finally { store.close(); if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous; }
});

test("cinco casos de avaliação correspondem a oportunidades PNCP da amostra", () => {
  const cases = JSON.parse(readFileSync(new URL("../docs/evaluations/selection-summary-cases.json", import.meta.url), "utf8")).cases;
  assert.equal(cases.length, 5);
  for (const item of cases) {
    assert.ok(sample.records.some((record: { numeroControlePNCP: string }) => record.numeroControlePNCP === item.id));
    assert.equal(item.humanReview, "pending");
  }
});

test("CSV neutraliza fórmulas vindas do texto externo", () => {
  const record = { id: "1", inputHash: "h", createdAt: "2026-01-01T00:00:00Z", model: "test", summary: "", points: [{ opportunityId: ids[0], attention: "=HYPERLINK(\"x\")" }], sources: [{ id: ids[0], description: "=cmd", agency: null, estimatedValue: null, proposalsEndAt: null, note: null, sourceUrl: "https://example.com" }] };
  assert.match(summaryCsv(record), /"'=cmd"/);
  assert.match(summaryCsv(record), /"'=HYPERLINK/);
});
