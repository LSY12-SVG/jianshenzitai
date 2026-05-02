export const navigationItems = [
  { label: "训练总览", icon: "home", to: "/dashboard" },
  { label: "实时训练", icon: "clock", to: "/live-training" },
  { label: "动作分析", icon: "pulse", to: "/movement-analysis" },
  { label: "训练档案", icon: "folder", to: "/archives" },
  { label: "训练计划", icon: "calendar", to: "/plans" },
  { label: "训练报告", icon: "chart", to: "/reports" },
];

export const defaultArchiveCard = {
  title: "链上训练档案",
  lines: ["你的训练记录已上链", "数据安全，不可篡改"],
  actionLabel: "查看详情",
};

export const defaultPoints = {
  label: "Fitness Points",
  total: "2,860",
  unit: "FP",
  weeklyGain: "+120",
  weeklyLabel: "本周获得",
};

export const dashboardOverviewMock = {
  header: {
    title: "训练总览",
    subtitle: "欢迎回来，保持热爱，持续进步！",
  },
  wallet: {
    address: "0xA3...9F2B",
    status: "已连接",
  },
  notifications: 3,
  user: {
    name: "Aileen",
  },
  archiveCard: defaultArchiveCard,
  points: defaultPoints,
  stats: [
    {
      title: "今日训练时长",
      value: "68",
      unit: "分钟",
      delta: "↑ 16%",
      compare: "较昨日",
      icon: "clock",
      theme: "mint",
      chart: "line",
      series: [46, 42, 58, 40, 61, 47, 66],
    },
    {
      title: "本周训练天数",
      value: "5",
      unit: "天",
      delta: "↑ 1天",
      compare: "较上周",
      icon: "calendar",
      theme: "blue",
      chart: "bars",
      series: [4, 7, 5, 9, 8],
    },
    {
      title: "平均得分",
      value: "86",
      unit: "分",
      delta: "↑ 4分",
      compare: "较上周",
      icon: "star",
      theme: "purple",
      chart: "line",
      series: [62, 68, 64, 71, 66, 73, 86],
    },
    {
      title: "总消耗卡路里",
      value: "1,248",
      unit: "kcal",
      delta: "↑ 12%",
      compare: "较上周",
      icon: "fire",
      theme: "orange",
      chart: "bars",
      series: [5, 8, 4, 9, 10, 7],
    },
  ],
  heartZones: [
    { color: "blue", label: "热身区间 (50-120)", percent: "18%", minutes: "12 分钟", value: 18 },
    { color: "green", label: "燃脂区间 (120-140)", percent: "42%", minutes: "28 分钟", value: 42 },
    { color: "yellow", label: "心肺区间 (140-160)", percent: "28%", minutes: "19 分钟", value: 28 },
    { color: "red", label: "极限区间 (160+)", percent: "12%", minutes: "8 分钟", value: 12 },
  ],
  radar: {
    indicators: [
      { name: "力量", max: 100 },
      { name: "耐力", max: 100 },
      { name: "柔韧", max: 100 },
      { name: "协调", max: 100 },
      { name: "平衡", max: 100 },
    ],
    current: [78, 69, 72, 65, 63],
    previous: [58, 51, 57, 49, 45],
  },
  weekProgress: [
    { day: "一", date: "19", status: "done" },
    { day: "二", date: "20", status: "done" },
    { day: "三", date: "21", status: "done" },
    { day: "四", date: "22", status: "done" },
    { day: "五", date: "23", status: "done" },
    { day: "六", date: "24", status: "partial" },
    { day: "日", date: "25", status: "todo" },
  ],
  advice: {
    title: "AI 每日建议",
    summary: "根据你最近的训练表现，整体状态良好，轻度疲劳。",
    recommendation:
      "建议今天进行 中等强度的心肺训练 + 核心力量 组合，有助于提升耐力并增强核心稳定性。",
    tags: [
      { label: "推荐强度", value: "中等" },
      { label: "推荐时长", value: "45-60 分钟" },
    ],
  },
  features: [
    { title: "实时训练", description: ["实时心率监测", "智能语音指导"], visual: "watch", theme: "blue-card" },
    { title: "动作分析", description: ["AI 动作识别", "3D 动评估"], visual: "figure", theme: "gray-card" },
    { title: "训练档案", description: ["历史记录管理", "数据上链存证"], visual: "folder", theme: "mint-card" },
    { title: "训练计划", description: ["个性化计划", "智能调整建议"], visual: "clipboard", theme: "purple-card" },
    { title: "训练报告", description: ["多维数据分析", "可视化报告导出"], visual: "report", theme: "orange-card" },
  ],
};

export const dashboardTrainingsMock = [
  { title: "HIIT 极速燃脂", date: "2024-05-25 10:30", duration: "32 分钟", score: "89 分", icon: "hiit", theme: "green" },
  { title: "力量训练 - 上肢", date: "2024-05-24 18:45", duration: "48 分钟", score: "84 分", icon: "strength", theme: "purple" },
  { title: "瑜伽 - 灵活舒展", date: "2024-05-23 07:30", duration: "45 分钟", score: "85 分", icon: "alert", theme: "orange" },
];

export const liveTrainingSessionMock = {
  header: {
    title: "实时训练",
    subtitle: "AI 实时识别动作，精准反馈，助你科学高效训练",
  },
  session: {
    exerciseName: "深蹲（徒手）",
    currentSet: 2,
    totalSets: 4,
    currentRep: 12,
    totalReps: 15,
    elapsed: "00:32",
    status: "良好",
    aiBadge: "AI 识别中",
    quality: {
      score: 92,
      grade: "优秀",
      joints: [
        { label: "膝关节", value: "89°" },
        { label: "髋关节", value: "102°" },
      ],
    },
  },
  statCards: [
    {
      title: "心率",
      value: "128",
      unit: "bpm",
      footnote: "燃脂区间",
      icon: "heart",
      theme: "mint",
      chartType: "line",
      series: [98, 100, 112, 107, 129, 125, 118],
    },
    {
      title: "消耗",
      value: "248",
      unit: "kcal",
      footnote: "↑ 15% 较上周",
      icon: "fire",
      theme: "orange",
      chartType: "line",
      series: [58, 70, 65, 88, 92, 74, 95],
    },
    {
      title: "动作得分",
      value: "92",
      unit: "/100 分",
      footnote: "↑ 优秀",
      icon: "star",
      theme: "purple",
      chartType: "line",
      series: [55, 58, 72, 69, 84, 80, 92],
    },
    {
      title: "疲劳风险",
      value: "低",
      unit: "",
      footnote: "状态稳定",
      icon: "shield",
      theme: "warning",
      riskScale: 0.31,
    },
  ],
  intensity: {
    title: "训练强度",
    level: "中等偏高",
    detail: "有氧 + 力量刺激",
    progress: 72,
  },
  heartTrend: {
    title: "心率趋势（bpm）",
    labels: ["00:00", "05:00", "10:00", "15:00", "20:00", "25:00"],
    realtime: [96, 98, 131, 114, 147, 138, 128, 151, 162, 154],
    average: [100, 102, 108, 111, 115, 119, 121, 122, 124, 126],
  },
  feedback: [
    {
      title: "姿势良好",
      detail: "背部挺直，核心收紧，动作稳定。",
      time: "00:32",
      theme: "success",
    },
    {
      title: "膝盖对齐提醒",
      detail: "膝盖略微内扣，请保持与脚尖方向一致。",
      time: "00:28",
      theme: "warning",
    },
    {
      title: "核心收紧",
      detail: "保持腹部收紧，有助于保护腰椎。",
      time: "00:20",
      theme: "info",
    },
    {
      title: "建议休息",
      detail: "心率上升较快，建议本组结束后休息 60 秒。",
      time: "00:15",
      theme: "purple",
    },
  ],
  plan: {
    title: "本次训练计划",
    name: "全身塑形进阶计划 · 第3天",
    meta: "预计 45 分钟 | 中等强度",
    targets: [
      { label: "训练目标", value: "燃脂塑形", theme: "mint" },
      { label: "消耗目标", value: "450 kcal", theme: "orange" },
    ],
    actionLabel: "查看计划详情",
  },
  groupProgress: {
    title: "组数进度",
    summary: "2 / 4 组已完成",
    percent: 50,
    items: [
      { index: 1, name: "深蹲（徒手）", target: "15 次", status: "已完成", theme: "done" },
      { index: 2, name: "深蹲（徒手）", target: "15 次", status: "进行中", theme: "active" },
      { index: 3, name: "弓步蹲（左右）", target: "12 次 / 侧", status: "待开始", theme: "pending" },
      { index: 4, name: "平板支撑", target: "45 秒", status: "待开始", theme: "pending" },
    ],
  },
  device: {
    title: "设备连接",
    name: "AI Fitness Watch 3",
    status: "已连接",
    battery: 78,
    actionLabel: "设备设置",
  },
  coach: {
    title: "AI 教练建议",
    content:
      "你的深蹲表现非常棒！膝关节角度和稳定性都有提升。建议下一组适当增加 2-3 次挑战自己！",
    actionLabel: "查看详细建议",
  },
  controls: {
    voiceBroadcast: true,
    pauseLabel: "暂停训练",
    stopLabel: "结束本组",
    finishLabel: "完成训练",
  },
};

export const featureRouteMeta = {
  "live-training": {
    title: "实时训练",
    description: "接近真实业务形态的训练监控页，后续可以接入直播心率流、动作识别状态和设备连接状态。",
    highlights: ["实时设备状态", "训练过程计时", "语音指导与异常提醒"],
  },
  "movement-analysis": {
    title: "动作分析",
    description: "保留了业务页入口位，后续适合挂 3D 姿态识别、分段动作评分和纠错建议。",
    highlights: ["骨骼关键点回放", "动作完成度评分", "姿态偏差提示"],
  },
  archives: {
    title: "训练档案",
    description: "适合接入历史记录、链上存证、用户训练画像和长期趋势分析。",
    highlights: ["档案时间轴", "链上记录检索", "个人训练画像"],
  },
  plans: {
    title: "训练计划",
    description: "可以继续扩展为周期化训练计划、恢复日安排和智能调整策略中心。",
    highlights: ["周期计划编排", "恢复日建议", "目标进度联动"],
  },
  reports: {
    title: "训练报告",
    description: "可以承接日报、周报和月报导出，以及图表分析和多维对比。",
    highlights: ["日报/周报导出", "趋势图分析", "训练表现对比"],
  },
};
