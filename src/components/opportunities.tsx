import Link from "next/link";
import { Icon } from "./icon";
import { SaveButton } from "./forms";
import { isHistorical, type Opportunity, type Filters } from "@/lib/domain";
import { money, sourceDate } from "@/lib/format";

export const detailHref = (id: string) => `/oportunidades/${encodeURIComponent(id)}`;
export function Provenance({ item }: { item: Opportunity }) {
  if (item.dataKind === "synthetic") return <span className="badge badge-warning">Sintético · teste</span>;
  return isHistorical(item) ? <span className="badge badge-warning"><Icon name="clock" size={12}/>Amostra histórica</span> : <span className="badge badge-green"><span className="status-dot"/>Coleta recente</span>;
}
export function OpportunityTable({ items }: { items: Opportunity[] }) {
  return <div className="table-scroll"><table className="opportunity-table"><caption className="sr-only">Oportunidades importadas do PNCP</caption><thead><tr><th scope="col">CONTRATAÇÃO / ÓRGÃO</th><th scope="col">LOCALIZAÇÃO</th><th scope="col">VALOR ESTIMADO</th><th scope="col">PUBLICAÇÃO</th><th scope="col"><span className="sr-only">Salvar</span></th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td className="description-cell"><div className="row-meta"><span className="modality">{item.modality ?? "Modalidade não informada"}</span><Provenance item={item}/></div><Link href={detailHref(item.id)} className="opportunity-title">{item.description ?? "Descrição não informada"}</Link><p className="agency-line"><Icon name="building" size={13}/><span>{item.agency ?? "Órgão não informado"}</span></p></td><td><div className="location"><Icon name="pin" size={15}/><div>{item.city ?? "Não informado"}<small>{item.uf ?? "UF não informada"}</small></div></div></td><td className="value-cell">{money(item.estimatedValue)}<small>{item.estimatedValue === 0 ? "Zero informado pela fonte*" : "Valor total da contratação"}</small></td><td className="date-cell">{sourceDate(item.publishedAt)}<small>{item.sourceStatus ?? "Situação não informada"}</small></td><td><SaveButton id={item.id} saved={item.saved}/></td></tr>)}</tbody></table></div>;
}
export function filtersHref(filters: Filters, patch: Partial<Filters> = {}): string {
  const next = { ...filters, ...patch };
  const params = new URLSearchParams();
  Object.entries(next).forEach(([key, value]) => { if (value !== "") params.set(key, String(value)); });
  // A ausência de sector ativa o foco inicial. Envie explicitamente o campo vazio para toda a base.
  if (next.sector === "") params.set("sector", "");
  return `/oportunidades?${params}`;
}
export function Pagination({ filters, page, pages, total, pageSize = 10 }: { filters: Filters; page: number; pages: number; total: number; pageSize?: number }) {
  return <div className="pagination"><p>{total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} de ${total} oportunidades` : "Nenhuma oportunidade"}</p><nav aria-label="Paginação"><Link href={filtersHref(filters, { page: Math.max(1, page - 1) })} aria-disabled={page === 1} tabIndex={page === 1 ? -1 : undefined} className={`page-button ${page === 1 ? "disabled" : ""}`}><Icon name="back" size={15}/><span>Anterior</span></Link><span className="page-current">{page} <span className="muted">/ {pages}</span></span><Link href={filtersHref(filters, { page: Math.min(pages, page + 1) })} aria-disabled={page === pages} tabIndex={page === pages ? -1 : undefined} className={`page-button ${page === pages ? "disabled" : ""}`}><span>Próxima</span><Icon name="arrow" size={15}/></Link></nav></div>;
}
export function EmptyState({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><Icon name="search" size={28}/></span><h2>{title}</h2><div>{children}</div></div>;
}
