export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v)

/** 缓入缓出：起步与收尾都慢，中间最快 —— 用于粒子的汇聚轨迹 */
export function easeInOutCubic(t) {
  const x = clamp(t, 0, 1)
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}

/** 取 from → to 的最短角度差，避免跨 ±π 时绕远路 */
export function shortestAngle(from, to) {
  let d = (to - from) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}
