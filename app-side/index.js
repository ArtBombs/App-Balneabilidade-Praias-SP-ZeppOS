import { BaseSideService } from '@zeppos/zml/base-side'
import { MUN_PADRAO, urlAtual, urlHist, montarPayload } from '../shared/praias'

const K_CACHE = (m) => 'praias_payload_' + m

function lerStore(k) {
  try {
    const s = settings.settingsStorage.getItem(k)
    return s ? JSON.parse(s) : null
  } catch (e) {
    return null
  }
}

function gravarStore(k, v) {
  try {
    settings.settingsStorage.setItem(k, JSON.stringify(v))
  } catch (e) {}
}

async function getJSON(url) {
  const res = await fetch({ url, method: 'GET', headers: { Accept: 'application/json' } })
  if (res.status && res.status !== 200) throw new Error('HTTP ' + res.status)
  return typeof res.body === 'string' ? JSON.parse(res.body) : res.body
}

async function buscar(mun) {
  // 1) retrato das 175 praias (~36 KB): placar de todos os municípios + praias deste
  const atual = await getJSON(urlAtual())
  const n = (atual.features || []).filter((f) => String(f.attributes && f.attributes.id_municipio) === String(mun)).length
  // 2) histórico só deste município; se falhar, segue sem os quadradinhos
  let hist = null
  try {
    hist = await getJSON(urlHist(mun, n || 10))
  } catch (e) {}
  const payload = montarPayload(mun, atual, hist)
  gravarStore(K_CACHE(payload.mun), payload)
  return payload
}

AppSideService(
  BaseSideService({
    onInit() {},
    onRun() {},
    onDestroy() {},

    onRequest(req, res) {
      if (req.method !== 'praias.get') return res('método desconhecido')
      const p = req.params || {}
      const mun = /^\d{1,5}$/.test(String(p.mun || '')) ? String(p.mun) : MUN_PADRAO

      buscar(mun)
        .then((payload) => res(null, { ok: true, payload }))
        .catch((err) => {
          this.error('falha CETESB:', err && err.message)
          const cache = lerStore(K_CACHE(mun))
          if (cache) res(null, { ok: true, stale: true, payload: cache })
          else res(null, { ok: false, mun, error: String((err && err.message) || err) })
        })
    },
  }),
)
