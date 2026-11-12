"use client";
import { useActionState } from "react";
import { loadSampleAction, runImportAction, saveNoteAction, saveProfileAction, setSavedAction, type ActionResult } from "@/app/actions";
import { UFS, type Profile } from "@/lib/domain";
import { Icon } from "./icon";

const initial: ActionResult = { success: false, message: "" };
function Feedback({ state }: { state: ActionResult }) {
  return state.message ? <p className={`form-feedback ${state.success ? "success" : "failure"}`} role={state.success ? "status" : "alert"}>{state.message}</p> : null;
}
export function SaveButton({ id, saved, full = false }: { id: string; saved: boolean; full?: boolean }) {
  const [state, action, pending] = useActionState(setSavedAction, initial);
  return <form action={action} className="save-form">
    <input type="hidden" name="id" value={id}/><input type="hidden" name="saved" value={String(!saved)}/>
    <button className={full ? `button ${saved ? "button-secondary" : "button-primary"}` : `icon-button ${saved ? "is-saved" : ""}`} disabled={pending} aria-label={saved ? "Remover da seleção" : "Salvar oportunidade"} title={saved ? "Remover da seleção" : "Salvar oportunidade"} aria-pressed={saved}>
      <Icon name={pending ? "refresh" : "bookmark"} className={pending ? "spin" : undefined}/>{full ? pending ? "Salvando…" : saved ? "Remover da seleção" : "Salvar oportunidade" : null}
    </button>
    {state.message && !state.success ? <p role="alert" className="inline-error">{state.message}</p> : <span className="sr-only" role="status">{state.message}</span>}
  </form>;
}
export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState(saveProfileAction, initial);
  return <form action={action} className="profile-form">
    <div className="form-section"><div className="section-number">01</div><div><h2>Sobre a empresa</h2><p>Um ponto de partida para encontrar oportunidades que fazem sentido para o seu negócio.</p></div></div>
    <label>Nome da empresa<input name="name" defaultValue={profile.name} required minLength={2} maxLength={150} autoComplete="organization"/></label>
    <label>Produtos e serviços<textarea name="description" defaultValue={profile.description} required minLength={10} maxLength={4000} rows={4}/></label>
    <div className="form-divider"/>
    <div className="form-section"><div className="section-number">02</div><div><h2>Interesses de busca</h2><p>Registre seus termos de interesse e o que prefere evitar.</p></div></div>
    <div className="form-two"><label>Termos de interesse<textarea name="interestTerms" defaultValue={profile.interestTerms.join(", ")} rows={3} maxLength={3030} aria-describedby="terms-help"/></label><label>Termos de exclusão<textarea name="exclusionTerms" defaultValue={profile.exclusionTerms.join(", ")} rows={3} maxLength={3030}/></label></div>
    <p className="field-help" id="terms-help">Separe por vírgula ou quebra de linha. Até 30 termos de 100 caracteres por campo.</p>
    <label className="uf-field">UF de interesse<select name="uf" defaultValue={profile.uf}>{UFS.map((uf) => <option key={uf}>{uf}</option>)}</select></label>
    <Feedback state={state}/>
    <div className="form-bottom"><span className="muted text-sm">Perfil demonstrativo · versão {profile.version}</span><button className="button button-primary" disabled={pending}><Icon name={pending ? "refresh" : "check"}/>{pending ? "Salvando…" : "Salvar perfil"}</button></div>
  </form>;
}
export function NoteForm({ id, note }: { id: string; note: string | null }) {
  const [state, action, pending] = useActionState(saveNoteAction, initial);
  return <form action={action} className="note-form"><input type="hidden" name="id" value={id}/><label htmlFor={`note-${id}`}>Suas anotações</label><textarea id={`note-${id}`} name="note" defaultValue={note ?? ""} placeholder="Registre pontos para conferir, dúvidas ou próximos passos…" maxLength={4000} rows={3}/><div className="note-bottom"><Feedback state={state}/><button className="button button-small button-secondary" disabled={pending}>{pending ? "Salvando…" : "Salvar anotação"}</button></div></form>;
}
export function ImportForm({ from, to, uf }: { from: string; to: string; uf: string }) {
  const [state, action, pending] = useActionState(runImportAction, initial);
  return <form action={action} className="import-form"><div className="form-two"><label>Publicação a partir de<input name="from" type="date" defaultValue={from} required/></label><label>Publicação até<input name="to" type="date" defaultValue={to} required/></label><label>UF<select name="uf" defaultValue={uf}>{UFS.map((value) => <option key={value}>{value}</option>)}</select></label><label>Modalidade<select name="modality" defaultValue="6"><option value="6">Pregão eletrônico</option><option value="8">Dispensa</option></select></label></div><p className="field-help">Até 100 registros, em 2 páginas de 50. Período máximo de 31 dias. O período se refere à publicação no PNCP.</p><Feedback state={state}/><button className="button button-primary" disabled={pending}><Icon name="refresh" className={pending ? "spin" : undefined}/>{pending ? "Consultando o PNCP…" : "Importar do PNCP"}</button></form>;
}
export function SampleForm() {
  const [state, action, pending] = useActionState(loadSampleAction, initial);
  return <form action={action}><button className="button button-secondary" disabled={pending}><Icon name="file"/>{pending ? "Carregando…" : "Carregar amostra histórica"}</button><Feedback state={state}/></form>;
}
