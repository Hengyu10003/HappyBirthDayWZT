import { config } from '../config.js'

/**
 * Stage：统一管理多个全屏画布的尺寸、DPR 与主循环。
 * dt 统一以「秒」为单位，并在标签页切回时做上限截断，避免粒子瞬移。
 */
export class Stage {
  constructor(canvases) {
    this.canvases = canvases
    this.ctx = {}
    for (const key of Object.keys(canvases)) {
      this.ctx[key] = canvases[key].getContext('2d', { alpha: true })
    }
    this.layers = Object.keys(canvases)
    this.width = 0
    this.height = 0
    this.dpr = 1
    this.fps = 60
    this._resizeHandlers = []
    this._running = false
    this._raf = 0
    this._last = 0
    this._onResize = () => this.resize()
  }

  init() {
    window.addEventListener('resize', this._onResize)
    window.addEventListener('orientationchange', this._onResize)
    this.resize()
  }

  onResize(fn) {
    this._resizeHandlers.push(fn)
  }

  resize() {
    const w = window.innerWidth
    const h = window.innerHeight
    const dpr = Math.min(window.devicePixelRatio || 1, config.performance.maxDPR)
    this.width = w
    this.height = h
    this.dpr = dpr

    for (const key of this.layers) {
      const canvas = this.canvases[key]
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
    }

    for (const fn of this._resizeHandlers) fn(w, h)
  }

  /** 每帧开始前重置画布状态，避免上一帧的 globalAlpha / 混合模式残留 */
  beginFrame(layer) {
    const ctx = this.ctx[layer]
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, this.width, this.height)
    return ctx
  }

  start(onFrame) {
    if (this._running) return
    this._running = true
    this._last = 0

    const tick = (ts) => {
      if (!this._running) return
      if (!this._last) this._last = ts
      const raw = ts - this._last
      this._last = ts
      const dt = Math.min(raw, 33) / 1000
      if (raw > 0) this.fps += (1000 / raw - this.fps) * 0.08
      onFrame(dt, ts / 1000)
      this._raf = requestAnimationFrame(tick)
    }

    this._raf = requestAnimationFrame(tick)
  }

  stop() {
    this._running = false
    if (this._raf) cancelAnimationFrame(this._raf)
    this._raf = 0
  }
}
