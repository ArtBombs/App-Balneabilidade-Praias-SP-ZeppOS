import { BasePage } from '@zeppos/zml/base-page'
// Só importações nomeadas que já rodaram no Balance (Mananciais SP / Balneabilidade Represas SP).
// Nome importado que o firmware não exporta = página não carrega (tela preta).
// Funções mais novas vêm pelo namespace: se não existirem, ficam undefined e o código desvia.
import { createWidget, widget, prop, align, text_style, event } from '@zos/ui'
import * as zosUi from '@zos/ui'
import { setScrollMode, SCROLL_MODE_SWIPER } from '@zos/page'
import * as zosPage from '@zos/page'
import * as zosI from '@zos/interaction'
import * as zosApp from '@zos/app'
import { localStorage } from '@zos/storage'
import { setPageBrightTime, resetPageBrightTime } from '@zos/display'
import { px } from '@zos/utils'
import { MUN_PADRAO, MAX_PONTOS, HIST_VIS } from '../../shared/praias'
import { EN, t, dataCurta } from '../i18n'
const tr = t // dentro dos laços 'for (let t …)' o nome t é o índice

// ─── Design tokens (mesmos do Balneabilidade Represas SP) ─────────
const C = {
  bg: 0x000000,
  track: 0x1c2a2e,
  text: 0xe8f4f6,
  muted: 0x7a9aa3,
  propria: 0x4cd98a,
  impropria: 0xeb5757,
  nc: 0x55666b,
  atencao: 0xf2c94c,
  ciano: 0x12d0ff, // destaques da arte do about
  branco: 0xffffff,
}
const SCREEN = 480
const POR_TELA = 5
const TELAS_LISTA_MAX = Math.ceil(MAX_PONTOS / POR_TELA) // 7 (Ubatuba)
const VERSAO_RESERVA = '1.0.1' // se getPackageInfo não existir no firmware
const BRILHO_MS = 30000
const VELHO_DIAS = 10 // boletim semanal: passou disso = data em amarelo
const K_MUN = 'praias_municipio'
const K_CACHE = (m) => 'praias_payload_' + m
const K_MUNS = 'praias_municipios' // placar de todos os municípios (para a lista)
// Histórico na linha do nome: quadradinhos à direita (sobra largura para nomes longos)
const HQ_PASSO = 11
const HQ_X = 404 - HIST_VIS * HQ_PASSO // 360
const NOME_W = HQ_X - 6 - 92 // 262
const tamNome = (n) => (n.length <= 15 ? 26 : n.length <= 19 ? 24 : 22)

// Anel: 0° = 3h, horário (ARC do Zepp OS). 1º segmento no topo. Muitos pontos → traço mais fino,
// para o vão aparecer (no relógio a ponta arredondada fica DENTRO do ângulo do segmento).
const ANEL_TOPO = 270
const anelTraco = (n) => (n > 24 ? 14 : n > 14 ? 18 : 22)
const anelVao = (n) => (n > 24 ? 2 : n > 14 ? 3 : 4)

// Lista de municípios: janela de 5 linhas que acompanha o cursor (15 municípios)
const LISTA_LINHAS = 5
const LISTA_Y = 128
const LISTA_PASSO = 50

// Coroa no Balance (validado): clique = 13, giro = 38/40, evento 1. Clique chega em dobro
// (Represas v1.1.1): só CLICK conta e há trava de 800 ms após abrir/fechar a lista.
const COROA_SENTIDO = -1
const CLIQUE_DEDUP_MS = 800
const GIRO_DEDUP_MS = 35

const cor = (k) => (k === 'P' ? C.propria : k === 'I' ? C.impropria : C.nc)
const rotulo = (k) => (k === 'P' ? t('propria') : k === 'I' ? t('impropria') : t('naoClass'))
const ddmm = dataCurta // "08/11" em PT, "Nov 8" em EN
const maiusc = (s) => String(s || '').toUpperCase()
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const num = (v) => (typeof v === 'number' ? v : Number(v))
function diasDesde(iso) {
  if (!iso) return 999
  const ms = Date.parse(iso + 'T00:00:00-03:00')
  return isFinite(ms) ? Math.floor((Date.now() - ms) / 864e5) : 999
}
const contar = (pts) => ({ n: pts.length, p: pts.filter((x) => x.k === 'P').length, i: pts.filter((x) => x.k === 'I').length })
const telasLista = (n) => Math.max(1, Math.ceil(n / POR_TELA))
const placarCor = (p, n) => (!n ? C.muted : p === n ? C.propria : p === 0 ? C.impropria : C.text)

function versao() {
  try {
    const info = typeof zosApp.getPackageInfo === 'function' ? zosApp.getPackageInfo() : null
    if (info && info.version && info.version.name) return info.version.name
  } catch (e) {}
  return VERSAO_RESERVA
}

function lerJSON(k) {
  try {
    const s = localStorage.getItem(k, '')
    return s ? JSON.parse(s) : null
  } catch (e) {
    return null
  }
}
function gravarJSON(k, v) {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch (e) {}
}

function text(y0, o) {
  return createWidget(widget.TEXT, {
    x: px(o.x ?? 40),
    y: px(y0 + o.y),
    w: px(o.w ?? SCREEN - 80),
    h: px(o.h ?? 40),
    text: o.text ?? '',
    text_size: px(o.size ?? 24),
    color: o.color ?? C.text,
    align_h: o.align ?? align.CENTER_H,
    align_v: align.CENTER_V,
    text_style: text_style.NONE,
  })
}
function rect(x, y, w, h, color, radius = 0) {
  return createWidget(widget.FILL_RECT, { x: px(x), y: px(y), w: px(w), h: px(Math.max(1, h)), color, radius: px(radius) })
}
function setRect(wd, x, y, w, h, color, radius = 0) {
  wd.setProperty(prop.MORE, { x: px(x), y: px(y), w: px(w), h: px(Math.max(1, h)), color, radius: px(radius) })
}
const mostrar = (w, v) => {
  try {
    w.setProperty(prop.VISIBLE, v)
  } catch (e) {}
}
// Área de toque invisível (TEXT vazio é transparente e aceita eventos — validado no Mananciais SP)
function area(x, y, w, h, fn) {
  const a = createWidget(widget.TEXT, { x: px(x), y: px(y), w: px(w), h: px(h), text: '' })
  a.addEventListener(event.CLICK_UP, fn)
  return a
}
function chamar(fn, ...args) {
  try {
    if (typeof fn === 'function') return fn(...args)
  } catch (e) {}
  return undefined
}
function apagar(w) {
  try {
    if (typeof zosUi.deleteWidget === 'function') return zosUi.deleteWidget(w)
  } catch (e) {}
  mostrar(w, false)
  try {
    w.setProperty(prop.MORE, { x: px(-1000), y: px(-1000), w: px(1), h: px(1) })
  } catch (e) {}
}
function travarRolagem(lock) {
  try {
    if (typeof zosPage.setScrollLock === 'function') zosPage.setScrollLock({ lock })
  } catch (e) {}
}

// Página atual (0 = resumo), pelo on_page do swiper; reserva: getSwiperIndex (veio 1-based no Balance)
let paginaOnPage = null
function naPrimeiraTela() {
  if (typeof paginaOnPage === 'number') return paginaOnPage === 0
  const i = chamar(zosPage.getSwiperIndex)
  return typeof i !== 'number' || i <= 1
}

Page(
  BasePage({
    state: { ui: {}, mun: MUN_PADRAO, cache: null, muns: null, listaAberta: false, nTelasLista: 1, finais: [] },

    onInit() {
      try {
        setPageBrightTime({ brightTime: BRILHO_MS })
      } catch (e) {}
      try {
        const salvo = localStorage.getItem(K_MUN, '')
        this.state.mun = /^\d{1,5}$/.test(salvo) ? salvo : MUN_PADRAO
      } catch (e) {
        this.state.mun = MUN_PADRAO
      }
      this.state.cache = lerJSON(K_CACHE(this.state.mun))
      this.state.muns = lerJSON(K_MUNS)
      if (this.state.cache) this.state.nTelasLista = telasLista((this.state.cache.pts || []).length)
      // Teclas registradas no onInit (no build, nenhum evento chegava)
      this.ligarBotoes()
    },

    mostrarErro(onde, e) {
      try {
        this.error(onde, e)
      } catch (x) {}
      try {
        createWidget(widget.TEXT, {
          x: px(50), y: px(170), w: px(380), h: px(160),
          text: 'ERRO em ' + onde + ':\n' + String((e && e.message) || e).slice(0, 120),
          text_size: px(22), color: C.impropria,
          align_h: align.CENTER_H, align_v: align.CENTER_V,
          text_style: text_style.WRAP === undefined ? text_style.NONE : text_style.WRAP,
        })
      } catch (x) {}
    },

    build() {
      try {
        this.montarTelas()
      } catch (e) {
        this.mostrarErro('build', e)
        return
      }
      try {
        if (this.state.cache) this.render(this.state.cache, t('salvo'))
      } catch (e) {
        this.mostrarErro('render (cache)', e)
      }
      this.atualizar()
    },

    onDestroy() {
      try {
        resetPageBrightTime()
      } catch (e) {}
      chamar(zosI.offKey)
      chamar(zosI.offGesture)
    },

    // ─── Coroa / botões ───────────────────────────────────────────
    ligarBotoes() {
      chamar(zosI.onKey, {
        callback: (a, b) => {
          const key = a && typeof a === 'object' ? num(a.key) : num(a)
          const ev = a && typeof a === 'object' ? num(a.event ?? a.keyEvent ?? a.type) : num(b)
          return this.tecla(key, ev)
        },
      })
    },

    tecla(key, ev) {
      if (this.state.qr && (key === 13 || key === zosI.KEY_SELECT || key === zosI.KEY_HOME || key === zosI.KEY_SHORTCUT || key === zosI.KEY_BACK)) {
        if ((ev === zosI.KEY_EVENT_CLICK || ev === 1) && Date.now() - (this.state.ultimoClique || 0) >= CLIQUE_DEDUP_MS) this.fecharQR()
        return true
      }
      const naLista = this.state.listaAberta
      const ehSelect = key === zosI.KEY_SELECT || key === 13 || key === zosI.KEY_HOME
      const ehCima = key === zosI.KEY_UP || key === 38
      const ehBaixo = key === zosI.KEY_DOWN || key === 40
      const ehClique = ev === zosI.KEY_EVENT_CLICK || ev === 1
      const cliqueNovo = () => {
        const agora = Date.now()
        if (agora - (this.state.ultimoClique || 0) < CLIQUE_DEDUP_MS) return false
        this.state.ultimoClique = agora
        return true
      }

      // Giro: com a lista aberta move o cursor; fora dela, o sistema troca de tela.
      if (ehCima || ehBaixo) {
        if (!naLista) return false
        if (ev === zosI.KEY_EVENT_CLICK || ev === 1) {
          const agora = Date.now()
          if (agora - (this.state.ultimoGiro || 0) >= GIRO_DEDUP_MS) {
            this.state.ultimoGiro = agora
            this.moverCursor((ehBaixo ? 1 : -1) * COROA_SENTIDO)
          }
        }
        return true
      }

      if (ehSelect) {
        if (!naLista && !naPrimeiraTela()) return false
        if (ev === zosI.KEY_EVENT_PRESS) {
          this.state.pressaoLonga = false
          return true
        }
        if (ev === zosI.KEY_EVENT_LONG_PRESS) {
          this.state.pressaoLonga = true
          return false // segurar continua sendo do sistema
        }
        if (ehClique) {
          if (this.state.pressaoLonga) return false
          if (cliqueNovo()) {
            if (naLista) this.confirmarCursor()
            else this.abrirLista()
          }
          return true
        }
        return true // RELEASE e outros sinais do mesmo clique: consumidos sem ação
      }

      if (naLista && (key === zosI.KEY_SHORTCUT || key === zosI.KEY_BACK)) {
        if (ehClique && cliqueNovo()) this.fecharLista()
        return true
      }
      return false
    },

    // Nº de telas = resumo + listas (1 a 7, conforme o município) + critério + sobre
    swiper(coroaDoSistema = true) {
      setScrollMode({
        mode: SCROLL_MODE_SWIPER,
        options: {
          height: px(SCREEN),
          count: 3 + this.state.nTelasLista,
          modeParams: {
            crown_enable: coroaDoSistema,
            on_page: (i) => {
              paginaOnPage = num(i)
            },
          },
        },
      })
    },

    montarTelas() {
      this.swiper()
      const ui = this.state.ui

      // ── Tela 1 · Resumo do município ────────────────────────────
      ui.anel = []
      for (let i = 0; i < MAX_PONTOS; i++) {
        ui.anel.push(
          createWidget(widget.ARC, {
            x: px(40), y: px(40), w: px(400), h: px(400),
            start_angle: ANEL_TOPO, end_angle: ANEL_TOPO + 1,
            color: C.track, line_width: px(22),
          }),
        )
      }
      // Nome do município: toque (ou clique da coroa) abre a lista dos municípios
      ui.titulo = text(0, { x: 90, w: 300, y: 104, h: 36, text: '', size: 24, color: C.muted })
      ui.tituloTraco = rect(222, 140, 36, 3, C.muted, 2)
      ui.titulo.addEventListener(event.CLICK_UP, () => this.abrirLista())
      ui.placar = text(0, { y: 148, h: 110, text: '--', size: 96 })
      ui.placarLbl = text(0, { y: 256, h: 36, text: t('paraBanhoN'), size: 26, color: C.muted })
      ui.impr = text(0, { y: 300, h: 36, text: '', size: 26, color: C.impropria })
      ui.status = text(0, { y: 338, h: 30, text: t('atualizando'), size: 20, color: C.muted })
      ui.regiao = text(0, { x: 120, w: 240, y: 368, h: 26, text: '', size: 18, color: C.nc })

      // ── Telas 2…8 · Praias (só as do município aparecem no swiper) ──
      ui.linhas = []
      for (let t = 0; t < TELAS_LISTA_MAX; t++) {
        const y0 = SCREEN * (1 + t)
        ui['cab' + t] = text(y0, { y: 44, h: 34, text: tr('praias'), size: 22, color: C.muted })
        for (let i = 0; i < POR_TELA; i++) {
          const y = 92 + i * 66
          const ln = {
            y0,
            y,
            dot: rect(68, y0 + y + 12, 14, 14, C.track, 7),
            nome: text(y0, { x: 92, w: NOME_W, y, h: 36, text: '', size: 26, align: align.LEFT }),
            sub: text(y0, { x: 92, w: 300, y: y + 32, h: 26, text: '', size: 18, color: C.muted, align: align.LEFT }),
            hist: [],
          }
          for (let h = 0; h < HIST_VIS; h++) ln.hist.push(rect(HQ_X + h * HQ_PASSO, y0 + y + 14, 8, 8, C.bg, 2))
          ui.linhas.push(ln)
        }
      }
      this.montarFinais()
    },

    // Critério + Sobre ficam logo depois da última tela de praias: recriados quando muda o nº de telas
    montarFinais() {
      ;(this.state.finais || []).forEach(apagar)
      const F = (this.state.finais = [])
      const add = (w) => (F.push(w), w)
      const ui = this.state.ui
      const k = this.state.nTelasLista

      // ── Critério CETESB (água do mar: enterococos, CONAMA 274) ──
      const y4 = SCREEN * (1 + k)
      add(text(y4, { y: 52, h: 34, text: t('criterio'), size: 22, color: C.muted }))
      add(text(y4, { y: 96, h: 34, text: t('PROPRIA'), size: 26, color: C.propria }))
      add(text(y4, { y: 130, h: 30, text: t('crit1'), size: 22 }))
      add(text(y4, { y: 158, h: 30, text: t('crit2'), size: 22, color: C.muted }))
      add(text(y4, { y: 200, h: 34, text: t('IMPROPRIA'), size: 26, color: C.impropria }))
      add(text(y4, { y: 234, h: 30, text: t('crit3'), size: 22 }))
      add(text(y4, { y: 262, h: 30, text: t('crit4'), size: 22, color: C.muted }))
      ui.periodo = add(text(y4, { y: 314, h: 30, text: '', size: 20, color: C.muted }))
      add(text(y4, { y: 350, h: 28, text: t('fonte') + t('semanal'), size: 20, color: C.muted }))
      add(text(y4, { y: 400, h: 28, text: 'ArtBombs', size: 18, color: C.nc }))

      // ── Sobre (arte da ArtBombs; versão e data escritas pelo app) ──
      const y5 = SCREEN * (2 + k)
      this.state.y5 = y5
      add(createWidget(widget.IMG, { x: 0, y: px(y5), w: px(SCREEN), h: px(SCREEN), src: EN ? 'about_en.png' : 'about.png' }))
      add(text(y5, { x: 140, w: 200, y: 26, h: 32, text: 'v' + versao(), size: 20, color: C.ciano }))
      ui.boletim = add(text(y5, { y: 281, h: 38, text: '', size: 20, color: C.branco }))
      // "Apoie o projeto" + LivePix + mini QR → QR em tela cheia
      add(area(132, y5 + 340, 216, 80, () => this.abrirQR()))
    },

    // ─── QR do apoio (camada sobre o Sobre; toque em qualquer lugar fecha) ───
    abrirQR() {
      if (this.state.qr) return
      const y5 = this.state.y5
      const L = []
      L.push(rect(0, y5, SCREEN, SCREEN, C.bg, 0))
      L.push(createWidget(widget.IMG, { x: 0, y: px(y5), w: px(SCREEN), h: px(SCREEN), src: 'qr.png' }))
      L.push(area(0, y5, SCREEN, SCREEN, () => this.fecharQR()))
      this.state.qr = L
      this.state.ultimoClique = Date.now()
    },

    fecharQR() {
      ;(this.state.qr || []).forEach(apagar)
      this.state.qr = null
    },

    // ─── Lista de municípios (camada criada ao abrir, apagada ao fechar) ───
    // 15 municípios de norte a sul; janela de 5 linhas acompanha o cursor; região no título.
    abrirLista() {
      if (this.state.listaAberta) return
      const muns = this.state.muns || []
      if (!muns.length) return // ainda sem dados: nada para listar
      this.state.listaAberta = true
      this.state.ultimoClique = Date.now()
      chamar(() => this.swiper(false))
      travarRolagem(true)
      try {
        const L = (this.state.ui.lista = [])
        const add = (w) => (L.push(w), w)
        this.state.cursor = Math.max(0, muns.findIndex((m) => m.id === this.state.mun))
        this.state.janela = clamp(this.state.cursor - 2, 0, Math.max(0, muns.length - LISTA_LINHAS))

        const fundo = add(rect(0, 0, SCREEN, SCREEN, C.bg, 0))
        fundo.addEventListener(event.CLICK_UP, () => {}) // bloqueia toques nas telas por baixo
        const tit = add(text(0, { x: 120, w: 240, y: 46, h: 30, text: t('municipios'), size: 20, color: C.muted }))
        tit.addEventListener(event.CLICK_UP, () => this.fecharLista())
        this.state.ui.listaRegiao = add(text(0, { x: 120, w: 240, y: 74, h: 30, text: '', size: 22, color: C.ciano }))
        // setas: toque rola a janela (para quem não usa a coroa)
        this.state.ui.setaCima = add(text(0, { x: 200, w: 80, y: 100, h: 26, text: '▲', size: 18, color: C.muted }))
        this.state.ui.setaBaixo = add(text(0, { x: 200, w: 80, y: LISTA_Y + LISTA_LINHAS * LISTA_PASSO + 2, h: 26, text: '▼', size: 18, color: C.muted }))
        add(area(160, 96, 160, 34, () => this.rolarJanela(-LISTA_LINHAS)))
        add(area(160, LISTA_Y + LISTA_LINHAS * LISTA_PASSO, 160, 40, () => this.rolarJanela(LISTA_LINHAS)))

        // áreas de toque → cursor → marcador e textos (cursor visível entre áreas e textos)
        const linhas = (this.state.ui.listaLinhas = [])
        for (let i = 0; i < LISTA_LINHAS; i++) {
          add(rect(72, LISTA_Y + i * LISTA_PASSO + 2, 336, 46, C.bg, 23)).addEventListener(event.CLICK_UP, () => this.tocarLinha(i))
        }
        this.state.ui.cursor = add(rect(72, LISTA_Y + 2, 336, 46, C.track, 23))
        this.state.ui.cursor.addEventListener(event.CLICK_UP, () => this.confirmarCursor())
        for (let i = 0; i < LISTA_LINHAS; i++) {
          const y = LISTA_Y + i * LISTA_PASSO
          const ln = {
            marca: add(rect(82, y + 22, 6, 6, C.propria, 3)),
            nome: add(text(0, { x: 96, w: 210, y, h: 50, text: '', size: 24, color: C.muted, align: align.LEFT })),
            val: add(text(0, { x: 300, w: 92, y, h: 50, text: '', size: 24, align: align.RIGHT })),
          }
          ;[ln.nome, ln.val].forEach((w) => w.addEventListener(event.CLICK_UP, () => this.tocarLinha(i)))
          linhas.push(ln)
        }
        this.pintarLista()

        chamar(zosI.onGesture, {
          callback: (ev) => {
            if (ev === zosI.GESTURE_RIGHT && this.state.listaAberta) {
              this.fecharLista()
              return true
            }
            return false
          },
        })
      } catch (e) {
        this.fecharLista()
        this.mostrarErro('lista', e)
      }
    },

    pintarLista() {
      const ui = this.state.ui
      const muns = this.state.muns || []
      const j = this.state.janela
      ;(ui.listaLinhas || []).forEach((ln, i) => {
        const m = muns[j + i]
        mostrar(ln.nome, !!m)
        mostrar(ln.val, !!m)
        mostrar(ln.marca, !!m && m.id === this.state.mun)
        if (!m) return
        ln.nome.setProperty(prop.TEXT, m.n)
        ln.nome.setProperty(prop.COLOR, j + i === this.state.cursor ? C.text : C.muted)
        ln.val.setProperty(prop.TEXT, m.p + '/' + m.t)
        ln.val.setProperty(prop.COLOR, placarCor(m.p, m.t))
      })
      const vis = this.state.cursor - j
      if (ui.cursor) {
        mostrar(ui.cursor, vis >= 0 && vis < LISTA_LINHAS)
        setRect(ui.cursor, 72, LISTA_Y + clamp(vis, 0, LISTA_LINHAS - 1) * LISTA_PASSO + 2, 336, 46, C.track, 23)
      }
      const atual = muns[this.state.cursor]
      if (ui.listaRegiao) ui.listaRegiao.setProperty(prop.TEXT, atual ? maiusc(atual.r) : '')
      if (ui.setaCima) ui.setaCima.setProperty(prop.COLOR, j > 0 ? C.text : C.track)
      if (ui.setaBaixo) ui.setaBaixo.setProperty(prop.COLOR, j + LISTA_LINHAS < muns.length ? C.text : C.track)
    },

    moverCursor(dir) {
      const muns = this.state.muns || []
      const novo = clamp(this.state.cursor + dir, 0, muns.length - 1)
      if (novo === this.state.cursor) return
      this.state.cursor = novo
      if (novo < this.state.janela) this.state.janela = novo
      if (novo >= this.state.janela + LISTA_LINHAS) this.state.janela = novo - LISTA_LINHAS + 1
      this.pintarLista()
    },

    rolarJanela(d) {
      const muns = this.state.muns || []
      this.state.janela = clamp(this.state.janela + d, 0, Math.max(0, muns.length - LISTA_LINHAS))
      this.state.cursor = clamp(this.state.cursor, this.state.janela, this.state.janela + LISTA_LINHAS - 1)
      this.pintarLista()
    },

    tocarLinha(i) {
      const m = (this.state.muns || [])[this.state.janela + i]
      if (m) this.selecionar(m.id)
    },

    confirmarCursor() {
      const m = (this.state.muns || [])[this.state.cursor]
      if (m) this.selecionar(m.id)
      else this.fecharLista()
    },

    fecharLista() {
      if (!this.state.listaAberta) return
      this.state.listaAberta = false
      this.state.ultimoClique = Date.now()
      chamar(zosI.offGesture)
      const L = this.state.ui.lista || []
      this.state.ui.lista = null
      this.state.ui.listaLinhas = null
      this.state.ui.cursor = null
      L.forEach(apagar)
      travarRolagem(false)
      this.swiper() // destravar volta para rolagem livre → reaplica o swiper
    },

    selecionar(id) {
      this.fecharLista()
      if (id === this.state.mun) return
      this.state.mun = id
      try {
        localStorage.setItem(K_MUN, String(id))
      } catch (e) {}
      try {
        const m = (this.state.muns || []).find((x) => x.id === id)
        this.state.ui.titulo.setProperty(prop.TEXT, maiusc(m ? m.n : ''))
        this.state.cache = lerJSON(K_CACHE(id))
        if (this.state.cache) this.render(this.state.cache, t('salvo'))
        else this.limpar(m)
      } catch (e) {
        this.mostrarErro('trocar município', e)
      }
      this.atualizar()
    },

    limpar(m) {
      this.render({ mun: this.state.mun, nome: m ? m.n : '', reg: m ? m.r : '', pts: [] }, '')
      this.state.ui.status.setProperty(prop.TEXT, t('atualizando'))
      this.state.ui.status.setProperty(prop.COLOR, C.muted)
    },

    // ─── Dados ────────────────────────────────────────────────────
    atualizar() {
      const pedido = this.state.mun
      this.request({ method: 'praias.get', params: { mun: pedido } })
        .then((r) => {
          if (!r || !r.ok) throw new Error((r && r.error) || 'sem dados')
          const p = r.payload
          const id = p.mun || pedido
          gravarJSON(K_CACHE(id), p)
          if (p.muns && p.muns.length) {
            this.state.muns = p.muns
            gravarJSON(K_MUNS, p.muns)
          }
          if (id !== this.state.mun) return // trocou de município no meio da busca
          this.state.cache = p
          try {
            this.render(p, r.stale ? t('offline') : '')
          } catch (e) {
            this.mostrarErro('render', e)
          }
        })
        .catch((e) => {
          try {
            this.error('request:', e)
          } catch (x) {}
          if (pedido !== this.state.mun) return
          const c = this.state.cache
          const msg = String((e && e.message) || e || '')
          const ui = this.state.ui
          if (ui.status) ui.status.setProperty(prop.TEXT, c ? t('offline') + ' · CETESB ' + ddmm(c.d) : t('semConexao') + (msg ? ' · ' + msg.slice(0, 22) : ''))
        })
    },

    render(d, origem) {
      const ui = this.state.ui
      if (!d || !ui.placar) return
      const pts = (d.pts || []).slice(0, MAX_PONTOS)
      const { n, p: prop_, i: impr } = contar(pts)

      // Nº de telas de praias deste município → swiper e posição do Critério/Sobre
      const k = telasLista(n)
      if (k !== this.state.nTelasLista) {
        this.state.nTelasLista = k
        if (this.state.qr) this.fecharQR()
        this.montarFinais()
        if (!this.state.listaAberta) this.swiper()
      }

      // Tela 1 — anel com um segmento por praia (mesma ordem da lista)
      const passo = n ? 360 / n : 360
      const lw = anelTraco(n)
      const vao = n > 1 ? anelVao(n) : 0
      ui.anel.forEach((w, i) => {
        if (i >= n) return mostrar(w, false)
        mostrar(w, true)
        const ini = (ANEL_TOPO + i * passo + vao / 2) % 360
        w.setProperty(prop.MORE, {
          x: px(40), y: px(40), w: px(400), h: px(400),
          start_angle: ini, end_angle: ini + Math.max(1, passo - vao),
          color: cor(pts[i].k), line_width: px(lw),
        })
      })
      ui.titulo.setProperty(prop.TEXT, maiusc(d.nome))
      ui.placar.setProperty(prop.TEXT, n ? prop_ + '/' + n : '--')
      ui.placar.setProperty(prop.COLOR, !n ? C.text : placarCor(prop_, n))
      ui.placarLbl.setProperty(prop.TEXT, n === 1 ? (prop_ ? t('paraBanho1') : t('paraBanho0')) : prop_ === 1 ? t('paraBanho1') : t('paraBanhoN'))
      ui.impr.setProperty(prop.TEXT, impr ? impr + (impr === 1 ? t('impr1') : t('imprN')) : n ? t('nenhumaImpr') : '')
      ui.impr.setProperty(prop.COLOR, impr ? C.impropria : C.propria)
      const velho = diasDesde(d.d) > VELHO_DIAS
      ui.status.setProperty(prop.TEXT, 'CETESB · ' + ddmm(d.d) + (origem ? ' · ' + origem : ''))
      ui.status.setProperty(prop.COLOR, velho ? C.atencao : C.muted)
      ui.regiao.setProperty(prop.TEXT, d.reg || '')

      // Telas de praias
      for (let t = 0; t < TELAS_LISTA_MAX; t++) {
        const a = t * POR_TELA + 1
        const b = Math.min(n, (t + 1) * POR_TELA)
        ui['cab' + t].setProperty(prop.TEXT, b < a ? '' : n === 1 ? tr('praiaUnica') : a === b ? tr('praia') + ' ' + a + tr('de') + n : tr('praias') + ' ' + a + '–' + b + tr('de') + n)
      }
      ui.linhas.forEach((ln, i) => {
        const p = pts[i]
        const vis = !!p
        mostrar(ln.dot, vis)
        mostrar(ln.nome, vis)
        mostrar(ln.sub, vis)
        if (!vis) return ln.hist.forEach((q) => mostrar(q, false))
        setRect(ln.dot, 68, ln.y0 + ln.y + 12, 14, 14, cor(p.k), 7)
        ln.nome.setProperty(prop.TEXT, p.n)
        ln.nome.setProperty(prop.MORE, { text_size: px(tamNome(String(p.n || ''))) })
        ln.sub.setProperty(prop.TEXT, rotulo(p.k) + (p.l ? ' · ' + p.l : ''))
        ln.sub.setProperty(prop.COLOR, cor(p.k))
        // semanas anteriores (a atual já é o ponto grande)
        const h = (p.h || []).slice(-HIST_VIS)
        const off = HIST_VIS - h.length
        ln.hist.forEach((q, j) => {
          const kk = j >= off ? h[j - off] : null
          mostrar(q, kk !== null)
          if (kk !== null) setRect(q, HQ_X + j * HQ_PASSO, ln.y0 + ln.y + 14, 8, 8, cor(kk), 2)
        })
      })

      // Critério e Sobre
      ui.periodo.setProperty(prop.TEXT, d.d ? t('amostra') + ddmm(d.d) : '')
      ui.boletim.setProperty(prop.TEXT, d.d ? t('boletimDe') + ddmm(d.d) + ' · ' + t('semanal') : '')
    },
  }),
)
