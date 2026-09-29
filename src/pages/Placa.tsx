import { useRef, useState } from 'react'
import logoIcon from '../assets/logo-icon-clean.png'
import { Opt, Multi, Q, cryptoId } from './Diagnostico'
import { origemDaUrl, cardKanban, dadosEvento, enviarLeadEvento, digitos, utmEvento, waLink } from '../lib/evento'

/* ═══════════════════════════════════════════════════════════════
   PEDIDO DA PLAQUINHA NFC (QR do acrílico, atrás da plaquinha do stand)
   No evento não se vende nada: é um pré-pedido. A pessoa diz quantas
   quer, onde instalar e quando dá pra gente ir. A equipe confirma valor
   (com os 20% do evento) e dia no WhatsApp, leva, instala e ela paga na
   instalação. Nenhum preço na tela, nenhum pagamento aqui.
═══════════════════════════════════════════════════════════════ */
type Opcoes = Record<string, string>

const QTD: Opcoes = { '1': '1 plaquinha', '2': '2 plaquinhas', '3+': '3 ou mais' }
const MAPS: Opcoes = { sim: 'Sim, já aparece', nao: 'Ainda não', 'nao-sei': 'Não sei' }
const QUANDO: Opcoes = {
  semana: 'Essa semana, se der',
  proxima: 'Semana que vem',
  chamar: 'Prefiro que vocês me chamem pra combinar',
}
const DIAS: Opcoes = { seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex', sab: 'Sáb' }
const HORAS: Opcoes = { manha: 'Manhã', tarde: 'Tarde', fim: 'Fim do dia' }

const INIT = {
  nome: '', whatsapp: '', negocio: '', qtd: '1', maps: '',
  rua: '', complemento: '', bairro: '', cidade: '', cep: '',
  quando: '', dias: [] as string[], horas: [] as string[], obs: '',
}
type FD = typeof INIT
type Lista = 'dias' | 'horas'

const agenda = (d: FD) => d.quando === 'semana' || d.quando === 'proxima'

function faltando(d: FD): { id: string; label: string }[] {
  const f: { id: string; label: string }[] = []
  if (!d.nome.trim()) f.push({ id: 'pl-nome', label: 'seu nome' })
  if (digitos(d.whatsapp).length < 10) f.push({ id: 'pl-whatsapp', label: 'seu WhatsApp com DDD' })
  if (!d.negocio.trim()) f.push({ id: 'pl-negocio', label: 'o nome do negócio' })
  if (!d.rua.trim()) f.push({ id: 'pl-rua', label: 'rua e número' })
  if (!d.bairro.trim()) f.push({ id: 'pl-bairro', label: 'o bairro' })
  if (!d.cidade.trim()) f.push({ id: 'pl-cidade', label: 'a cidade' })
  if (!d.quando) f.push({ id: 'pl-quando', label: 'quando a gente pode ir' })
  if (agenda(d) && !d.dias.length) f.push({ id: 'pl-dias', label: 'o melhor dia' })
  if (agenda(d) && !d.horas.length) f.push({ id: 'pl-horas', label: 'o melhor horário' })
  return f
}

const lista = (vs: string[], o: Opcoes) => Object.keys(o).filter(k => vs.includes(k)).map(k => o[k]).join(', ')

/** Uma linha por resposta. Os rótulos Interesse, Soluções, Cidade/bairro e
 *  Recado são os que o Kanban lê (temperatura e resumo do card). */
function resumo(d: FD): string[] {
  const instalacao = agenda(d)
    ? `${QUANDO[d.quando]} · ${lista(d.dias, DIAS)} · ${lista(d.horas, HORAS)}`
    : QUANDO[d.quando]
  const linhas: [string, string][] = [
    ['Interesse', 'Tenho, quero a plaquinha com 20% do evento'],
    ['Soluções', `Plaquinha NFC de avaliação (${QTD[d.qtd]})`],
    ['No Google Maps', MAPS[d.maps]],
    ['Endereço de instalação', [d.rua, d.complemento, d.cep && `CEP ${d.cep}`].map(s => s.trim()).filter(Boolean).join(', ')],
    ['Cidade/bairro', [d.bairro, d.cidade].map(s => s.trim()).filter(Boolean).join(', ')],
    ['Instalação', instalacao],
    ['Recado', d.obs.trim()],
  ]
  return linhas.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`)
}

const PASSOS = [
  ['Você manda o pedido agora', 'Sem pagar nada aqui no evento.'],
  ['A gente te chama no WhatsApp', 'Pra confirmar o valor, já com 20% de desconto, e o dia.'],
  ['A gente leva e instala', 'No seu endereço. Você paga na instalação.'],
]

export default function Placa({ evento = 'formatura-cfk', peca = 'acrilico' }: { evento?: string; peca?: string }) {
  const [o] = useState(() => origemDaUrl(evento, peca))
  const [d, setD] = useState<FD>(INIT)
  const [erro, setErro] = useState('')
  const [tentou, setTentou] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  // false = Kanban e banco não responderam: o pedido só chega se ela mandar pelo WhatsApp
  const [salvou, setSalvou] = useState(true)
  const leadId = useRef(cryptoId())

  const set = (f: keyof FD, v: string) => setD(x => ({ ...x, [f]: v }))
  const toggle = (f: Lista, v: string) => setD(x => ({
    ...x, [f]: x[f].includes(v) ? x[f].filter(c => c !== v) : [...x[f], v],
  }))
  const opts = (f: 'qtd' | 'maps' | 'quando', op: Opcoes) => Object.entries(op).map(([v, label]) => (
    <Opt key={v} label={label} selected={d[f] === v} onClick={() => set(f, v)} />
  ))
  const multis = (f: Lista, op: Opcoes) => Object.entries(op).map(([v, label]) => (
    <Multi key={v} label={label} selected={d[f].includes(v)} onClick={() => toggle(f, v)} />
  ))

  const ids = tentou ? faltando(d).map(x => x.id) : []
  const falta = (id: string) => (ids.includes(id) ? ' wk-falta' : '')
  const campo = (id: string, f: keyof FD, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> & { hint?: string } = {}) => {
    const { hint, ...props } = extra
    return (
      <div className="diag-field">
        <label className="diag-label" htmlFor={id}>{label}{hint && <> <span className="diag-hint">({hint})</span></>}</label>
        <input id={id} className={`diag-input${falta(id)}`} type="text" maxLength={80} value={d[f] as string} onChange={e => set(f, e.target.value)} {...props} />
      </div>
    )
  }

  const enviar = async () => {
    const f = faltando(d)
    setTentou(true)
    if (f.length) {
      setErro(`Falta: ${f.map(x => x.label).join(', ')}.`)
      document.getElementById(f[0].id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setErro('')
    setSaving(true)
    const linhas = resumo(d)
    const ok = await enviarLeadEvento({
      id: leadId.current,
      nome: d.nome, whatsapp: d.whatsapp, nome_empresa: d.negocio,
      rec: 'site', dados: dadosEvento(o, linhas), status: 'completo',
      temperatura: 'QUENTE', score: null, utm: utmEvento(o),
    }, cardKanban(o, `🛒 Pedido de plaquinha · ${o.nome}`, d, linhas))
    setSaving(false)
    setSalvou(ok)
    setDone(true)
    window.scrollTo({ top: 0 })
  }

  const primeiroNome = d.nome.trim().split(' ')[0]
  const waUrl = waLink([
    `Oi! Sou ${d.nome.trim()}, estava no evento ${o.nome} e quero a plaquinha NFC com os 20% do evento.`,
    '',
    `Negócio: ${d.negocio.trim()}`,
    ...resumo(d).slice(1),
  ])

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
                  {salvou ? `Pedido anotado, ${primeiroNome}!` : `Falta um toque, ${primeiroNome}!`}
                </h1>
                <p className="diag-step__sub">
                  {salvou
                    ? (agenda(d)
                      ? 'A gente te chama no WhatsApp pra confirmar o valor com os 20% e fechar o dia da instalação. Você só paga quando a gente instalar.'
                      : 'A gente te chama no WhatsApp pra combinar o valor com os 20% e o melhor dia. Você só paga quando a gente instalar.')
                    : 'Toca no botão abaixo pra mandar o pedido pelo WhatsApp. Já vai tudo escrito, é só enviar.'}
                </p>
              </div>
              <div className="diag-nav">
                <a className="diag-nav__next" href={waUrl} target="_blank" rel="noreferrer">{salvou ? 'Falar agora no WhatsApp' : 'Enviar pedido pelo WhatsApp'}</a>
              </div>
            </div>
          ) : (
            <div className="diag-step">
              <div className="diag-step__head">
                <span className="diag-step__emoji">📲</span>
                <h1 className="diag-step__title">Sua plaquinha NFC com 20% de desconto</h1>
                <p className="diag-step__sub">
                  {o.nome}. A cliente encosta o celular na plaquinha e já cai na tela de avaliar seu negócio no Google. Pede a sua aqui:
                </p>
              </div>

              <div className="diag-travas" style={{ marginBottom: 28 }}>
                {PASSOS.map(([t, desc], i) => (
                  <div key={t} className="diag-trava">
                    <span className="diag-trava__num">{i + 1}</span>
                    <div className="diag-trava__body">
                      <div className="diag-trava__title">{t}</div>
                      <div className="diag-trava__desc">{desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="diag-fields">
                {campo('pl-nome', 'nome', 'Seu nome', { autoComplete: 'name', placeholder: 'Como te chamam' })}
                {campo('pl-whatsapp', 'whatsapp', 'Seu WhatsApp', { hint: 'com DDD', type: 'tel', inputMode: 'tel', autoComplete: 'tel', maxLength: 20, placeholder: '(11) 9 9999-9999' })}
                {campo('pl-negocio', 'negocio', 'Nome do negócio', { hint: 'como aparece ou vai aparecer no Google', autoComplete: 'organization', placeholder: 'Ex: Studio Ju Beleza' })}
              </div>

              <div className="diag-section">
                <Q label="Quantas plaquinhas?"><div className="diag-opts-col">{opts('qtd', QTD)}</div></Q>
                <Q label="Seu negócio já aparece no Google Maps?"><div className="diag-opts-col">{opts('maps', MAPS)}</div></Q>
                <Q label="Onde a gente instala?">
                  <div className="diag-fields">
                    {campo('pl-rua', 'rua', 'Rua e número', { autoComplete: 'address-line1', maxLength: 120, placeholder: 'Ex: Rua das Flores, 120' })}
                    {campo('pl-complemento', 'complemento', 'Complemento', { hint: 'opcional', autoComplete: 'address-line2', placeholder: 'Sala, loja, referência' })}
                    {campo('pl-bairro', 'bairro', 'Bairro', { placeholder: 'Bairro' })}
                    {campo('pl-cidade', 'cidade', 'Cidade', { autoComplete: 'address-level2', placeholder: 'Cidade' })}
                    {campo('pl-cep', 'cep', 'CEP', { hint: 'opcional', inputMode: 'numeric', autoComplete: 'postal-code', maxLength: 9, placeholder: '00000-000' })}
                  </div>
                </Q>
              </div>

              <div className="diag-section">
                <Q label="Quando a gente pode levar e instalar?">
                  <div id="pl-quando" className={`diag-opts-col${falta('pl-quando')}`}>{opts('quando', QUANDO)}</div>
                </Q>
                {agenda(d) && <>
                  <Q label="Quais dias são bons? (pode marcar mais de um)">
                    <div id="pl-dias" className={`diag-opts-multi pl-dias${falta('pl-dias')}`}>{multis('dias', DIAS)}</div>
                  </Q>
                  <Q label="Qual horário?">
                    <div id="pl-horas" className={`diag-opts-col${falta('pl-horas')}`}>{multis('horas', HORAS)}</div>
                  </Q>
                </>}
              </div>

              <div className="diag-fields">
                <div className="diag-field">
                  <label className="diag-label" htmlFor="pl-obs">Algum detalhe pra instalação? <span className="diag-hint">(opcional)</span></label>
                  <textarea id="pl-obs" className="diag-input ta" rows={3} maxLength={400} placeholder="Ex: o espaço abre às 9h, procurar a Ju" value={d.obs} onChange={e => set('obs', e.target.value)} />
                </div>
              </div>

              {erro && <p role="alert" className="wk-erro">{erro}</p>}

              <div className="diag-nav">
                <button type="button" className="diag-nav__next" onClick={enviar} disabled={saving}>
                  {saving ? 'Enviando...' : 'Enviar pedido'}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
