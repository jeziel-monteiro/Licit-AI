import Link from "next/link";
export default function NotFound() {
  return <section className="panel empty-state"><div className="eyebrow">PÁGINA NÃO ENCONTRADA</div><h1>Este registro não está na base local</h1><p>Volte à pesquisa para conferir as oportunidades importadas.</p><Link href="/oportunidades" className="button button-primary">Voltar às oportunidades</Link></section>;
}
