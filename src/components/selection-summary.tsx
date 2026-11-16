"use client";
import { useActionState } from "react";
import Link from "next/link";
import { generateSummaryAction } from "@/app/selecionadas/summary-actions";
import type { SummaryRecord } from "@/lib/summary";
import { money, sourceDate } from "@/lib/format";
import { detailHref } from "./opportunities";

export function SelectionSummary({ record, stale }: { record: SummaryRecord | null; stale: boolean }) {
  const [state, action, pending] = useActionState(generateSummaryAction, { message: "" });
  const copy = () => {
    if (!record) return;
    const text = [record.summary, ...record.sources.map((source) => `${source.id}: ${record.points.find((point) => point.opportunityId === source.id)?.attention ?? ""}\n${source.sourceUrl}`)].join("\n\n");
    void navigator.clipboard.writeText(text);
  };
  return <section className="panel selection-summary" aria-labelledby="summary-heading">
    <h2 id="summary-heading">Resumo comercial da seleção</h2>
    <p>Rascunho gerado por IA. Confira cada ponto na fonte antes de usar.</p>
    <form action={action}><button type="submit" className="button button-primary" disabled={pending}>{pending ? "Gerando resumo…" : record ? "Atualizar resumo" : "Gerar resumo"}</button></form>
    {state.message ? <p role="status">{state.message}</p> : null}
    {record ? <>
      {stale ? <p role="status">A seleção, o perfil ou as análises mudaram. Atualize este resumo antes de usar ou exportar.</p> : null}
      <p>{record.summary}</p>
      {!stale ? <div className="summary-actions"><button type="button" className="button button-secondary" onClick={copy}>Copiar resumo em texto</button><a className="button button-secondary" href="/api/selecionadas/resumo">Exportar CSV</a></div> : null}
      <h3>Pontos de atenção por oportunidade</h3>
      <ul className="summary-points">{record.sources.map((source) => <li key={source.id}><strong><Link href={detailHref(source.id)}>{source.id}</Link></strong><p>{record.points.find((point) => point.opportunityId === source.id)?.attention}</p><p>{source.agency ?? "Órgão não informado"} · {money(source.estimatedValue)} · Fim: {sourceDate(source.proposalsEndAt, true)}</p>{source.note ? <p>Sua anotação: {source.note}</p> : null}<a href={source.sourceUrl} target="_blank" rel="noopener noreferrer">Conferir no PNCP</a></li>)}</ul>
      <p>Gerado em {new Date(record.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · {record.model}</p>
    </> : null}
  </section>;
}
