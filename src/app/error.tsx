"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <section className="panel empty-state" role="alert"><h1>Não foi possível carregar esta página</h1><p>Tente novamente. As informações já salvas ficam preservadas no banco local.</p><div className="error-actions"><button onClick={reset} className="button button-primary">Tentar novamente</button><Link href="/oportunidades" className="button button-secondary">Ir para oportunidades</Link></div></section>;
}
