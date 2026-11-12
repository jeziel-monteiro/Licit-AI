import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { url: { type: "string", default: "http://127.0.0.1:3000" } } });
const base = new URL(values.url);
if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) throw new Error("O smoke test deve usar o servidor local.");
const sample = JSON.parse(readFileSync(new URL("../data/pncp-sample.json", import.meta.url), "utf8"));
const id = sample.records[0].numeroControlePNCP;
let count = 0;
for (const [path, text] of [
  ["/oportunidades", "Encontre oportunidades"],
  ["/oportunidades?sector=&uf=&page=2", "Oportunidades"],
  ["/oportunidades?sector=&q=nenhumresultadoinexistente123456", "Nenhuma oportunidade neste recorte"],
  ["/oportunidades?from=2026-12-01&to=2026-11-01", "Revise os filtros"],
  ["/perfil", "Produtos e serviços"],
  ["/selecionadas", "Sua seleção"],
  ["/importacoes", "Histórico de importações"],
  [`/oportunidades/${encodeURIComponent(id)}`, "Análise com IA ainda não executada"],
]) {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, path);
  const body = await response.text(); assert.ok(body.includes(text), `${path}: conteúdo esperado`); assert.ok(body.includes('lang="pt-BR"'), `${path}: idioma`);
  console.log(`OK ${path}`); count++;
  if (path === "/oportunidades") {
    const stylesheet = body.match(/<link[^>]+href="([^"]+\.css[^\"]*)"/);
    assert.ok(stylesheet, "CSS incluído");
    const css = await fetch(new URL(stylesheet[1].replaceAll("&amp;", "&"), base));
    assert.equal(css.status, 200); assert.ok((await css.text()).includes(".sidebar")); console.log("OK CSS compilado"); count++;
  }
}
const original = await fetch(new URL(`/api/oportunidades/${encodeURIComponent(id)}/original`, base));
assert.equal(original.status, 200); assert.equal((await original.json()).numeroControlePNCP, id); console.log("OK JSON original e ID oficial"); count++;
for (const [id, status] of [["invalido", 400], ["00000000000000-1-999999/1900", 404]]) {
  const response = await fetch(new URL(`/api/oportunidades/${encodeURIComponent(id)}/original`, base));
  assert.equal(response.status, status); console.log(`OK API erro ${status}`); count++;
}
console.log(`${count} verificações HTTP passaram. Este teste não verifica renderização visual nem interação no navegador.`);
