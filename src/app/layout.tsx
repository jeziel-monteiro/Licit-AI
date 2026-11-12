import type { Metadata } from "next";
import Link from "next/link";
import { getStore } from "@/lib/server/store";
import { Icon } from "@/components/icon";
import { Navigation } from "@/components/navigation";
import "./globals.css";

export const metadata: Metadata = { title: { default: "LicitAI · Oportunidades públicas", template: "%s · LicitAI" }, description: "Encontre oportunidades. Acelere sua análise. Ferramenta local de triagem comercial com dados rastreáveis do PNCP.", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const store = getStore();
  const stats = store.stats();
  const profile = store.getProfile();
  return <html lang="pt-BR"><body><a href="#main" className="skip-link">Pular para o conteúdo</a><div className="app-shell"><aside className="sidebar"><Link href="/oportunidades" className="brand" aria-label="LicitAI, oportunidades"><span className="brand-symbol"><span/><span/><span/></span><span>Licit<span className="brand-ai">AI</span></span><span className="brand-beta">BETA</span></Link><div className="workspace-label">ESPAÇO DE TRABALHO</div><Navigation selected={stats.selected}/><div className="sidebar-bottom"><div className="sidebar-tip"><Icon name="shield" size={22}/><strong>Da descoberta à decisão.</strong><p>Organize oportunidades e confira cada informação na fonte oficial.</p><span>Você conduz a análise <Icon name="arrow" size={13}/></span></div><div className="local-label"><span className="status-dot"/>Demonstração local<span>v0.1</span></div></div></aside><div className="workspace"><header className="topbar"><div className="topbar-context">Compras públicas<Icon name="chevron" size={13}/><span>Seu espaço de trabalho</span></div><Link href="/perfil" className="company-menu"><span className="demo-label">EMPRESA DEMO</span><span className="avatar">{profile.name.slice(0, 1).toUpperCase()}</span><span className="company-name">{profile.name}</span><Icon name="chevron" size={14}/></Link></header><main id="main" tabIndex={-1}>{children}</main><footer className="app-footer"><span>LicitAI <span className="footer-dot">·</span> Encontre oportunidades. Acelere sua análise.</span><span>Triagem comercial com revisão humana.</span></footer></div></div></body></html>;
}
