/**
 * Timeline：幕间调度。
 *
 * 每个「幕」实现统一接口：
 *   { name, enter(), update(dt, elapsed), draw(ctx, alpha, layer), exit(),
 *     readyAt?, isClickable?(elapsed), onClick?(elapsed) }
 *
 * 换幕由点击驱动，不会自动推进：
 *   - readyAt：这一幕的核心内容播完的时刻（秒），到此才接受点击
 *   - isClickable / onClick：需要内部控制节奏的幕可以自己实现（开场幕有两段文字）
 *   - onClick 返回 'consume' 表示这次点击被本幕自己用掉，不换幕；返回 'pass' 才换幕
 *
 * 切换时旧幕以 (1 - alpha) 淡出、新幕以 alpha 淡入，过渡期间两幕都会继续 update，
 * 过渡结束后才调用旧幕的 exit() 回收资源。
 */
export class Timeline {
  constructor(stage, options = {}) {
    this.stage = stage
    this.crossfade = options.crossfade ?? 0.9
    this.onSceneChange = options.onSceneChange ?? null
    this.scenes = []
    this.index = -1
    this.prev = -1
    this.elapsed = 0
    this.prevElapsed = 0
    this.fade = this.crossfade
    this.clickable = false
    this._pendingExit = -1
  }

  setScenes(list) {
    this.scenes = list
  }

  get scene() {
    return this.index >= 0 ? this.scenes[this.index] : null
  }

  get isLast() {
    return this.index >= this.scenes.length - 1
  }

  start() {
    this.goTo(0)
  }

  next() {
    this.goTo(this.index + 1)
  }

  goTo(index) {
    if (index === this.index || index < 0 || index >= this.scenes.length) return

    if (this._pendingExit >= 0) {
      this.scenes[this._pendingExit].exit?.()
      this._pendingExit = -1
    }

    this.prev = this.index >= 0 ? this.index : -1
    this._pendingExit = this.prev
    this.index = index
    this.elapsed = 0
    this.prevElapsed = 0
    this.fade = 0
    this.clickable = false

    const scene = this.scenes[index]
    scene.enter?.()
    this.onSceneChange?.(scene, index)
  }

  /** 当前这一幕是否已播完核心内容、可以接受点击 */
  _computeClickable() {
    // 最后一幕不再切换，也就永远不需要点击提示
    if (this.isLast || this.index < 0) return false

    const scene = this.scene
    if (scene.isClickable) return scene.isClickable(this.elapsed)
    return this.elapsed >= (scene.readyAt ?? 0)
  }

  /** 点击屏幕：返回 true 表示这次点击真的推动了流程 */
  advance() {
    if (!this._computeClickable()) return false

    const scene = this.scene
    const verdict = scene.onClick ? scene.onClick(this.elapsed) : 'pass'
    this.clickable = this._computeClickable()

    if (verdict === 'consume') return true
    this.next()
    return true
  }

  update(dt) {
    const scene = this.scene
    if (!scene) return

    this.elapsed += dt
    if (this.prev >= 0) {
      this.prevElapsed += dt
      this.scenes[this.prev].update?.(dt, this.prevElapsed)
    }
    scene.update?.(dt, this.elapsed)

    if (this.fade < this.crossfade) {
      this.fade = Math.min(this.crossfade, this.fade + dt)
      if (this.fade >= this.crossfade && this._pendingExit >= 0) {
        this.scenes[this._pendingExit].exit?.()
        this._pendingExit = -1
        this.prev = -1
      }
    }

    this.clickable = this._computeClickable()
  }

  draw(layer) {
    const scene = this.scene
    if (!scene) return

    const ctx = this.stage.ctx[layer]
    const alpha = this.crossfade > 0 ? Math.min(1, this.fade / this.crossfade) : 1

    if (this.prev >= 0) {
      this.scenes[this.prev].draw?.(ctx, 1 - alpha, layer)
    }
    scene.draw?.(ctx, alpha, layer)
  }
}
