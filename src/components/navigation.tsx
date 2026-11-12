"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icon";
const links: { href: string; label: string; icon: IconName }[] = [
  { href: "/oportunidades", label: "Oportunidades", icon: "grid" },
  { href: "/selecionadas", label: "Selecionadas", icon: "bookmark" },
  { href: "/perfil", label: "Perfil da empresa", icon: "building" },
  { href: "/importacoes", label: "Coletas e origem", icon: "refresh" },
];
export function Navigation({ selected }: { selected: number }) {
  const pathname = usePathname();
  return <nav aria-label="Navegação principal" className="navigation">{links.map((link) => <Link key={link.href} href={link.href} className={pathname.startsWith(link.href) ? "nav-link active" : "nav-link"} aria-current={pathname.startsWith(link.href) ? "page" : undefined}><Icon name={link.icon}/><span>{link.label}</span>{link.href === "/selecionadas" ? <span className="nav-count">{selected}</span> : null}</Link>)}</nav>;
}
