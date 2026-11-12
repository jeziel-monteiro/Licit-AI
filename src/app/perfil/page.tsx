import { getStore } from "@/lib/server/store";
import { ProfileForm } from "@/components/forms";
import { Icon } from "@/components/icon";
import { collectionDate } from "@/lib/format";

export const metadata = { title: "Perfil da empresa" };
export default function ProfilePage() {
  const profile = getStore().getProfile();
  return <><div className="page-heading"><div><div className="eyebrow">SEU NEGÓCIO, SEUS INTERESSES</div><h1>Perfil da empresa<span className="green-text">.</span></h1><p>Conte o que sua empresa oferece e quais oportunidades procura.</p></div><span className="badge badge-neutral"><Icon name="building" size={14}/>Empresa de demonstração</span></div><div className="content-with-aside"><section className="panel"><ProfileForm profile={profile}/></section><aside className="help-column"><div className="help-card"><span className="help-icon"><Icon name="search" size={24}/></span><h2>Um perfil mais claro.<br/>Uma busca mais focada.</h2><p>Descreva os produtos que vende, os serviços que presta e o que não oferece.</p><div className="help-divider"/><h3>Como o perfil é usado agora?</h3><p>A UF é o filtro inicial da pesquisa. Os termos ficam registrados para orientar sua revisão e a futura análise.</p><p className="small-note">Os termos de exclusão não removem oportunidades automaticamente.</p></div><div className="subtle-card"><Icon name="clock" size={16}/><p>Última alteração<br/><strong>{collectionDate(profile.updatedAt)} (Brasília)</strong><br/>Versão {profile.version}</p></div></aside></div></>;
}
