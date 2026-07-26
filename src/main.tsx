import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './styles.css'

/**
 * Conserta a URL quando a Meta anexa os url_tags DEPOIS do '#'.
 *
 * O link do anúncio é  https://aplicadev.com.br/?utm...#/diagnostico
 * e a Meta acrescenta   &cid=...&gid=...&aid=...&plc=...&src=...
 * no fim da URL. Se ela não for fragment-aware, o resultado é
 *   #/diagnostico&cid=120...
 * O HashRouter não casa essa rota, o React Router renderiza null e o
 * visitante vê TELA BRANCA — depois de o PageView já ter disparado.
 * No painel isso apareceria como CTR normal e zero conversão.
 *
 * Aqui trocamos o primeiro '&' por '?' quando não existe '?' antes dele,
 * devolvendo uma querystring válida — e o readUtms() recupera cid/gid/aid.
 *
 * replaceState em vez de location.hash: atribuir ao hash empilha uma
 * entrada no histórico, e o "voltar" do celular levaria de volta à URL
 * quebrada.
 */
function normalizaHash() {
  try {
    const h = window.location.hash
    const iQ = h.indexOf('?')
    const iA = h.indexOf('&')
    // só age quando há '&' e ele vem antes de qualquer '?'
    if (iA > 0 && (iQ === -1 || iA < iQ)) {
      const corrigido = h.slice(0, iA) + '?' + h.slice(iA + 1)
      history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search + corrigido
      )
    }
  } catch { /* nunca impedir o app de subir */ }
}
normalizaHash()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
)
