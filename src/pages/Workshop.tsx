import { useRef, useState } from 'react'
import logoIcon from '../assets/logo-icon-clean.png'
import { upsertLead } from '../lib/db'
import type { LeadDados, Rec, Temperatura } from '../lib/db'
import { Opt, Multi, Q, cryptoId, WA_NUMBER } from './Diagnostico'

/* ═══════════════════════════════════════════════════════════════
   FORMULÁRIO CURTO DE EVENTO (QR do workshop CFK)
   Página única, rolável, pra responder em pé com o celular na mão.
   A pergunta de interesse fica por último: quem marca "não tenho
   interesse" envia sem preencher mais nada.
   Sem pixel/CAPI de propósito: lead de evento não veio de anúncio e
   sujaria o sinal que a campanha usa pra otimizar.
═══════════════════════════════════════════════════════════════ */
const EVENTO = 'workshop-cfk'

type Opcoes = Record<string, string>

const PERFIL: Opcoes = {
  'autonoma-casa': 'Autônoma, atendo em casa ou a domicílio',
  'autonoma-salao': 'Autônoma dentro de um salão ou espaço de outra pessoa',
  'dona-sozinha': 'Tenho meu próprio espaço e atendo sozinha',
  'dona-equipe': 'Tenho meu espaço com equipe',
  comecando: 'Estou começando, ainda montando a clientela',
}
const VOLUME: Opcoes = {
  'ate-10': 'Até 10',
  '10-25': '10 a 25',
  '25-50': '25 a 50',
  '50+': 'Mais de 50',
}
const CANAIS: Opcoes = {
  indicacao: 'Indicação',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  google: 'Google',
  ponto: 'Passa na frente',
}
const AGENDA: Opcoes = {
  whatsapp: 'Pelo WhatsApp mesmo',
  caderno: 'Caderno ou agenda de papel',
  app: 'Uso um app de agendamento',
  'nao-agenda': 'Atendo por ordem de chegada',
}
const SITE: Opcoes = {
  sim: 'Tenho site',
  'so-insta': 'Só Instagram ou link na bio',
  nao: 'Não tenho nada',
}
const GOOGLE: Opcoes = {
  'com-avaliacao': 'Apareço, com avaliações',
  'sem-avaliacao': 'Apareço, mas quase sem avaliação',
  nada: 'Não apareço',
  'nunca-testei': 'Nunca testei',
}
const INTERESSE: Opcoes = {
  sim: 'Tenho, quero conversar com vocês',
  talvez: 'Talvez, quero só o diagnóstico por enquanto',
  nao: 'Não tenho interesse',
}
const SOLUCOES: Opcoes = {
  site: 'Site profissional',
  google: 'Aparecer no Google + plaquinha NFC de avaliação',
  agendamento: 'Agendamento online',
  automacao: 'WhatsApp automático (lembrete, confirmação, resposta)',
  sistema: 'Sistema de gestão (agenda, clientes, financeiro)',
  app: 'Aplicativo próprio',
  'nao-sei': 'Não sei, me ajudem a decidir',
}

const INIT = {
  nome: '', whatsapp: '', instagram: '', cidade: '', negocio: '',
  perfil: '', volume: '', canais: [] as string[], agenda: '', site: '', google: '',
  interesse: '', solucoes: [] as string[], obs: '',
}
type FD = typeof INIT

const digitos = (v: string) => v.replace(/\D/g, '')

/** O que falta preencher. "Não tenho interesse" libera tudo. */
function faltando(d: FD): { id: string; label: string }[] {
  if (d.interesse === 'nao') return []
  const f: { id: string; label: string }[] = []
  if (!d.nome.trim()) f.push({ id: 'wk-nome', label: 'seu nome' })
  if (digitos(d.whatsapp).length < 10) f.push({ id: 'wk-whatsapp', label: 'seu WhatsApp com DDD' })
  if (!d.perfil) f.push({ id: 'wk-perfil', label: 'como você trabalha hoje' })
  if (!d.interesse) f.push({ id: 'wk-interesse', label: 'a última pergunta' })
  return f
}

function recDe(sol: string[]): Rec {
  if (sol.includes('site') || sol.includes('google')) return 'site'
  if (sol.some(s => ['agendamento', 'automacao', 'sistema'].includes(s))) return 'sistema'
  return sol.includes('app') ? 'app' : 'site'
}

const TEMP: Record<string, Temperatura> = { sim: 'QUENTE', talvez: 'MORNO', nao: 'FRIO' }

/** Respostas em texto legível, uma linha por pergunta (é o que o painel lista). */
function resumo(d: FD): string[] {
  const linhas: [string, string][] = [
    ['Como trabalha', PERFIL[d.perfil]],
    ['Clientes por semana', VOLUME[d.volume]],
    ['Cliente nova chega por', d.canais.map(c => CANAIS[c]).join(', ')],
    ['Marca horário', AGENDA[d.agenda]],
    ['Site', SITE[d.site]],
    ['No Google', GOOGLE[d.google]],
    ['Instagram', d.instagram.trim()],
    ['Cidade/bairro', d.cidade.trim()],
    ['Interesse', INTERESSE[d.interesse]],
    ['Soluções', d.solucoes.map(s => SOLUCOES[s]).join(', ')],
    ['Recado', d.obs.trim()],
  ]
  return linhas.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`)
}

function toDados(d: FD): LeadDados {
  return {
    serviceChoice: '', empresaTipo: 'clinica', nicho: 'Nail design / manicure',
    clientesMes: '', ticketMedio: '', canais: d.canais, googleResultado: '',
    agendaMetodo: d.agenda, lembreteAuto: '', visibilidadeFinanceira: '', baseClientes: [],
    recorrencia: '', reativacao: '', donoGargalo: '', horasWhatsapp: '',
    orcamento: '', decisor: '', urgencia: '', perdaRecente: '',
    temSite: d.site, evento: EVENTO, workshop: resumo(d),
  }
}

export default function Workshop() {
  const [d, setD] = useState<FD>(INIT)
  const [erro, setErro] = useState('')
  const [tentou, setTentou] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  // false = o banco não respondeu: as respostas só chegam se ela mandar pelo WhatsApp
  const [salvou, setSalvou] = useState(true)
  const leadId = useRef(cryptoId())

  const set = (f: keyof FD, v: string) => setD(x => ({ ...x, [f]: v }))
  const toggle = (f: 'canais' | 'solucoes', v: string) => setD(x => ({
    ...x, [f]: x[f].includes(v) ? x[f].filter(c => c !== v) : [...x[f], v],
  }))
  const opts = (f: 'perfil' | 'volume' | 'agenda' | 'site' | 'google' | 'interesse', o: Opcoes) =>
    Object.entries(o).map(([v, label]) => (
      <Opt key={v} label={label} selected={d[f] === v} onClick={() => set(f, v)} />
    ))
  const multis = (f: 'canais' | 'solucoes', o: Opcoes) =>
    Object.entries(o).map(([v, label]) => (
      <Multi key={v} label={label} selected={d[f].includes(v)} onClick={() => toggle(f, v)} />
    ))

  const enviar = async () => {
    const f = faltando(d)
    setTentou(true)
    if (f.length) {
      setErro(`Falta: ${f.map(x => x.label).join(', ')}.`)
      // leva até o primeiro campo que falta: o botão fica no fim e o campo lá em cima
      document.getElementById(f[0].id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setErro('')
    // sem nome nem telefone não há lead pra gravar (caso "não tenho interesse" em branco)
    if (d.nome.trim() || digitos(d.whatsapp)) {
      setSaving(true)
      // teto de 8s: wifi de evento trava requisição sem devolver erro
      const { error } = await Promise.race([upsertLead({
        id: leadId.current,
        nome: d.nome || 'Sem nome', whatsapp: d.whatsapp, nome_empresa: d.negocio,
        rec: recDe(d.solucoes), dados: toDados(d), status: 'completo',
        temperatura: TEMP[d.interesse] ?? 'MORNO', score: null,
        utm: { utm_source: EVENTO, utm_medium: 'qr' },
      }), new Promise<{ error: string | null }>(r => setTimeout(() => r({ error: 'timeout' }), 8000))])
      setSaving(false)
      // Falha de banco ou de rede NUNCA prende a pessoa no formulário: num evento
      // ela desiste. A tela final vira "manda pelo WhatsApp", com tudo no texto.
      if (error) setSalvou(false)
    }
    setDone(true)
    window.scrollTo({ top: 0 })
  }

  // depois da 1ª tentativa, marca em vermelho o que falta (o aviso em texto fica lá no fim)
  const ids = tentou ? faltando(d).map(x => x.id) : []
  const falta = (id: string) => (ids.includes(id) ? ' wk-falta' : '')

  const primeiroNome = d.nome.trim().split(' ')[0]
  const waUrl = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent([
    `Oi! Sou ${d.nome.trim()}, estava no workshop da CFK e quero meu diagnóstico.`,
    '',
    ...(d.negocio.trim() ? [`Negócio: ${d.negocio.trim()}`] : []),
    ...resumo(d),
  ].join('\n'))}`
  const falhou = !salvou && d.interesse !== 'nao'

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
                  {d.interesse === 'nao' ? 'Obrigado por responder!' : falhou ? `Falta um toque${primeiroNome ? `, ${primeiroNome}` : ''}!` : `Recebemos${primeiroNome ? `, ${primeiroNome}` : ''}!`}
                </h1>
                <p className="diag-step__sub">
                  {d.interesse === 'nao'
                    ? 'Bom workshop. Se mudar de ideia, é só procurar a gente no intervalo.'
                    : falhou
                      ? 'Toca no botão abaixo pra mandar suas respostas pelo WhatsApp. Já vai tudo escrito, é só enviar. Assim você garante o diagnóstico, os 20% e a plaquinha NFC de brinde.'
                      : 'A gente te chama no WhatsApp com o seu diagnóstico. Seu desconto de 20% e a plaquinha NFC de brinde já estão garantidos.'}
                </p>
              </div>
              {d.interesse !== 'nao' && (
                <div className="diag-nav">
                  <a className="diag-nav__next" href={waUrl} target="_blank" rel="noreferrer">{falhou ? 'Enviar pelo WhatsApp' : 'Quero adiantar pelo WhatsApp'}</a>
                </div>
              )}
            </div>
          ) : (
            <div className="diag-step">
              <div className="diag-step__head">
                <span className="diag-step__emoji">💅</span>
                <h1 className="diag-step__title">Diagnóstico digital grátis</h1>
                <p className="diag-step__sub">
                  Workshop CFK. Leva uns 2 minutos, é quase tudo de tocar. Sem interesse? Rola até o fim e marca a última opção.
                </p>
              </div>

              <div className="diag-fields">
                <div className="diag-field">
                  <label className="diag-label">Seu nome</label>
                  <input id="wk-nome" className={`diag-input${falta('wk-nome')}`} type="text" autoComplete="name" maxLength={80} enterKeyHint="next" placeholder="Como te chamam" value={d.nome} onChange={e => set('nome', e.target.value)} />
                </div>
                <div className="diag-field">
                  <label className="diag-label">Seu WhatsApp <span className="diag-hint">(com DDD)</span></label>
                  <input id="wk-whatsapp" className={`diag-input${falta('wk-whatsapp')}`} type="tel" inputMode="tel" autoComplete="tel" maxLength={20} enterKeyHint="next" placeholder="(88) 9 9999-9999" value={d.whatsapp} onChange={e => set('whatsapp', e.target.value)} />
                </div>
                <div className="diag-field">
                  <label className="diag-label">Seu Instagram de trabalho <span className="diag-hint">(opcional)</span></label>
                  <input className="diag-input" type="text" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={60} placeholder="@seuperfil" value={d.instagram} onChange={e => set('instagram', e.target.value)} />
                </div>
                <div className="diag-field">
                  <label className="diag-label">Nome do seu negócio ou como você se apresenta <span className="diag-hint">(opcional)</span></label>
                  <input className="diag-input" type="text" maxLength={80} placeholder="Ex: Studio Ju Nails" value={d.negocio} onChange={e => set('negocio', e.target.value)} />
                </div>
                <div className="diag-field">
                  <label className="diag-label">Cidade e bairro onde atende <span className="diag-hint">(opcional)</span></label>
                  <input className="diag-input" type="text" maxLength={80} placeholder="Cidade, bairro" value={d.cidade} onChange={e => set('cidade', e.target.value)} />
                </div>
              </div>

              <div className="diag-section">
              <Q label="Como você trabalha hoje?"><div id="wk-perfil" className={`diag-opts-col${falta('wk-perfil')}`}>{opts('perfil', PERFIL)}</div></Q>
              <Q label="Quantas clientes você atende por semana?"><div className="diag-opts-col">{opts('volume', VOLUME)}</div></Q>
              <Q label="Como cliente NOVA costuma te achar? (pode marcar mais de uma)"><div className="diag-opts-col">{multis('canais', CANAIS)}</div></Q>
              <Q label="Como você marca horário?"><div className="diag-opts-col">{opts('agenda', AGENDA)}</div></Q>
              <Q label="Você tem site?"><div className="diag-opts-col">{opts('site', SITE)}</div></Q>
              <Q label="Se pesquisar seu nome no Google, você aparece?"><div className="diag-opts-col">{opts('google', GOOGLE)}</div></Q>

              <Q label="Tem interesse em alguma solução digital da AplicaDev?"><div id="wk-interesse" className={`diag-opts-col${falta('wk-interesse')}`}>{opts('interesse', INTERESSE)}</div></Q>

              {(d.interesse === 'sim' || d.interesse === 'talvez') && (
                  <Q label="Em quais? (pode marcar mais de uma)"><div className="diag-opts-col">{multis('solucoes', SOLUCOES)}</div></Q>
              )}
              </div>

              {(d.interesse === 'sim' || d.interesse === 'talvez') && (
                  <div className="diag-fields">
                    <div className="diag-field">
                      <label className="diag-label">Quer contar mais alguma coisa? <span className="diag-hint">(opcional)</span></label>
                      <textarea className="diag-input ta" rows={3} maxLength={400} placeholder="Sua maior dificuldade hoje, uma ideia, uma dúvida" value={d.obs} onChange={e => set('obs', e.target.value)} />
                    </div>
                  </div>
              )}

              {erro && <p role="alert" className="wk-erro">{erro}</p>}

              <div className="diag-nav">
                <button type="button" className="diag-nav__next" onClick={enviar} disabled={saving}>
                  {saving ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
