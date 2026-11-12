import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { Store } from "../src/lib/db";
import { profileInputSchema } from "../src/lib/domain";
import { importArchive } from "../src/lib/pncp/importer";
import { OpenAIAdherenceProvider } from "../src/lib/adherence/openai-provider";
import { readOpenAIConfiguration } from "../src/lib/adherence/config";
import { AdherenceRepository } from "../src/lib/adherence/repository";
import { OpportunityAdherenceService } from "../src/lib/adherence/service";

const { values } = parseArgs({ options: { run: { type: "boolean", default: false } } });
const dataset = JSON.parse(readFileSync("docs/evaluations/adherence-cases.json", "utf8"));
if (!values.run) {
  console.log("Cinco casos reais preparados; propostas PENDENTES DE REVISÃO HUMANA. Nenhuma chamada à API foi executada.");
  console.table(dataset.cases.map((item: { opportunityId: string; scenario: string; proposedClassification: string }) => ({ id: item.opportunityId, scenario: item.scenario, proposal: item.proposedClassification })));
  console.log("Para executar até cinco chamadas reais explicitamente: npm run eval:adherence -- --run");
  process.exit(0);
}
const configuration = readOpenAIConfiguration();
if (!configuration.apiKey || !configuration.valid) {
  console.error("IA não configurada. Configure OPENAI_API_KEY e os limites válidos no .env; nenhuma chamada foi executada.");
  process.exit(1);
}
if (!Array.isArray(dataset.cases) || dataset.cases.length !== 5) throw new Error("A avaliação deve conter exatamente cinco casos.");
const directory = mkdtempSync(join(tmpdir(), "licitai-real-evaluation-"));
const store = new Store(join(directory, "evaluation.sqlite"));
try {
  store.saveProfile(profileInputSchema.parse(dataset.profile));
  const sample = JSON.parse(readFileSync("data/pncp-sample.json", "utf8"));
  const imported = importArchive(store, sample, "data/pncp-sample.json");
  if (imported.status !== "success") throw new Error("A amostra de avaliação não pôde ser importada.");
  // Sem adaptador de evidências, saídas reais continuam preliminares. Não há aprovação simulada aqui.
  const service = new OpportunityAdherenceService(new AdherenceRepository(store), new OpenAIAdherenceProvider(configuration));
  const results = [];
  for (const item of dataset.cases) {
    const view = await service.analyze(item.opportunityId);
    results.push({ opportunityId: item.opportunityId, proposalReviewStatus: item.reviewStatus, proposedClassification: item.proposedClassification, view, record: view.analysisId ? service.repository.get(view.analysisId) : null });
    console.log(`${item.opportunityId}: ${view.state}`);
  }
  const target = "data/adherence-evaluations";
  mkdirSync(target, { recursive: true });
  const output = join(target, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(output, JSON.stringify({ evaluatedAt: new Date().toISOString(), requestedModel: configuration.settings.model, notice: "Amostra pequena sem rótulos humanos aprovados: não estima precisão geral. Resultados pendentes de validação de evidências.", results }, null, 2) + "\n");
  console.log(`Resultados e metadados preservados em ${output} (ignorado pelo Git).`);
  if (results.some((item) => item.view.state === "failed")) process.exitCode = 1;
} finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
