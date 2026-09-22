/**
 * 全局可调参数：时长、数量上限、配色、粒子密度。
 * 想改效果（节奏快慢、粒子多少、颜色、文案、阈值）只需要动这个文件。
 * 时间类参数统一用毫秒。
 */
export const config = {
  // 开场由星尘与时光碎片汇聚成的两段文字，按顺序出现
  texts: {
    greeting: '生日快乐 WZT',
    welcome: '欢迎来到 20 岁',
  },

  scenes: {
    starWords: {
      maxPoints: 900, // 单段文字的点阵上限（也就是粒子数上限）
      density: 1.92, // 采样密度：点数与它成正比
      particleScale: 1, // 粒子尺寸的全局缩放
      shardRatio: 0.3, // 「时光碎片」的占比，其余是星尘
      floatUntil: 2600, // 先在三维空间里漂浮这么久，像宇宙里散落的星光
      formStagger: 1100, // 每颗粒子开始汇聚的先后差，让字像一笔笔被点亮
      travelTime: 1400, // 单颗粒子飞向自己位置的时长（缓入缓出，起步与收尾都慢）
      readSettle: 600, // 全部落位后再留一点时间让人看清，之后才允许点击
      scatterTime: 700, // 两段文字之间，先散回漂浮态多久再重新汇聚
    },
    crown: {
      leadStars: 140, // 开场先来一段星光汇聚，作为引子
      leadPullAt: 1000, // 星光开始向中心汇聚的时刻
      leadUntil: 4600, // 铺垫结束、开始放气球的时刻
      maxBalloons: 12,
      balloonInterval: 1150, // 气球生成间隔
      sparkPerBurst: 34, // 单只气球绽放出的星光数量
      ambientSparks: 70, // 常驻氛围星光
      fireworkSparks: 160, // 松手时在落点炸开的星光数量
      fireworkSpeed: [170, 620], // 烟花初速范围：决定炸开的半径，越大越铺满屏幕
      fireworkLife: [2, 3.4], // 烟花寿命，配合初速决定最终铺开的范围
      popRadius: 150, // 落点这个范围内的气球跟着一起炸开
      gatherTighten: 18, // 「蚁球」收紧速度（像素/秒），越小聚得越慢越明显
      spinSpeed: 1.1, // 蚁球缓慢自转的角速度
    },
    cake: {
      ambientSparks: 36, // 蛋糕之外的低密度氛围星光
      gatherStart: 300, // 星光开始起飞的时刻
      gatherDelay: 2500, // 每颗星光的最大随机延迟，形成先后汇聚
      rotateSpeed: 0.26, // 每秒旋转弧度，转一圈约 24 秒
      tilt: 0.3, // 俯视倾斜，让顶面那一圈能被看见
      jitter: 1.8, // 粒子随机抖动幅度（像素）
      driftRatio: 0.12, // 缓慢飘散再收回的粒子占比
      candleLightAt: 3600, // 蜡烛点亮
      hintAt: 5000, // 提示「闭上眼，许个愿」浮现
      wishDuration: 9000, // 从提示浮现起留这么久许愿，到点自动吹灭
      flameOut: 1100, // 烛火升起消散时长
      fireworkBursts: 10, // 吹灭后全屏烟花的次数
      sparkPerFirework: 60, // 单次烟花炸开的星光数量
      fireworkDuration: 4200, // 烟花的整体时长，次数在这个时长里均匀铺开
      fireworkRead: 800, // 烟花放完后再留一点时间，之后才允许点击
    },
  },

  colors: {
    night: ['#05060F', '#16123A'],
    spark: ['#FFD9A0', '#A8F0FF', '#FFB3E6', '#9AB8FF', '#B8FFD9'],
    // 组字用的星尘与时光碎片：以白到冰蓝为主，掺一点暖金，像散落的宇宙星光
    starText: ['#FFFFFF', '#EDF3FF', '#DCE8FF', '#A8F0FF', '#FFD9A0'],
    balloon: ['#FF8FD0', '#7DE3FF', '#FFD97D', '#B497E7', '#B8FFD9'],
    cake: {
      outline: ['#FFFFFF', '#EDF3FF'], // 轮廓描边：最亮的白
      surface: ['#DCE8FF', '#CBB2F0'], // 肋线与层内填充：稍暗
      top: ['#FFFFFF', '#EDF3FF'], // 每层顶面，交代「这是个有顶面的立体」
      plate: ['#EADFFF', '#C9A8FF'], // 托盘：淡紫，比蛋糕本体更偏紫一点，用来分开底座与主体
      candle: '#FFD9A0', // 顶部那根金色蜡烛
      flame: ['#FFF3C4', '#FFD9A0'],
      // 悬浮彩带：五色，和气球共用同一套节日色
      ribbon: ['#FF8FD0', '#7DE3FF', '#FFD97D', '#B497E7', '#B8FFD9'],
    },
  },

  performance: {
    maxDPR: 2,
    lowFpsThreshold: 45, // 低于该帧率视为卡顿
    lowFpsSeconds: 2, // 连续卡顿时长达到该值即降级
    lowFpsScale: 0.6, // 降级后粒子上限的缩放系数
  },
}
