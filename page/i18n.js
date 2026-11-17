// Idioma da interface. Relógio em português (pt-BR 20 · pt-PT 15) → português;
// qualquer outro idioma → inglês (a loja da Zepp exige inglês como idioma padrão).
// Tabela: docs.zepp.com › Related Resources › Multilingual Mapping (getLanguage de @zos/settings).
// Namespace com checagem: firmware sem getLanguage cai em português. Mesmo esquema do Mananciais SP.
// Nomes de praias, locais, municípios e regiões NÃO são traduzidos (nomes próprios).
import * as zosSettings from '@zos/settings'

function detectar() {
  try {
    if (typeof zosSettings.getLanguage === 'function') {
      const c = Number(zosSettings.getLanguage())
      if (!isNaN(c)) return c === 20 || c === 15 ? 'pt' : 'en'
    }
  } catch (e) {}
  return 'pt'
}

export const LANG = detectar()
export const EN = LANG === 'en'

// Chave = id curto; valor = [português, inglês]
const T = {
  propria: ['Própria', 'Safe'],
  impropria: ['Imprópria', 'Unsafe'],
  naoClass: ['Sem classificação', 'Not rated'],
  paraBanho1: ['própria para banho', 'safe for swimming'],
  paraBanhoN: ['próprias para banho', 'safe for swimming'],
  paraBanho0: ['para banho', 'safe for swimming'],
  impr1: [' imprópria', ' unsafe'],
  imprN: [' impróprias', ' unsafe'],
  nenhumaImpr: ['nenhuma imprópria', 'none unsafe'],
  atualizando: ['atualizando...', 'updating...'],
  semConexao: ['sem conexão', 'offline'],
  offline: ['offline', 'cached'],
  salvo: ['salvo', 'saved'],
  semanal: ['semanal', 'weekly'],
  praias: ['PRAIAS', 'BEACHES'],
  praiaUnica: ['PRAIA ÚNICA', 'ONLY BEACH'],
  praia: ['PRAIA', 'BEACH'],
  de: [' DE ', ' OF '],
  municipios: ['MUNICÍPIOS', 'TOWNS'],
  criterio: ['CRITÉRIO CETESB', 'CETESB CRITERIA'],
  PROPRIA: ['PRÓPRIA', 'SAFE'],
  IMPROPRIA: ['IMPRÓPRIA', 'UNSAFE'],
  crit1: ['Enterococos até 100 /100 mL', 'Enterococci up to 100 /100 mL'],
  crit2: ['em 80% das 5 últimas semanas', 'in 80% of the last 5 weeks'],
  crit3: ['fora disso, ou acima de', 'otherwise, or above'],
  crit4: ['400 na última amostra', '400 in the latest sample'],
  amostra: ['amostra de ', 'sample of '],
  fonte: ['Fonte: CETESB · ', 'Source: CETESB · '],
  boletimDe: ['Boletim de ', 'Report of '],
}

export const t = (k) => {
  const v = T[k]
  return v ? v[EN ? 1 : 0] : k
}

// Data curta: "13/11" em português, "Nov 13" em inglês (evita a ambiguidade dd/mm × mm/dd)
const MESES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const dataCurta = (s) => {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return '--'
  return EN ? MESES[Number(m[2]) - 1] + ' ' + Number(m[3]) : m[3] + '/' + m[2]
}
