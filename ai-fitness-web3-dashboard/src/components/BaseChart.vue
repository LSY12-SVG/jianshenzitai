<script setup>
import { use } from "echarts/core";
import VChart from "vue-echarts";
import { BarChart, LineChart, PieChart, RadarChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  RadarComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

use([
  BarChart,
  LineChart,
  PieChart,
  RadarChart,
  GridComponent,
  LegendComponent,
  RadarComponent,
  TooltipComponent,
  CanvasRenderer,
]);

defineProps({
  option: {
    type: Object,
    required: true,
  },
  className: {
    type: String,
    default: "",
  },
});
</script>

<template>
  <VChart :option="option" :autoresize="true" :class="className" />
</template>
