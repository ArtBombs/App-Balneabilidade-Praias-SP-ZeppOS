// Grava os widgets visíveis de alguns estados do app (para tools/capt.py desenhar as capturas).
// node tools/capt.mjs saida.json   (LANG_ZEPP=2 para inglês)
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { montarPayload } from '../shared/praias.js'
import { respAtual, respHist } from '../test/fixture.mjs'

const payload = (mun) => montarPayload(mun, respAtual(), respHist(mun))
const widgets = []
const mk = (type, opts) => { const w = { type, opts: { ...opts, visible: true }, ev: {}, vivo: true, setProperty(k, v) { if (k === 'MORE') Object.assign(this.opts, v); else this.opts[k] = v }, addEventListener(e, f) { this.ev[e] = f } }; widgets.push(w); return w }
const store = {}
globalThis.__zos = {
  ui: { createWidget: mk, deleteWidget: (w) => { w.vivo = false; return true }, widget: { TEXT: 'TEXT', ARC: 'ARC', FILL_RECT: 'FILL_RECT', IMG: 'IMG' }, prop: { TEXT: 'text', COLOR: 'color', MORE: 'MORE', VISIBLE: 'visible' }, align: { CENTER_H: 'c', LEFT: 'l', RIGHT: 'r', CENTER_V: 'v' }, text_style: { NONE: 0 }, event: { CLICK_UP: 'up' } },
  page: { setScrollMode: (o) => { globalThis.__scroll = o }, setScrollLock: () => {}, getSwiperIndex: () => 1, SCROLL_MODE_SWIPER: 'swiper' },
  interaction: { onKey: () => {}, offKey: () => {}, onGesture: () => {}, offGesture: () => {}, KEY_SELECT: 13, KEY_UP: 38, KEY_DOWN: 40, KEY_HOME: 36, KEY_SHORTCUT: 1, KEY_BACK: 8, KEY_EVENT_CLICK: 1, KEY_EVENT_PRESS: 2, KEY_EVENT_RELEASE: 3, KEY_EVENT_LONG_PRESS: 4, GESTURE_RIGHT: 4 },
  storage: { localStorage: { getItem(k, d) { return store[k] ?? d }, setItem(k, v) { store[k] = v } } },
  utils: { px: (v) => v },
  settings: { getLanguage: () => Number(process.env.LANG_ZEPP || 20) },
  app: { getPackageInfo: () => ({ version: { name: '1.0.0' } }) },
  display: { setPageBrightTime: () => 0, resetPageBrightTime: () => 0 },
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'capt-'))
for (const [m, obj] of Object.entries(globalThis.__zos)) fs.writeFileSync(path.join(tmp, 'zos_' + m + '.mjs'), Object.keys(obj).map((n) => `export const ${n} = globalThis.__zos.${m}.${n}`).join('\n'))
fs.writeFileSync(path.join(tmp, 'zml.mjs'), 'export const BasePage = (o) => o')
fs.copyFileSync(new URL('../shared/praias.js', import.meta.url), path.join(tmp, 'praias.mjs'))
fs.writeFileSync(path.join(tmp, 'i18n.mjs'), fs.readFileSync(new URL('../page/i18n.js', import.meta.url), 'utf8').replace("from '@zos/settings'", "from './zos_settings.mjs'"))
let src = fs.readFileSync(new URL('../page/index/index.page.js', import.meta.url), 'utf8')
src = src.replace(/from '@zos\/(\w+)'/g, "from './zos_$1.mjs'").replace("from '@zeppos/zml/base-page'", "from './zml.mjs'").replace("from '../../shared/praias'", "from './praias.mjs'").replace("from '../i18n'", "from './i18n.mjs'")
fs.writeFileSync(path.join(tmp, 'page.mjs'), src)
const agora = Date.parse('2026-11-12T12:00:00-03:00') // data das capturas (datas não ficam amarelas)
Date.now = () => agora
let page; globalThis.Page = (o) => { page = o }
await import(path.join(tmp, 'page.mjs'))
page.request = async (q) => ({ ok: true, payload: payload(q.params.mun) })
page.error = () => {}
const tick = () => new Promise((r) => setTimeout(r, 5))
const dump = () => widgets.filter((w) => w.vivo && w.opts.visible !== false).map((w) => ({ type: w.type, ...Object.fromEntries(Object.entries(w.opts).filter(([k]) => k !== 'visible')) }))
const out = {}
page.onInit(); page.build(); await tick()
out.ubatuba = { w: dump(), telas: globalThis.__scroll.options.count }
page.state.ultimoClique = 0; page.abrirLista(); await tick()
page.moverCursor(4); page.moverCursor(2); await tick()
out.lista = { w: dump(), telas: 1 }
page.fecharLista()
for (const [k, id] of [['guaruja', '335'], ['ilha_comprida', '767']]) { page.selecionar(id); await tick(); out[k] = { w: dump(), telas: globalThis.__scroll.options.count } }
page.selecionar('701'); await tick()
fs.writeFileSync(process.argv[2], JSON.stringify(out))
console.log('ok', Object.keys(out).map((k) => k + ':' + out[k].telas).join(' '))
