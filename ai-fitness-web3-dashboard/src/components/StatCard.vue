<script setup>
import { computed } from "vue";
import BaseChart from "./BaseChart.vue";

const props = defineProps({
  card: {
    type: Object,
    required: true,
  },
});

const themeColorMap = {
  mint: "#1bcf9c",
  blue: "#66aefe",
  purple: "#bb76ff",
  orange: "#ff8619",
};

const chartOption = computed(() => {
  const color = themeColorMap[props.card.theme] ?? "#1bcf9c";

  if (props.card.chart === "line") {
    return {
      animation: false,
      grid: { left: 0, right: 0, top: 8, bottom: 0 },
      xAxis: {
        type: "category",
        boundaryGap: false,
        show: false,
        data: props.card.series.map((_, index) => index),
      },
      yAxis: { type: "value", show: false },
      series: [
        {
          data: props.card.series,
          type: "line",
          smooth: true,
          symbol: "none",
          lineStyle: {
            color,
            width: 3,
          },
        },
      ],
    };
  }

  return {
    animation: false,
    grid: { left: 0, right: 0, top: 4, bottom: 0 },
    xAxis: {
      type: "category",
      show: false,
      data: props.card.series.map((_, index) => index),
    },
    yAxis: { type: "value", show: false },
    series: [
      {
        data: props.card.series,
        type: "bar",
        barWidth: props.card.theme === "orange" ? 6 : 8,
        itemStyle: {
          color,
          borderRadius: 2,
        },
      },
    ],
  };
});
</script>

<template>
  <article class="stat-card">
    <div class="stat-icon" :class="card.theme">
      <svg v-if="card.icon === 'clock'" viewBox="0 0 24 24"><path d="M12 7v5l3 3M12 3a9 9 0 100 18 9 9 0 000-18z" /></svg>
      <svg v-else-if="card.icon === 'calendar'" viewBox="0 0 24 24"><path d="M7 3v3M17 3v3M4 9h16M5 6h14a1 1 0 011 1v11a2 2 0 01-2 2H6a2 2 0 01-2-2V7a1 1 0 011-1zM8 13h2M12 13h2M16 13h.01M8 17h2M12 17h2" /></svg>
      <svg v-else-if="card.icon === 'star'" viewBox="0 0 24 24"><path d="M12 3l2.7 5.7L21 9.6l-4.5 4.1 1.2 6.3L12 17.1 6.3 20l1.2-6.3L3 9.6l6.3-.9z" /></svg>
      <svg v-else viewBox="0 0 24 24"><path d="M12.8 3c1.8 2.2 2.7 4.2 2.7 6.1 0 1.4-.6 2.8-1.7 4.2 3 .3 5.2 2.8 5.2 5.8A6 6 0 0113 25a6 6 0 01-6-5.9c0-2.4 1.4-4.4 3.5-5.4C10.1 9.6 11 6.4 12.8 3z" transform="translate(0 -1)" /></svg>
    </div>
    <div class="stat-copy">
      <p>{{ card.title }}</p>
      <h3>{{ card.value }} <span>{{ card.unit }}</span></h3>
      <small><em>{{ card.delta }}</em> {{ card.compare }}</small>
    </div>
    <BaseChart class-name="mini-chart" :option="chartOption" />
  </article>
</template>
