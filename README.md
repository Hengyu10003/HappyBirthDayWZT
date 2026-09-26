# HappyBirthDayWZT

一个用 Canvas 2D 手写的交互式生日网页：星尘汇聚成字 → 粒子蛋糕许愿 → 攥气球放烟花。
全程点击推进，鼠标与触屏都能用。

**在线预览**：https://Hengyu10003.github.io/HappyBirthDayWZT/

## 三幕剧情

| 幕 | 画面 | 交互 |
| --- | --- | --- |
| 一 · 星尘组字 | 星尘与时光碎片在三维空间漂浮，随后缓入缓出地汇聚成「生日快乐 WZT」；散开后重新汇聚成「欢迎来到 20 岁」 | 每段文字落位后点一下进入下一段 |
| 二 · 粒子蛋糕 | 星光从四周汇聚成一个缓慢自转的三层粒子蛋糕，顶部一根金色蜡烛点亮 | 「闭上眼，许个愿」浮现，2 秒后蜡烛自动熄灭、炸开全屏烟花，同时亮出「轻触继续」 |
| 三 · 气球与烟花 | 气球不断升起，画面中央提示「请为自己放个烟花吧」 | 按住画面 → 气球像蚁球一样朝按住处聚拢收紧；松手 → 落点附近气球一起炸开并补一簇全屏烟花。随后祝福文字分两屏浮现：先是一段六句的短诗逐段累积在同一屏上，整屏收走后，末句「山山巍然，祝你长青不晦」单独淡入并一直留下 |

## 技术要点

- **Vite + 原生 ES Module**，没有框架。整个页面是一个 Canvas 场景循环，用不上虚拟 DOM。
- **零运行时依赖**：粒子、蛋糕参数方程、文字点阵采样全部手写，`npm ls --prod` 是空的。
- **双层 Canvas**（`back` / `front`）配合 `Stage` 做幕间交叉淡化。
- **对象池 `ParticleSystem`**：所有粒子预分配，主循环内零分配、不触发 GC。
- **参数方程旋转体**定义蛋糕轮廓，自己写透视投影，没有引入 3D 库。
- 文字点阵由离屏 Canvas `getImageData` 采样得到，中英文都能用。
- 响应式：`clamp()` + DPR 自适应，并带低帧率自动降级（见 `config.performance`）。

## 本地开发

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 产物在 dist/
npm run preview  # 预览构建产物
npm test         # vitest，37 个用例
```

## 自定义

改文案、节奏、颜色、粒子密度都只需要动 [`src/config.js`](src/config.js)，不用碰渲染逻辑。

```js
texts: {
  greeting: '生日快乐 WZT',   // 第一段字
  welcome: '欢迎来到 20 岁',  // 第二段字
},
```

常用参数：

| 参数 | 作用 |
| --- | --- |
| `scenes.starWords.travelTime` | 单颗粒子飞向自己位置的时长，调大更舒缓 |
| `scenes.cake.rotateSpeed` | 蛋糕自转速度（弧度/秒） |
| `scenes.cake.wishDuration` | 许愿时长，到点自动吹灭 |
| `scenes.crown.fireworkSpeed` | 松手烟花的初速范围，决定能铺多满 |
| `colors.*` | 各处配色 |

祝福文字分两屏浮现，六句短诗的出场节奏在 [`src/styles/main.css`](src/styles/main.css) 的 `.wish-lines__poem` 一段：改那六个 `transition-delay`（每句间隔 2 秒）即可。短诗铺完之后的停留时长由 [`config.js`](src/config.js) 的 `scenes.crown.poemHold` 决定，到点亮出「轻触继续」，点一下才切到末句那张。

## 目录结构

```
src/
  main.js              入口：装配 Stage / ParticleSystem / 三幕
  config.js            全部可调参数
  core/
    stage.js           双层 Canvas 与尺寸 / DPR 管理
    timeline.js        幕间调度与交叉淡化
    math.js           缓动、角度工具
  fx/
    particles.js       粒子对象池
    sprites.js         粒子贴图（离屏生成，无图片资源）
    starField.js       常驻的碎片星野背景
    cakeShape.js       蛋糕点阵（参数方程旋转体）
    textPoints.js      文字点阵采样
  scenes/
    starWords.js       第一幕
    cake.js            第二幕
    crown.js           第三幕（文件名沿用，已不含皇冠）
  styles/main.css
tests/                 vitest 用例
```

## 部署

仓库自带 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)：推到 `main` 后 GitHub Actions 自动 `npm ci` → `npm test` → `npm run build`，并把 `dist/` 发布到 Pages。

首次启用需要在仓库 **Settings → Pages → Source** 选择 **GitHub Actions**。

## 许可

[MIT](LICENSE)
