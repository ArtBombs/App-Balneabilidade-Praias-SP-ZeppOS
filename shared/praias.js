// Balneabilidade das praias do litoral de SP — camadas públicas do mapa da CETESB (ArcGIS).
// Retrato atual: Hosted/Praias/FeatureServer/0 ("Praias_v3", 175 praias, 1 linha por praia), consultado por município.
// Histórico semanal: Hosted/Praias_Amostragem/FeatureServer/4 ("Praias_Coletas", desde 29/10/2023).
// Verificado em 17/11/2026. qualidade: 1 = própria, 0 = imprópria.

const BASE = 'https://arcgis.cetesb.sp.gov.br/server/rest/services/Hosted/'
export const URL_ATUAL = BASE + 'Praias/FeatureServer/0/query'
export const URL_HIST = BASE + 'Praias_Amostragem/FeatureServer/4/query'
export const HIST_VIS = 4 // semanas anteriores mostradas por praia
export const MAX_PONTOS = 35 // Ubatuba tem 35 praias (7 telas de 5)
export const MUN_PADRAO = '701' // Ubatuba (1º município de norte a sul)

// v1.0.1: a consulta única das 175 praias (~45 KB) falhava no fetch do Zepp App ("network error").
// Agora são 3 respostas pequenas: praias do município (~6 KB), placar por município (~3 KB) e histórico.
const CAMPOS_PRAIAS = 'ordem,id_praia,praia,qualidade,classificacao_texto,data_amostra_final'
const ESTAT = [
  { statisticType: 'count', onStatisticField: 'id_praia', outStatisticFieldName: 't' },
  { statisticType: 'sum', onStatisticField: 'qualidade', outStatisticFieldName: 'p' },
  { statisticType: 'min', onStatisticField: 'ordem', outStatisticFieldName: 'o' },
]
const soDig = (m) => String(m).replace(/\D/g, '')

// Praias de um município (essencial)
export function urlPraias(mun) {
  return (
    URL_ATUAL + '?f=json&returnGeometry=false&orderByFields=ordem&outFields=' + CAMPOS_PRAIAS +
    '&where=' + encodeURIComponent("id_municipio='" + soDig(mun) + "'")
  )
}

// Placar de todos os municípios (para a lista), agrupado no servidor
export function urlMunicipios() {
  return (
    URL_ATUAL + '?f=json&where=1%3D1&groupByFieldsForStatistics=id_municipio,municipio,ugrhi' +
    '&outStatistics=' + encodeURIComponent(JSON.stringify(ESTAT))
  )
}

// Últimas semanas do município (5 por praia: 4 anteriores + a atual)
export function urlHist(mun, nPraias) {
  return (
    URL_HIST +
    '?f=json&returnGeometry=false&outFields=id_praia,dt_fim_amostragem,qualidade' +
    '&orderByFields=dt_fim_amostragem%20DESC&resultRecordCount=' + Math.max(10, nPraias * 5) +
    '&where=' + encodeURIComponent("id_municipio='" + soDig(mun) + "'")
  )
}

// Datas da camada: ms. Meia-noite de Brasília → "YYYY-MM-DD".
export const dia = (ms) => (typeof ms === 'number' && isFinite(ms) ? new Date(ms - 3 * 3600e3).toISOString().slice(0, 10) : null)

// P = própria · I = imprópria · N = sem classificação
export function classe(q, txt) {
  if (q === 1 || q === '1') return 'P'
  if (q === 0 || q === '0') return 'I'
  const t = String(txt || '').toLowerCase()
  return t.startsWith('pr') ? 'P' : t.startsWith('impr') ? 'I' : 'N'
}

// ─── Nomes: "ENSEADA - AV. ATLÂNTICA" → { n: "Enseada", l: "Av. Atlântica" } ───
const MINUSC = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])
const SIGLAS = new Set(['AFPESP'])
export function titulo(s) {
  return String(s || '')
    .trim()
    .split(/\s+/)
    .map((w, i) => {
      if (SIGLAS.has(w.replace(/[^A-ZÀ-Ú]/g, ''))) return w
      const lw = w.toLowerCase()
      if (i > 0 && MINUSC.has(lw)) return lw
      // primeira letra (depois de "(") em maiúscula; o resto em minúscula
      return lw.replace(/^(\(?)(\p{L})/u, (m, p, c) => p + c.toUpperCase()).replace(/-(\p{L})/gu, (m, c) => '-' + c.toUpperCase())
    })
    .join(' ')
}

// Só separa em " - " / "- " (hífen seguido de espaço): "PEREQUÊ-AÇU" continua inteiro.
export function partirNome(praia) {
  const m = String(praia || '').split(/\s*-\s+/)
  const n = titulo(m[0])
  const l = m.length > 1 ? titulo(m.slice(1).join(' - ')) : ''
  return { n, l }
}

// Municípios (resposta agrupada do servidor) → [{id, n, r, p, t}] de norte a sul pela menor "ordem"
export function listarMunicipios(feats) {
  return (feats || [])
    .map((f) => f.attributes || f)
    .filter((a) => a && a.id_municipio != null)
    .map((a) => ({
      id: String(a.id_municipio),
      n: titulo(a.municipio),
      r: a.ugrhi || '',
      p: Number(a.p) || 0,
      t: Number(a.t) || 0,
      o: typeof a.o === 'number' ? a.o : Infinity,
    }))
    .sort((a, b) => a.o - b.o)
    .map(({ id, n, r, p, t }) => ({ id, n, r, p, t }))
}

// Histórico: { id_praia: ['P','I',…] } com as semanas ANTERIORES à atual, mais antiga primeiro,
// sem datas repetidas (a camada às vezes repete a mesma coleta).
export function montarHist(feats, datasAtuais) {
  const por = {}
  for (const f of feats || []) {
    const a = f.attributes || f
    const id = a.id_praia
    const d = dia(a.dt_fim_amostragem)
    if (!id || !d) continue
    const L = por[id] || (por[id] = {})
    if (!(d in L)) L[d] = classe(a.qualidade)
  }
  const out = {}
  for (const id of Object.keys(por)) {
    const atual = datasAtuais[id]
    const datas = Object.keys(por[id]).filter((d) => !atual || d < atual).sort()
    out[id] = datas.slice(-HIST_VIS).map((d) => por[id][d])
  }
  return out
}

// Praias do município (+ placar de todos + histórico, ambos opcionais) → pacote pequeno para o relógio.
// munsReserva: lista salva antes, usada se o placar falhar.
export function montarPayload(mun, bodyPraias, bodyMuns, bodyHist, munsReserva) {
  if (!bodyPraias || bodyPraias.error) throw new Error('ArcGIS: ' + ((bodyPraias && bodyPraias.error && bodyPraias.error.message) || 'resposta vazia'))
  const daqui = (bodyPraias.features || [])
    .map((f) => f.attributes || {})
    .sort((a, b) => (a.ordem ?? 1e9) - (b.ordem ?? 1e9))
    .slice(0, MAX_PONTOS)
  if (!daqui.length) throw new Error('nenhuma praia')
  let muns = bodyMuns && !bodyMuns.error ? listarMunicipios(bodyMuns.features) : []
  if (!muns.length && Array.isArray(munsReserva)) muns = munsReserva
  const m = muns.find((x) => x.id === String(mun)) || { id: String(mun), n: '', r: '' }

  const datasAtuais = {}
  for (const a of daqui) datasAtuais[a.id_praia] = dia(a.data_amostra_final)
  const hist = bodyHist && !bodyHist.error ? montarHist(bodyHist.features, datasAtuais) : {}

  const pts = daqui.map((a) => {
    const { n, l } = partirNome(a.praia)
    return { c: a.id_praia, n, l, k: classe(a.qualidade, a.classificacao_texto), h: hist[a.id_praia] || [] }
  })
  // Mesmo nome sem local (ex.: 2 pontos "Itaguá" em Ubatuba) → "#1", "#2"
  const cont = {}
  pts.forEach((p) => (cont[p.n + '|' + p.l] = (cont[p.n + '|' + p.l] || 0) + 1))
  const seq = {}
  pts.forEach((p) => {
    const k = p.n + '|' + p.l
    if (cont[k] > 1 && !p.l) p.l = '#' + (seq[k] = (seq[k] || 0) + 1)
  })

  let d = null
  for (const a of daqui) {
    const x = dia(a.data_amostra_final)
    if (x && (!d || x > d)) d = x
  }
  return { mun: m.id, nome: m.n, reg: m.r, d, pts, muns, ts: Date.now() }
}
