<script setup>
import { computed } from "vue";
import BaseChart from "./BaseChart.vue";

const props = defineProps({
  zones: {
    type: Array,
    required: true,
  },
});

const colorMap = {
  blue: "#5ca6ff",
  green: "#43d7a5",
  yellow: "#ffb338",
  red: "#ff635d",
};

const chartOption = computed(() => ({
  animation: false,
  tooltip: { show: false },
  series: [
    {
      type: "pie",
      radius: ["62%", "78%"],
      center: ["50%", "50%"],
      avoidLabelOverlap: true,
      label: { show: false },
      labelLine: { show: false },
      itemStyle: {
        borderWidth: 0,
      },
      data: props.zones.map((zone) => ({
        value: zone.value,
        name: zone.label,
        itemStyle: {
          color: colorMap[zone.color] ?? "#43d7a5",
        },
      })),
    },
  ],
}));
</script>

<template>
  <article class="panel donut-panel">
    <div class="panel-head">
      <h3>心率区间分析</h3>
      <span class="info-dot">i</span>
    </div>
    <div class="donut-layout">
      <div class="donut-wrap">
        <BaseChart class-name="donut-echart" :option="chartOption" />
        <div class="donut-center">
          <svg viewBox="0 0 24 24"><path d="M4 13h4l2-6 4 12 2-6h4" /></svg>
          <strong>今日分布</strong>
        </div>
      </div>
      <ul class="legend">
        <li v-for="zone in zones" :key="zone.label">
          <span class="dot" :class="zone.color"></span>
          {{ zone.label }}
          <strong>{{ zone.percent }}</strong>
          <em>{{ zone.minutes }}</em>
        </li>
      </ul>
    </div>
    <div class="success-pill">
      <span class="shield">
        <svg viewBox="0 0 24 24"><path d="M12 4l6 2v5c0 4.2-2.6 7.2-6 8.8-3.4-1.6-6-4.6-6-8.8V6zM9 12l2 2 4-4" /></svg>
      </span>
      <span>燃脂效果良好，继续保持当前强度！</span>
    </div>
  </article>
</template>
