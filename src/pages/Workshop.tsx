import { useRef, useState } from 'react'
import logoIcon from '../assets/logo-icon-clean.png'
import type { Rec, Temperatura } from '../lib/db'
import { Opt, Multi, Q, cryptoId } from './Diagnostico'
import { origemDaUrl, cardKanban, dadosEvento, enviarLeadEvento, digitos, utmEvento, waLink } from '../lib/evento'

/* ═══════════════════════════════════════════════════════════════
   FORMULÁRIO RÁPIDO DE EVENTO (QR do banner, do cartão e do telão)
   Pega o contato e o que a pessoa quer, pra equipe chamar no WhatsApp
   já sabendo o assunto. Página única, pra responder em pé em 1 minuto.
   Quem já quer a plaquinha vai pelo QR do acrílico (/placa).
   Cartão de visita (?de=cartao): genérico, sem evento nem desconto.
   Só o contato (negócio e Instagram opcionais) e já cai no WhatsApp
   com a mensagem pronta: quem
   pega cartão vai embora, a conversa tem que começar ali.
═══════════════════════════════════════════════════════════════ */
type Opcoes = Record<string, string>

const SOLUCOES: Opcoes = {
  site: 'Site profissional',
  google: 'Aparecer no Google + plaquinha NFC de avaliação',
  agendamento: 'Agendamento online',
  automacao: 'WhatsApp automático (lembrete, confirmação, resposta)',
  sistema: 'Sistema de gestão (agenda, clientes, financeiro)',
  app: 'Aplicativo próprio',
  'nao-sei': 'Ainda não sei, quero conversar',
}
// Os textos casam com a temperatura do Kanban: "tenho" = quente, "talvez" = morno, "não" = frio
const INTERESSE: Opcoes = {
  agora: 'Tenho, quero começar agora',
  talvez: 'Talvez, nos próximos meses',
  nao: 'Não agora, só conhecendo',
}
const TEMP: Record<string, Temperatura> = { agora: 'QUENTE', talvez: 'MORNO', nao: 'FRIO' }

// semNegocio/semInsta: "ainda não tenho" dito de propósito (quem está começando), diferente de deixar em branco
const INIT = { nome: '', whatsapp: '', negocio: '', semNegocio: false, instagram: '', semInsta: false, solucoes: [] as string[], interesse: '', obs: '' }
type FD = typeof INIT

function faltando(d: FD, rapido: boolean): { id: string; label: string }[] {
  const f: { id: string; label: string }[] = []
  if (!d.nome.trim()) f.push({ id: 'wk-nome', label: 'seu nome' })
  if (digitos(d.whatsapp).length < 10) f.push({ id: 'wk-whatsapp', label: 'seu WhatsApp com DDD' })
  if (!rapido && !d.interesse) f.push({ id: 'wk-interesse', label: 'se tem interesse' })
  return f
}

function recDe(sol: string[]): Rec {
  if (sol.includes('site') || sol.includes('google')) return 'site'
  if (sol.some(s => ['agendamento', 'automacao', 'sistema'].includes(s))) return 'sistema'
  return sol.includes('app') ? 'app' : 'site'
}

/** Respostas em texto legível, uma linha por pergunta (é o que o Kanban e o painel listam). */
function resumo(d: FD): string[] {
  const linhas: [string, string][] = [
    ['Negócio', d.semNegocio ? 'Ainda não tenho' : ''],
    ['Soluções', d.solucoes.map(s => SOLUCOES[s]).join(', ')],
    ['Interesse', INTERESSE[d.interesse]],
    ['Instagram', d.semInsta ? 'Ainda não tenho' : d.instagram.trim()],
    ['Recado', d.obs.trim()],
  ]
  return linhas.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`)
}

export default function Workshop({ evento = 'workshop-cfk', peca = 'telao' }: { evento?: string; peca?: string }) {
  const [o] = useState(() => origemDaUrl(evento, peca))
  const [d, setD] = useState<FD>(INIT)
  const [tentou, setTentou] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  // false = Kanban e banco não responderam: as respostas só chegam se ela mandar pelo WhatsApp
  const [salvou, setSalvou] = useState(true)
  const leadId = useRef(cryptoId())
  const rapido = o.de === 'cartao'

  const set = (f: keyof FD, v: string) => setD(x => ({ ...x, [f]: v }))
  const naoTem = (f: 'negocio' | 'instagram', flag: 'semNegocio' | 'semInsta') =>
    setD(x => ({ ...x, [f]: '', [flag]: !x[flag] }))
  const toggle = (v: string) => setD(x => ({
    ...x, solucoes: x.solucoes.includes(v) ? x.solucoes.filter(c => c !== v) : [...x.solucoes, v],
  }))

  const primeiroNome = d.nome.trim().split(' ')[0]
  const extra = [...(d.negocio.trim() ? [`Negócio: ${d.negocio.trim()}`] : []), ...resumo(d)]
  const waUrl = waLink([
    rapido
      ? `Oi! Sou ${d.nome.trim()}, peguei o cartão da AplicaDev e quero saber mais.`
      : `Oi! Sou ${d.nome.trim()}, estava no evento ${o.nome} e quero saber mais da AplicaDev.`,
    ...(extra.length ? ['', ...extra] : []),
  ])

  const enviar = async () => {
    const f = faltando(d, rapido)
    setTentou(true)
    if (f.length) {
      // leva até o primeiro campo que falta: o botão fica no fim e o campo lá em cima
      document.getElementById(f[0].id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setSaving(true)
    const linhas = resumo(d)
    const ok = await enviarLeadEvento({
      id: leadId.current,
      nome: d.nome, whatsapp: d.whatsapp, nome_empresa: d.negocio,
      rec: recDe(d.solucoes), dados: dadosEvento(o, linhas), status: 'completo',
      temperatura: TEMP[d.interesse] ?? 'MORNO', score: null, utm: utmEvento(o),
    }, cardKanban(o, `🎤 ${o.nome}`, d, linhas))
    setSaving(false)
    // Falha de banco ou de rede NUNCA prende a pessoa no formulário: num evento
    // ela desiste. A tela final vira "manda pelo WhatsApp", com tudo no texto.
    setSalvou(ok)
    setDone(true)
    window.scrollTo({ top: 0 })
    // cartão: salvou ou não, segue direto pro WhatsApp (o nome vai na mensagem)
    if (rapido) window.location.href = waUrl
  }

  // depois da 1ª tentativa, marca em vermelho o que falta e o aviso some sozinho quando completa
  const faltam = tentou ? faltando(d, rapido) : []
  const ids = faltam.map(x => x.id) : []
  const falta = (id: string) => (ids.includes(id) ? ' wk-falta' : '')

  const frio = d.interesse === 'nao'

  return (
    <div className="diag-page wk">
      <header className="diag-header">
        <span className="diag-logo">
          <img src={logoIcon} alt="AplicaDev" />
          <span>Aplica<strong>Dev</strong></span>
        </span>
      </header>

      <main className="diag-main">
        <div className="diag-card">
          {done ? (
            <div className="diag-step">
              <div className="diag-step__head">
                <span className="diag-step__emoji">💚</span>
                <h1 className="diag-step__title">
                  {rapido ? `Abrindo o WhatsApp, ${primeiroNome}!` : !salvou ? `Falta um toque${primeiroNome ? `, ${primeiroNome}` : ''}!` : `Recebemos, ${primeiroNome}!`}
                </h1>
                <p className="diag-step__sub">
                  {rapido
                    ? 'Se não abriu sozinho, toca no botão abaixo. A mensagem já vai escrita, é só enviar que a gente responde.'
                    : !salvou
                    ? 'Toca no botão abaixo pra mandar pelo WhatsApp. Já vai tudo escrito, é só enviar. Assim seus 20% do evento ficam garantidos.'
                    : frio
                      ? 'Quando quiser começar, é só chamar a gente no WhatsApp (11) 97645-0441.'
                      : 'A gente te chama no WhatsApp pra entender o que você precisa. Seus 20% de desconto do evento já estão garantidos.'}
                </p>
              </div>
              {(rapido || !salvou || !frio) && (
                <div className="diag-nav">
                  <a className="diag-nav__next" href={waUrl} target="_blank" rel="noreferrer">{rapido ? 'Abrir o WhatsApp' : !salvou ? 'Enviar pelo WhatsApp' : 'Quero adiantar pelo WhatsApp'}</a>
                </div>
              )}
            </div>
          ) : (
            <div className="diag-step">
              <div className="diag-step__head">
                <span className="diag-step__emoji">✨</span>
                <h1 className="diag-step__title">{rapido ? 'Bora conversar?' : '20% de desconto pra quem está aqui'}</h1>
                <p className="diag-step__sub">
                  {rapido
                    ? 'Site, sistema, agendamento e automação pro seu negócio. Deixa seu contato e a conversa continua direto no WhatsApp. Leva 20 segundos.'
                    : `${o.nome}. Vale pra qualquer projeto da AplicaDev e, se você fechar, a plaquinha NFC de avaliação é brinde. Deixa seu contato que a gente te chama pra um papo rápido. Leva 1 minuto.`}
                </p>
              </div>

              <div className="diag-fields">
                <div className="diag-field">
                  <label className="diag-label" htmlFor="wk-nome">Seu nome</label>
                  <input id="wk-nome" className={`diag-input${falta('wk-nome')}`} type="text" autoComplete="name" maxLength={80} enterKeyHint="next" placeholder="Como te chamam" value={d.nome} onChange={e => set('nome', e.target.value)} />
                </div>
                <div className="diag-field">
                  <label className="diag-label" htmlFor="wk-whatsapp">Seu WhatsApp <span className="diag-hint">(com DDD)</span></label>
                  <input id="wk-whatsapp" className={`diag-input${falta('wk-whatsapp')}`} type="tel" inputMode="tel" autoComplete="tel" maxLength={20} enterKeyHint="next" placeholder="(11) 9 9999-9999" value={d.whatsapp} onChange={e => set('whatsapp', e.target.value)} />
                </div>
                <div className="diag-field">
                  <label className="diag-label" htmlFor="wk-negocio">Nome do seu negócio <span className="diag-hint">(se tiver)</span></label>
                  <input id="wk-negocio" className="diag-input" type="text" maxLength={80} placeholder="Ex: Studio Ju Beleza" value={d.negocio} disabled={d.semNegocio} onChange={e => set('negocio', e.target.value)} />
                  <label className="wk-nao-tem"><input type="checkbox" checked={d.semNegocio} onChange={() => naoTem('negocio', 'semNegocio')} /> Ainda não tenho</label>
                </div>
                <div className="diag-field">
                  <label className="diag-label" htmlFor="wk-insta">Seu Instagram de trabalho <span className="diag-hint">(opcional)</span></label>
                  <input id="wk-insta" className="diag-input" type="text" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={60} placeholder="@seuperfil" value={d.instagram} disabled={d.semInsta} onChange={e => set('instagram', e.target.value)} />
                  <label className="wk-nao-tem"><input type="checkbox" checked={d.semInsta} onChange={() => naoTem('instagram', 'semInsta')} /> Ainda não tenho</label>
                </div>
              </div>

              {!rapido && <>
              <div className="diag-section">
                <Q label="O que você quer pro seu negócio? (pode marcar mais de uma)">
                  <div className="diag-opts-col">
                    {Object.entries(SOLUCOES).map(([v, label]) => (
                      <Multi key={v} label={label} selected={d.solucoes.includes(v)} onClick={() => toggle(v)} />
                    ))}
                  </div>
                </Q>
                <Q label="Tem interesse em começar com a gente?">
                  <div id="wk-interesse" className={`diag-opts-col${falta('wk-interesse')}`}>
                    {Object.entries(INTERESSE).map(([v, label]) => (
                      <Opt key={v} label={label} selected={d.interesse === v} onClick={() => set('interesse', v)} />
                    ))}
                  </div>
                </Q>
              </div>

              <div className="diag-fields">
                <div className="diag-field">
                  <label className="diag-label" htmlFor="wk-obs">Quer contar mais alguma coisa? <span className="diag-hint">(opcional)</span></label>
                  <textarea id="wk-obs" className="diag-input ta" rows={3} maxLength={400} placeholder="Sua maior dificuldade hoje, uma ideia, uma dúvida" value={d.obs} onChange={e => set('obs', e.target.value)} />
                </div>
              </div>
              </>}

              {faltam.length > 0 && <p role="alert" className="wk-erro">Falta: {faltam.map(x => x.label).join(', ')}.</p>}

              <div className="diag-nav">
                <button type="button" className="diag-nav__next" onClick={enviar} disabled={saving}>
                  {saving ? 'Enviando...' : rapido ? 'Continuar no WhatsApp' : 'Enviar'}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
