export default function Loading() {
  return <div className="loading-state" role="status" aria-live="polite"><div className="skeleton skeleton-heading"/><div className="stats-grid">{[1, 2, 3].map((n) => <div className="skeleton skeleton-stat" key={n}/>)}</div><div className="skeleton skeleton-content"/><p>Carregando seu espaço de trabalho…</p></div>;
}
