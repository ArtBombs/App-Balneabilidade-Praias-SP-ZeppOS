// Respostas reais das camadas da CETESB em 17/11/2026 (retrato das 175 praias; histórico de
// Ubatuba, Cubatão e Ilha Comprida — esta com datas repetidas, como vem da camada).
import fs from 'node:fs'
const d = JSON.parse(fs.readFileSync(new URL('./dados/cetesb-2026-11-17.json', import.meta.url), 'utf8'))
export const respAtual = () => ({ features: d.snap.map((a) => ({ attributes: { ...a } })) })
export const respHist = (mun) => ({ features: (d.hist[mun] || []).map(([id_praia, dt, q]) => ({ attributes: { id_praia, dt_fim_amostragem: dt, qualidade: q } })) })
