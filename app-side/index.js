import { BaseSideService } from '@zeppos/zml/base-side'
import { MUN_PADRAO, urlPraias, urlMunicipios, urlHist, montarPayload } from '../shared/praias'

const K_CACHE = (m) => 'praias_payload_' + m
const K_MUNS = 'praias_municipios'

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

const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms))
const msgErro = (e) => String((e && (e.message || e.msg || (e.code != null && 'code ' + e.code))) || e || 'erro')

async function getJSON(url) {
  const res = await fetch({ url, method: 'GET', headers: { Accept: 'application/json' } })
  if (res.status && res.status !== 200) throw new Error('HTTP ' + res.status)
  return typeof res.body === 'string' ? JSON.parse(res.body) : res.body
}

// Uma nova tentativa depois de 1,5 s (o fetch do Zepp App às vezes falha na 1ª)
async function getJSON2(url, etapa) {
  try {
    return await getJSON(url)
  } catch (e) {
    await esperar(1500)
    try {
      return await getJSON(url)
    } catch (e2) {
      throw new Error(etapa + ' ' + msgErro(e2))
    }
  }
}

async function buscar(mun) {
  // 1) praias do município (~6 KB em Ubatuba): essencial
  const praias = await getJSON2(urlPraias(mun), 'P')
  const n = (praias && praias.features && praias.features.length) || 10
  // 2) placar de todos os municípios (~3 KB) e 3) histórico: opcionais
  let muns = null
  try {
    muns = await getJSON2(urlMunicipios(), 'M')
  } catch (e) {}
  let hist = null
  try {
    hist = await getJSON2(urlHist(mun, n), 'H')
  } catch (e) {}
  const payload = montarPayload(mun, praias, muns, hist, lerStore(K_MUNS))
  if (payload.muns && payload.muns.length) gravarStore(K_MUNS, payload.muns)
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
          this.error('falha CETESB:', msgErro(err))
          const cache = lerStore(K_CACHE(mun))
          if (cache) res(null, { ok: true, stale: true, payload: cache })
          else res(null, { ok: false, mun, error: msgErro(err) })
        })
    },
  }),
)
