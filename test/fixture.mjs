// Respostas reais das camadas da CETESB em 17/11/2026 (retrato das 175 praias; histórico de
// Ubatuba, Cubatão e Ilha Comprida — esta com datas repetidas, como vem da camada).
import fs from 'node:fs'
const d = JSON.parse(fs.readFileSync(new URL('./dados/cetesb-2026-11-17.json', import.meta.url), 'utf8'))
export const respAtual = () => ({ features: d.snap.map((a) => ({ attributes: { ...a } })) })
// v1.0.1: o app consulta por município + placar agrupado no servidor; aqui os dois saem do retrato
export const respPraias = (mun) => ({ features: d.snap.filter((a) => String(a.id_municipio) === String(mun)).map((a) => ({ attributes: { ...a } })) })
export function respMuns() {
  const G = {}
  for (const a of d.snap) {
    const k = a.id_municipio
    const g = G[k] || (G[k] = { id_municipio: k, municipio: a.municipio, ugrhi: a.ugrhi, t: 0, p: 0, o: null })
    g.t++
    if (a.qualidade === 1) g.p++
    if (typeof a.ordem === 'number' && (g.o === null || a.ordem < g.o)) g.o = a.ordem
  }
  return { features: Object.values(G).map((g) => ({ attributes: g })) }
}
export const respHist = (mun) => ({ features: (d.hist[mun] || []).map(([id_praia, dt, q]) => ({ attributes: { id_praia, dt_fim_amostragem: dt, qualidade: q } })) })
