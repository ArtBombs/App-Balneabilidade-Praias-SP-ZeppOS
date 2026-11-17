// node test/harness.mjs — testa shared/praias.js e a página com mocks de @zos/* (sem relógio, sem esbuild).
// LANG_ZEPP=2 node test/harness.mjs → interface em inglês.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { montarPayload, partirNome } from '../shared/praias.js'
import { respAtual, respHist } from './fixture.mjs'

const payload = (mun) => montarPayload(mun, respAtual(), respHist(mun))
for (const m of ['701', '283', '767']) {
  const p = payload(m)
  console.log(`payload ${p.nome}: ${JSON.stringify(p).length} B | ${p.pts.filter((x) => x.k === 'P').length}/${p.pts.length} | ${p.pts.slice(0, 2).map((x) => x.n + (x.l ? ' / ' + x.l : '') + ' ' + x.h.join('')).join(' ; ')}`)
}
console.log('nomes:', ['ENSEADA - AV. ATLÂNTICA', 'PEREQUÊ-AÇU', 'PRAIA DO SUL- ILHA ANCHIETA'].map((s) => JSON.stringify(partirNome(s))).join(' '))

// ── Mocks @zos/* ──────────────────────────────────────────────────
const widgets = []
const mk = (type, opts) => { const w = { type, opts: { ...opts, visible: true }, ev: {}, vivo: true, setProperty(k, v) { if (k === 'MORE') Object.assign(this.opts, v); else this.opts[k] = v }, addEventListener(e, f) { this.ev[e] = f } }; widgets.push(w); return w }
const store = {}
let keyCb = null
globalThis.__zos = {
  ui: { createWidget: mk, deleteWidget: (w) => { w.vivo = false; return true }, widget: { TEXT: 'TEXT', ARC: 'ARC', FILL_RECT: 'FILL_RECT', IMG: 'IMG' }, prop: { TEXT: 'text', COLOR: 'color', MORE: 'MORE', VISIBLE: 'visible' }, align: { CENTER_H: 'c', LEFT: 'l', RIGHT: 'r', CENTER_V: 'v' }, text_style: { NONE: 0 }, event: { CLICK_UP: 'up' } },
  page: { setScrollMode: (o) => { globalThis.__scroll = o; globalThis.__lock = false }, setScrollLock: (o) => { globalThis.__lock = o.lock }, getSwiperIndex: () => 1, SCROLL_MODE_SWIPER: 'swiper' },
  interaction: { onKey: (o) => { keyCb = o.callback }, offKey: () => {}, onGesture: () => {}, offGesture: () => {}, KEY_SELECT: 13, KEY_UP: 38, KEY_DOWN: 40, KEY_HOME: 36, KEY_SHORTCUT: 1, KEY_BACK: 8, KEY_EVENT_CLICK: 1, KEY_EVENT_PRESS: 2, KEY_EVENT_RELEASE: 3, KEY_EVENT_LONG_PRESS: 4, GESTURE_RIGHT: 4 },
  storage: { localStorage: { getItem(k, d) { if (typeof d !== 'string') throw new Error('default precisa ser string'); return store[k] ?? d }, setItem(k, v) { if (typeof v !== 'string') throw new Error('valor precisa ser string'); store[k] = v } } },
  utils: { px: (v) => v },
  settings: { getLanguage: () => Number(process.env.LANG_ZEPP || 20) }, // 20 = pt-BR · 2 = inglês
  app: { getPackageInfo: () => ({ version: { name: '1.0.0' } }) },
  display: { setPageBrightTime: () => 0, resetPageBrightTime: () => 0 },
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'praias-'))
for (const [m, obj] of Object.entries(globalThis.__zos)) fs.writeFileSync(path.join(tmp, 'zos_' + m + '.mjs'), Object.keys(obj).map((n) => `export const ${n} = globalThis.__zos.${m}.${n}`).join('\n'))
fs.writeFileSync(path.join(tmp, 'zml.mjs'), 'export const BasePage = (o) => o')
fs.copyFileSync(new URL('../shared/praias.js', import.meta.url), path.join(tmp, 'praias.mjs'))
fs.writeFileSync(path.join(tmp, 'i18n.mjs'), fs.readFileSync(new URL('../page/i18n.js', import.meta.url), 'utf8').replace("from '@zos/settings'", "from './zos_settings.mjs'"))
let src = fs.readFileSync(new URL('../page/index/index.page.js', import.meta.url), 'utf8')
src = src.replace(/from '@zos\/(\w+)'/g, "from './zos_$1.mjs'").replace("from '@zeppos/zml/base-page'", "from './zml.mjs'").replace("from '../../shared/praias'", "from './praias.mjs'").replace("from '../i18n'", "from './i18n.mjs'")
if (/from '@/.test(src)) throw new Error('import não mapeado')
fs.writeFileSync(path.join(tmp, 'page.mjs'), src)
let page; globalThis.Page = (o) => { page = o }
await import(path.join(tmp, 'page.mjs'))

let offline = false
const pedidos = []
page.request = async (q) => { pedidos.push(q.params.mun); return offline ? { ok: false, error: 'HTTP 503' } : { ok: true, payload: payload(q.params.mun) } }
page.error = () => {}
const tick = () => new Promise((r) => setTimeout(r, 5))
const espera = (ms) => new Promise((r) => setTimeout(r, ms))
const vis = (w) => w.vivo && w.opts.visible !== false
const tela = (n) => widgets.filter((w) => w.type === 'TEXT' && vis(w) && w.opts.y >= n * 480 && w.opts.y < (n + 1) * 480 && w.opts.text).map((w) => String(w.opts.text).replace('\n', ' ')).join(' | ')
const telas = (tt) => {
  const n = globalThis.__scroll.options.count
  console.log(`\n[${tt}] telas ${n} | pediu ${pedidos.join(',')} | anel ${widgets.filter((w) => w.type === 'ARC' && vis(w)).length} seg. (traço ${widgets.find((w) => w.type === 'ARC' && vis(w))?.opts.line_width})`)
  for (let k = 0; k < n; k++) console.log(` tela ${k + 1}:`, tela(k).slice(0, 230))
  const imgs = widgets.filter((w) => w.type === 'IMG' && vis(w)).map((w) => w.opts.src + '@' + w.opts.y)
  console.log(' imagens:', imgs.join(', '), '| about esperado em', 480 * (n - 1))
}
const coroa = (k) => keyCb(k, 1)
const lista = () => page.state.ui.lista ? page.state.ui.listaLinhas.map((l) => vis(l.nome) ? l.nome.opts.text + ' ' + l.val.opts.text : '').filter(Boolean).join(' · ') + ' | região ' + page.state.ui.listaRegiao.opts.text + ' | cursor ' + page.state.muns[page.state.cursor].n : 'fechada'

page.onInit(); page.build(); await tick()
console.log('\nonKey registrado no onInit:', typeof keyCb === 'function')
telas('abre (padrão Ubatuba)')

// Coroa: abre a lista, desce 6 (janela rola), confirma
await espera(850); coroa(13); await tick()
console.log('\n[lista]', lista())
for (let i = 0; i < 6; i++) { coroa(38); await espera(40) } // sentido invertido: 38 desce
console.log('[6 giros]', lista())
await espera(850); coroa(13); await tick()
console.log('salvo:', store.praias_municipio, '| lista fechada:', page.state.ui.lista === null, '| destravado:', globalThis.__lock === false)
telas('escolheu pela coroa')

// Toque: abre, rola com a seta ▼ até o fim e escolhe Ilha Comprida; depois Cubatão (1 praia)
await espera(850); page.state.ui.titulo.ev.up(); await tick()
for (let i = 0; i < 3; i++) page.rolarJanela(5)
console.log('\n[setas ▼ x3]', lista())
page.tocarLinha(4); await tick()
telas('toque → Ilha Comprida')
await espera(850); page.state.ui.titulo.ev.up(); await tick()
page.selecionar('283'); await tick()
telas('Cubatão (1 praia)')

// QR do apoio na posição nova do Sobre
const areaQR = widgets.find((w) => w.vivo && w.type === 'TEXT' && w.opts.text === '' && w.opts.y === page.state.y5 + 340)
areaQR.ev.up(); await tick()
console.log('\nQR abre na tela do Sobre:', !!page.state.qr, page.state.qr && page.state.qr[1].opts.y === page.state.y5)
page.state.qr[2].ev.up(); await tick()
console.log('QR fecha:', page.state.qr === null)

// Clique duplo da coroa (bug do Represas v1.1.0)
await espera(850)
keyCb(13, 1); await espera(120); keyCb(13, 3); await espera(500); keyCb(13, 1); await tick()
console.log('clique duplo: lista continua aberta:', !!page.state.ui.lista)
await espera(850); keyCb(8, 1); await tick()

offline = true
page.atualizar(); await tick()
console.log('offline:', tela(0).split(' | ').slice(-2).join(' | '))
console.log('giro fora da lista devolve:', keyCb(40, 1))
const restos = widgets.filter((w) => w.vivo && w.type === 'IMG' && w.opts.y > 480 * globalThis.__scroll.options.count)
console.log('widgets do Sobre fora do swiper:', restos.length, '| erros na tela:', widgets.filter((w) => vis(w) && String(w.opts.text).startsWith('ERRO')).length)
