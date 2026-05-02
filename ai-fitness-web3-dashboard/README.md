# AI Fitness Web3 Dashboard

AI Fitness Web3 系统前端项目。当前项目基于 `Vue 3 + Vite` 搭建，已实现训练总览页和实时训练页，并采用 `Router + Pinia + Mock API + ECharts` 的结构组织，便于后续继续接入真实后端、摄像头能力和设备数据。

## 项目简介

本项目用于还原并扩展 AI Fitness Web3 系统的前端界面，当前重点包括：

- `训练总览` 页面
- `实时训练` 页面
- 左侧系统导航和应用壳层
- 基于 Mock 数据的页面渲染流程
- 图表、状态卡片、设备卡片、训练反馈卡片等业务组件

项目当前适合用于以下场景：

- 高保真前端静态还原
- 中后台/数据面板原型开发
- 与真实接口对接前的前端预演
- 后续扩展摄像头、动作识别、训练设备联动等业务能力

## 技术栈

### 核心框架

- `Vue 3`
  - 使用组合式 API 组织页面和组件
  - 作为整个项目的核心 UI 框架

- `Vite`
  - 负责本地开发、构建和预览
  - 提供更快的启动和热更新体验

### 路由与状态管理

- `Vue Router`
  - 用于管理页面级路由
  - 当前已接入：
    - `/dashboard`
    - `/live-training`
    - `/movement-analysis`
    - `/archives`
    - `/plans`
    - `/reports`

- `Pinia`
  - 用于全局状态管理
  - 当前已拆分为：
    - `dashboard store`
    - `liveTraining store`

### 数据请求与 Mock

- `Axios`
  - 统一封装 HTTP 请求入口

- `axios-mock-adapter`
  - 在开发环境下模拟后端接口
  - 当前已模拟：
    - `/api/dashboard/overview`
    - `/api/dashboard/trainings`
    - `/api/live-training/session`

### 图表

- `ECharts`
  - 用于趋势图、心率图、小型统计图等业务图表渲染

- `vue-echarts`
  - 作为 Vue 与 ECharts 的桥接封装

### 样式方案

- 原生 `CSS`
  - 统一写在 `src/styles.css`
  - 以页面级高保真还原为目标
  - 使用大量自定义渐变、阴影、圆角、布局网格和伪元素实现视觉细节

## 技术选型说明

### 为什么选择 Vue 3

- 组件拆分足够灵活，适合当前这种高保真仪表盘页面
- 组合式 API 更适合组织页面状态、图表配置和局部交互逻辑
- 与 Pinia、Vue Router、ECharts 的组合成熟稳定

### 为什么选择 Vite

- 启动快，适合频繁调整界面细节
- 原生支持 ES Module，配置简单
- 适合中小型前端项目快速成型

### 为什么使用 Pinia

- 相比把所有数据写死在视图组件中，更利于后续接真实接口
- 可把不同业务页面的数据职责分开
- 对当前的总览页、实时训练页这种多卡片页面更清晰

### 为什么先用 Mock API

- 当前项目的重点是前端界面与交互结构
- 在后端尚未接入时，可以先把真实的数据流走通
- 后续切换真实接口时，页面层无需大改

### 为什么使用 ECharts

- 对仪表盘场景支持成熟
- 折线图、环图、小型趋势图等都比较适合
- 后续如果需要增加更多训练趋势、设备曲线、统计图，扩展成本较低

## 当前框架与目录结构

```text
E:\南客松前端
├─ src
│  ├─ components
│  │  ├─ ActivityTable.vue
│  │  ├─ AdvicePanel.vue
│  │  ├─ BaseChart.vue
│  │  ├─ DashboardHeader.vue
│  │  ├─ FeatureCard.vue
│  │  ├─ HeartRatePanel.vue
│  │  ├─ ProgressPanel.vue
│  │  ├─ RadarPanel.vue
│  │  ├─ Sidebar.vue
│  │  └─ StatCard.vue
│  ├─ data
│  │  └─ dashboard.js
│  ├─ layouts
│  │  └─ AppShell.vue
│  ├─ mocks
│  │  └─ index.js
│  ├─ router
│  │  └─ index.js
│  ├─ services
│  │  ├─ dashboardApi.js
│  │  └─ http.js
│  ├─ stores
│  │  ├─ dashboard.js
│  │  └─ liveTraining.js
│  ├─ views
│  │  ├─ DashboardView.vue
│  │  ├─ LiveTrainingView.vue
│  │  └─ PlaceholderView.vue
│  ├─ App.vue
│  ├─ main.js
│  └─ styles.css
├─ index.html
├─ package.json
├─ vite.config.js
└─ README.md
```

## 页面结构说明

### 1. 训练总览页

路由地址：

```text
/dashboard
```

当前内容包括：

- 顶部标题区、搜索框、钱包连接状态、通知与头像
- 四个统计指标卡片
- 心率区间分析
- 能力雷达图
- 本周训练进度追踪
- 最近训练动态
- AI 每日建议
- 底部功能入口卡片

### 2. 实时训练页

路由地址：

```text
/live-training
```

当前内容包括：

- 顶部实时训练标题与搜索区
- 左侧大训练画面区
- 心率、消耗、动作得分、疲劳风险卡片
- 实时反馈列表
- 训练强度与心率趋势
- 本次训练计划
- 组数进度
- 设备连接
- AI 教练建议
- 底部训练控制条

当前中间画面区已改成黑色占位屏，提示摄像头未开启，便于后续接入真实摄像头流。

### 3. 其他占位页

当前以下页面已接路由，但仍为占位结构：

- `/movement-analysis`
- `/archives`
- `/plans`
- `/reports`

这些页面已经可以承接后续业务模块继续开发。

## 组件设计思路

### Layout 层

- `AppShell.vue`
  - 负责整个应用壳层布局
  - 包含侧边栏和主内容区域

### View 层

- `DashboardView.vue`
  - 负责训练总览页的数据装配

- `LiveTrainingView.vue`
  - 负责实时训练页的数据装配

- `PlaceholderView.vue`
  - 用于其他未完成页面的承载

### 业务组件层

- `Sidebar.vue`
  - 左侧导航及积分卡、链上档案卡

- `DashboardHeader.vue`
  - 页面顶部标题、搜索、钱包连接状态

- `StatCard.vue`
  - 复用型指标卡片

- `BaseChart.vue`
  - 图表基础封装

## 数据流说明

当前项目的数据流是：

```text
View
-> Pinia Store
-> API Service
-> Axios
-> Mock Adapter
-> Mock Data
```

即：

1. 页面进入后调用 Store 的加载方法
2. Store 通过 `services` 请求接口
3. `Axios` 向 `/api/...` 发请求
4. 开发环境中 `axios-mock-adapter` 拦截并返回本地 mock 数据
5. Store 更新状态
6. View 和组件重新渲染

这种结构的好处是，后续只需要替换接口返回源，就可以从 Mock 平滑切换到真实后端。

## 已实现的 Store

### `src/stores/dashboard.js`

负责：

- 总览页 overview 数据
- 最近训练数据
- 加载状态、错误状态、是否已初始化

### `src/stores/liveTraining.js`

负责：

- 实时训练页 session 数据
- 加载状态、错误状态、是否已初始化

## 已实现的 Mock 接口

定义位置：

- `src/mocks/index.js`

当前接口：

- `GET /api/dashboard/overview`
- `GET /api/dashboard/trainings`
- `GET /api/live-training/session`

Mock 数据定义位置：

- `src/data/dashboard.js`

## 开发环境要求

- `Node.js` 22+
- `npm` 10+

## 安装依赖

```bash
npm install
```

## 本地开发

```bash
npm run dev
```

默认开发地址：

```text
http://127.0.0.1:4173/
```

常用页面：

- [http://127.0.0.1:4173/dashboard](http://127.0.0.1:4173/dashboard)
- [http://127.0.0.1:4173/live-training](http://127.0.0.1:4173/live-training)

## 生产构建

```bash
npm run build
```

构建产物输出目录：

```text
dist/
```

## 本地预览构建结果

```bash
npm run preview
```

## 当前依赖清单

### dependencies

- `vue`
- `vue-router`
- `pinia`
- `axios`
- `axios-mock-adapter`
- `echarts`
- `vue-echarts`

### devDependencies

- `vite`
- `@vitejs/plugin-vue`

## 已知现状

- `实时训练` 页面中间训练区域当前是黑屏占位，提示摄像头未开启
- 项目中 `charts` 构建 chunk 体积仍偏大，但不影响功能
- 根目录保留了较早阶段的 `script.js` 和 `styles.css`，当前运行不再依赖它们
- `movement-analysis`、`archives`、`plans`、`reports` 仍是占位页

## 后续建议

### 可以继续扩展的方向

- 接入真实后端接口，替换现有 Mock
- 接入摄像头权限申请与视频流展示
- 增加设备选择、摄像头开关、训练中断状态
- 增加搜索、筛选、时间维度切换
- 为占位页继续补真实业务模块
- 继续做代码分包优化，降低图表 chunk 体积

### 如果要接入真实摄像头

建议后续按以下方向扩展：

- 在 `LiveTrainingView.vue` 中加入摄像头权限状态管理
- 使用浏览器 `MediaDevices.getUserMedia`
- 将当前黑屏占位切换为视频流容器
- 保留当前“摄像头未开启”作为 fallback 状态

## 适合的下一步开发顺序

推荐顺序：

1. 接入真实摄像头流
2. 接入真实实时训练接口
3. 补动作分析页
4. 补训练计划与训练报告页
5. 做性能与打包优化

## 维护说明

如果后续继续开发，建议遵循以下原则：

- 新页面优先走 `views + store + service + mock` 结构
- 新图表统一优先通过 `BaseChart.vue` 接入
- 页面风格继续沿用当前的浅色玻璃态仪表盘视觉
- 新增 mock 数据优先集中维护在 `src/data/dashboard.js` 或按模块拆分

---

如需继续扩展本项目，建议优先从 `src/views/LiveTrainingView.vue` 与 `src/stores/liveTraining.js` 开始。
