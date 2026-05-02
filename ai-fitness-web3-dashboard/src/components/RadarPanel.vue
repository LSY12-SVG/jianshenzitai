<script setup>
import { computed } from "vue";

const props = defineProps({
  radar: {
    type: Object,
    default: () => ({
      indicators: [],
      current: [],
      previous: [],
    }),
  },
});

const centerX = 160;
const centerY = 110;
const radius = 78;

function toPolygon(values) {
  if (!values.length) {
    return "";
  }

  return values
    .map((value, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / values.length;
      const rate = Math.max(0, Math.min(100, value)) / 100;
      const x = centerX + Math.cos(angle) * radius * rate;
      const y = centerY + Math.sin(angle) * radius * rate;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

const currentPoints = computed(() => toPolygon(props.radar.current));
const previousPoints = computed(() => toPolygon(props.radar.previous));
const currentDots = computed(() =>
  (props.radar.current ?? []).map((value, index, values) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / values.length;
    const rate = Math.max(0, Math.min(100, value)) / 100;
    return {
      x: centerX + Math.cos(angle) * radius * rate,
      y: centerY + Math.sin(angle) * radius * rate,
    };
  })
);
</script>

<template>
  <article class="panel radar-panel">
    <div class="panel-head">
      <h3>能力雷达图</h3>
      <span class="info-dot">i</span>
    </div>
    <div class="radar-wrap">
      <span class="radar-label top">力量</span>
      <span class="radar-label right">耐力</span>
      <span class="radar-label bottom-right">柔韧</span>
      <span class="radar-label bottom-left">协调</span>
      <span class="radar-label left">平衡</span>
      <svg viewBox="0 0 320 280">
        <g class="radar-grid">
          <polygon points="160,25 242,85 212,190 108,190 78,85" />
          <polygon points="160,55 216,96 196,170 124,170 104,96" />
          <polygon points="160,82 198,107 185,156 135,156 122,107" />
          <polygon points="160,107 182,120 174,145 146,145 138,120" />
          <line x1="160" y1="25" x2="160" y2="190" />
          <line x1="242" y1="85" x2="108" y2="190" />
          <line x1="212" y1="190" x2="78" y2="85" />
          <line x1="78" y1="85" x2="242" y2="85" />
          <line x1="108" y1="190" x2="212" y2="190" />
        </g>
        <polygon class="radar-area previous-area" :points="previousPoints" />
        <polygon class="radar-area" :points="currentPoints" />
        <g class="radar-points">
          <circle v-for="(dot, index) in currentDots" :key="index" :cx="dot.x" :cy="dot.y" r="4" />
        </g>
      </svg>
    </div>
    <div class="radar-legend">
      <span><i class="legend-line current"></i> 当前水平</span>
      <span><i class="legend-line previous"></i> 上次水平</span>
    </div>
  </article>
</template>
