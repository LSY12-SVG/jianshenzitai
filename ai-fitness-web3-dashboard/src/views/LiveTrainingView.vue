<script setup>
import { computed, onMounted } from "vue";
import { storeToRefs } from "pinia";
import { useDashboardStore } from "@/stores/dashboard";
import { useLiveTrainingStore } from "@/stores/liveTraining";
import DashboardHeader from "@/components/DashboardHeader.vue";
import BaseChart from "@/components/BaseChart.vue";

const dashboardStore = useDashboardStore();
const liveTrainingStore = useLiveTrainingStore();

const { overview } = storeToRefs(dashboardStore);
const { error, loading, sessionData } = storeToRefs(liveTrainingStore);

const pageHeader = computed(() => sessionData.value?.header);
const wallet = computed(() => overview.value?.wallet);
const notifications = computed(() => overview.value?.notifications ?? 0);
const user = computed(() => overview.value?.user);
const statCards = computed(() => sessionData.value?.statCards ?? []);
const feedbackItems = computed(() => sessionData.value?.feedback ?? []);
const session = computed(() => sessionData.value?.session);
const intensity = computed(() => sessionData.value?.intensity);
const heartTrend = computed(() => sessionData.value?.heartTrend);
const plan = computed(() => sessionData.value?.plan);
const groupProgress = computed(() => sessionData.value?.groupProgress);
const device = computed(() => sessionData.value?.device);
const coach = computed(() => sessionData.value?.coach);
const controls = computed(() => sessionData.value?.controls);

const miniChartColorMap = {
  mint: "#26cea5",
  orange: "#ff8b1d",
  purple: "#b368ff",
};

function makeMiniLineOption(series, color) {
  return {
    animation: false,
    grid: { left: 0, right: 0, top: 2, bottom: 0 },
    xAxis: {
      type: "category",
      show: false,
      boundaryGap: false,
      data: series.map((_, index) => index),
    },
    yAxis: {
      type: "value",
      show: false,
    },
    series: [
      {
        data: series,
        type: "line",
        smooth: true,
        symbol: "none",
        lineStyle: {
          width: 2.5,
          color,
        },
      },
    ],
  };
}

const metricChartOptions = computed(() =>
  statCards.value.map((card) =>
    card.chartType === "line"
      ? makeMiniLineOption(card.series, miniChartColorMap[card.theme] ?? "#26cea5")
      : null
  )
);

const heartTrendOption = computed(() => {
  if (!heartTrend.value) {
    return {};
  }

  return {
    animation: false,
    color: ["#2bd0a9", "#d8e0ea"],
    grid: {
      left: 30,
      right: 10,
      top: 22,
      bottom: 24,
    },
    legend: {
      top: 0,
      left: 0,
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
      textStyle: {
        color: "#7c8796",
        fontSize: 12,
      },
      data: ["实时心率", "平均心率"],
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: heartTrend.value.labels,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: "#8d97a8",
        fontSize: 11,
      },
    },
    yAxis: {
      type: "value",
      min: 60,
      max: 180,
      splitNumber: 4,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: "#8d97a8",
        fontSize: 11,
      },
      splitLine: {
        lineStyle: {
          color: "rgba(224,230,238,0.9)",
          type: "dashed",
        },
      },
    },
    series: [
      {
        name: "实时心率",
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 5,
        data: heartTrend.value.realtime,
        lineStyle: {
          width: 2.5,
          color: "#2bd0a9",
        },
        itemStyle: {
          color: "#2bd0a9",
        },
      },
      {
        name: "平均心率",
        type: "line",
        smooth: true,
        symbol: "none",
        data: heartTrend.value.average,
        lineStyle: {
          width: 2,
          type: "dashed",
          color: "#d7dee8",
        },
      },
    ],
  };
});

onMounted(() => {
  dashboardStore.ensureDashboardLoaded();
  liveTrainingStore.ensureLoaded();
});
</script>

<template>
  <div v-if="!sessionData && !error" class="state-card">
    <h3>正在加载实时训练界面...</h3>
    <p>正在拉取实时训练 mock 数据并渲染分界面。</p>
  </div>

  <div v-else-if="error" class="state-card state-error">
    <h3>实时训练界面加载失败</h3>
    <p>{{ error }}</p>
    <button class="retry-btn" @click="liveTrainingStore.ensureLoaded()">重新加载</button>
  </div>

  <template v-else>
    <DashboardHeader
      :header="pageHeader"
      :wallet="wallet"
      :notifications="notifications"
      :user="user"
    />

    <section class="live-training-layout">
      <article class="panel live-stage-panel">
        <div class="live-stage-top">
          <div class="stage-exercise">
            <div class="stage-icon-circle">
              <svg viewBox="0 0 24 24"><path d="M12 5l2 2-1.2 2.8 2.7 2.6 1.5 6.1M12 5l-2 2 1.2 2.8-2.7 2.6-1.5 6.1M10.7 9.8h2.6M8.7 19h6.6M12 5a1.4 1.4 0 100-2.8A1.4 1.4 0 0012 5z" /></svg>
            </div>
            <div>
              <h3>{{ session.exerciseName }}</h3>
              <span class="stage-badge active">{{ session.aiBadge }}</span>
            </div>
          </div>

          <div class="stage-stats">
            <div class="stage-stat">
              <span>当前组</span>
              <strong>{{ session.currentSet }} <em>/ {{ session.totalSets }}</em></strong>
            </div>
            <div class="stage-stat">
              <span>次数</span>
              <strong>{{ session.currentRep }} <em>/ {{ session.totalReps }} 次</em></strong>
            </div>
            <div class="stage-stat">
              <span>用时</span>
              <strong>{{ session.elapsed }}</strong>
            </div>
            <div class="stage-stat">
              <span>状态</span>
              <strong class="status-good"><i></i>{{ session.status }}</strong>
            </div>
          </div>
        </div>

        <div class="live-stage-scene">
          <div class="scene-badge">
            <span class="scene-badge-icon">
              <svg viewBox="0 0 24 24"><path d="M12 4l6 2v5c0 4.2-2.6 7.2-6 8.8-3.4-1.6-6-4.6-6-8.8V6zM9 12l2 2 4-4" /></svg>
            </span>
            <span>{{ session.aiBadge }}</span>
          </div>

          <div class="scene-quality-card">
            <span class="scene-quality-title">动作质量</span>
            <strong>{{ session.quality.score }} <em>分</em></strong>
            <span class="stage-badge quality">{{ session.quality.grade }}</span>
            <div class="quality-divider"></div>
            <div v-for="joint in session.quality.joints" :key="joint.label" class="joint-row">
              <div>
                <span>{{ joint.label }}</span>
                <strong>{{ joint.value }}</strong>
              </div>
              <div class="joint-bar"><i></i></div>
            </div>
          </div>

          <div class="scene-room camera-off-room">
            <div class="camera-off-content">
              <span class="camera-off-icon">
                <svg viewBox="0 0 24 24"><path d="M4 7h11a2 2 0 012 2v8a2 2 0 01-2 2H4zM17 11l3-2v6l-3-2M4 4l16 16" /></svg>
              </span>
              <strong>摄像头未开启</strong>
              <p>开启摄像头后可进行 AI 实时识别与动作反馈</p>
            </div>
          </div>

          <div class="scene-toolbar">
            <button class="tool-btn">
              <svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
            </button>
            <button class="tool-btn">
              <svg viewBox="0 0 24 24"><path d="M5 7h14v12H5zM9 7l1.5-2h3L15 7M12 11a3 3 0 100 6 3 3 0 000-6z" /></svg>
            </button>
          </div>

          <div class="scene-resolution">
            <span>1080P</span>
            <svg viewBox="0 0 24 24"><path d="M4 18h2M8 14h2M12 10h2M16 6h2M20 3v15" /></svg>
          </div>
        </div>
      </article>

      <article
        v-for="(card, index) in statCards"
        :key="card.title"
        class="panel live-metric-card"
        :class="[`metric-${index + 1}`, `metric-theme-${card.theme}`]"
      >
        <div class="live-metric-head">
          <span class="live-metric-icon">
            <svg v-if="card.icon === 'heart'" viewBox="0 0 24 24"><path d="M12 20s-6.5-4.1-8.7-8.1C1.2 8.3 3 5 6.6 5c2 0 3.2 1 4.1 2.2C11.6 6 12.9 5 14.9 5c3.5 0 5.4 3.2 3.3 6.9C16 15.9 12 20 12 20z" /></svg>
            <svg v-else-if="card.icon === 'fire'" viewBox="0 0 24 24"><path d="M12.8 3c1.8 2.2 2.7 4.2 2.7 6.1 0 1.4-.6 2.8-1.7 4.2 3 .3 5.2 2.8 5.2 5.8A6 6 0 0113 25a6 6 0 01-6-5.9c0-2.4 1.4-4.4 3.5-5.4C10.1 9.6 11 6.4 12.8 3z" transform="translate(0 -1)" /></svg>
            <svg v-else-if="card.icon === 'star'" viewBox="0 0 24 24"><path d="M12 3l2.7 5.7L21 9.6l-4.5 4.1 1.2 6.3L12 17.1 6.3 20l1.2-6.3L3 9.6l6.3-.9z" /></svg>
            <svg v-else viewBox="0 0 24 24"><path d="M12 4l6 2v5c0 4.2-2.6 7.2-6 8.8-3.4-1.6-6-4.6-6-8.8V6zM9 12l2 2 4-4" /></svg>
          </span>
          <span class="live-metric-title">{{ card.title }}</span>
        </div>

        <template v-if="card.riskScale === undefined">
          <div class="live-metric-value">
            <strong>{{ card.value }}</strong>
            <span>{{ card.unit }}</span>
          </div>
          <div class="live-metric-foot">{{ card.footnote }}</div>
          <BaseChart :option="metricChartOptions[index]" class-name="live-mini-chart" />
        </template>

        <template v-else>
          <div class="live-metric-risk">
            <strong>{{ card.value }}</strong>
            <span>{{ card.footnote }}</span>
          </div>
          <div class="risk-bar">
            <i :style="{ width: `${card.riskScale * 100}%` }"></i>
          </div>
        </template>
      </article>

      <article class="panel live-feedback-panel">
        <div class="panel-head">
          <h3>实时反馈</h3>
        </div>

        <div class="live-feedback-list">
          <div
            v-for="item in feedbackItems"
            :key="`${item.title}-${item.time}`"
            class="feedback-item"
            :class="item.theme"
          >
            <span class="feedback-icon">
              <svg v-if="item.theme === 'success'" viewBox="0 0 24 24"><path d="M12 20a8 8 0 100-16 8 8 0 000 16zM8.5 12.2l2.2 2.2 4.8-4.8" /></svg>
              <svg v-else-if="item.theme === 'warning'" viewBox="0 0 24 24"><path d="M12 4l8 14H4zM12 10v3M12 16h.01" /></svg>
              <svg v-else-if="item.theme === 'info'" viewBox="0 0 24 24"><path d="M12 20a8 8 0 100-16 8 8 0 000 16zM12 11v4M12 8h.01" /></svg>
              <svg v-else viewBox="0 0 24 24"><path d="M8 4v3M16 4v3M5 8h14M7 12h4M7 16h6M5 5h14a1 1 0 011 1v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a1 1 0 011-1z" /></svg>
            </span>
            <div class="feedback-copy">
              <div class="feedback-line">
                <strong>{{ item.title }}</strong>
                <span>{{ item.time }}</span>
              </div>
              <p>{{ item.detail }}</p>
            </div>
          </div>
        </div>

        <a href="#" class="feedback-link">查看全部反馈 <span>→</span></a>
      </article>

      <article class="panel live-intensity-panel">
        <h3>{{ intensity.title }}</h3>
        <strong>{{ intensity.level }}</strong>
        <p>{{ intensity.detail }}</p>
        <div class="intensity-ring" :style="{ '--intensity': `${intensity.progress}%` }">
          <div class="intensity-inner">
            <span>{{ intensity.progress }}%</span>
            <em>当前强度</em>
          </div>
        </div>
      </article>

      <article class="panel live-heart-trend-panel">
        <h3>{{ heartTrend.title }}</h3>
        <BaseChart class-name="heart-trend-chart" :option="heartTrendOption" />
      </article>
    </section>

    <section class="live-training-bottom">
      <article class="panel live-plan-panel">
        <div class="panel-head compact">
          <h3>{{ plan.title }}</h3>
        </div>
        <h4>{{ plan.name }}</h4>
        <p>{{ plan.meta }}</p>
        <div class="plan-targets">
          <div v-for="target in plan.targets" :key="target.label" class="plan-target">
            <span :class="['target-icon', target.theme]">
              <svg v-if="target.theme === 'mint'" viewBox="0 0 24 24"><path d="M12 4l6 8-6 8-6-8z" /></svg>
              <svg v-else viewBox="0 0 24 24"><path d="M12.8 3c1.8 2.2 2.7 4.2 2.7 6.1 0 1.4-.6 2.8-1.7 4.2 3 .3 5.2 2.8 5.2 5.8A6 6 0 0113 25a6 6 0 01-6-5.9c0-2.4 1.4-4.4 3.5-5.4C10.1 9.6 11 6.4 12.8 3z" transform="translate(0 -1)" /></svg>
            </span>
            <div>
              <small>{{ target.label }}</small>
              <strong>{{ target.value }}</strong>
            </div>
          </div>
        </div>
        <div class="plan-visual">
          <div class="plan-clipboard"></div>
          <div class="plan-dumbbell"></div>
        </div>
        <button class="wide-action">{{ plan.actionLabel }} <span>→</span></button>
      </article>

      <article class="panel live-group-panel">
        <div class="panel-head compact">
          <div>
            <h3>{{ groupProgress.title }}</h3>
            <strong class="group-summary">{{ groupProgress.summary }}</strong>
          </div>
          <span class="group-percent">{{ groupProgress.percent }}%</span>
        </div>
        <div class="group-progress-bar">
          <i :style="{ width: `${groupProgress.percent}%` }"></i>
        </div>
        <div class="group-list">
          <div v-for="item in groupProgress.items" :key="item.index" class="group-row">
            <span class="group-index">{{ item.index }}</span>
            <span class="group-name">{{ item.name }}</span>
            <span class="group-target">{{ item.target }}</span>
            <span class="group-state" :class="item.theme">{{ item.status }}</span>
          </div>
        </div>
      </article>

      <article class="panel live-device-panel">
        <div class="panel-head compact">
          <h3>{{ device.title }}</h3>
        </div>
        <div class="device-content">
          <div class="device-watch">
            <div class="watch-strap top"></div>
            <div class="watch-body">
              <div class="watch-screen">♥ 128</div>
            </div>
            <div class="watch-strap bottom"></div>
          </div>
          <div class="device-copy">
            <h4>{{ device.name }}</h4>
            <span class="device-status">{{ device.status }}</span>
            <p>电量 {{ device.battery }}%</p>
          </div>
        </div>
        <button class="wide-action">{{ device.actionLabel }} <span>→</span></button>
      </article>

      <article class="panel live-coach-panel">
        <div class="panel-head compact">
          <h3><span class="spark-star">✦</span> {{ coach.title }}</h3>
        </div>
        <div class="coach-content">
          <p>{{ coach.content }}</p>
          <div class="coach-robot">
            <div class="halo"></div>
            <div class="robot-head">
              <span class="antenna"></span>
              <span class="face"><i></i><i></i></span>
            </div>
            <div class="robot-body"></div>
          </div>
        </div>
        <button class="wide-action">{{ coach.actionLabel }} <span>→</span></button>
      </article>
    </section>

    <section class="live-control-bar">
      <div class="voice-switch">
        <span class="voice-icon">
          <svg viewBox="0 0 24 24"><path d="M5 9v6M9 7v10M13 9v6M17 5l4 4-4 4" /></svg>
        </span>
        <span>语音播报</span>
        <button class="switch on"><i></i></button>
      </div>
      <button class="control-btn pause">❚❚ {{ controls.pauseLabel }}</button>
      <button class="control-btn stop">■ {{ controls.stopLabel }}</button>
      <button class="control-btn finish">⚑ {{ controls.finishLabel }}</button>
    </section>
  </template>
</template>
