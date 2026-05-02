<script setup>
defineProps({
  days: {
    type: Array,
    required: true,
  },
});
</script>

<template>
  <article class="panel progress-panel">
    <div class="panel-head">
      <h3>训练进度追踪</h3>
      <div class="panel-head-right">
        <svg viewBox="0 0 24 24"><path d="M7 3v3M17 3v3M4 9h16M5 6h14a1 1 0 011 1v11a2 2 0 01-2 2H6a2 2 0 01-2-2V7a1 1 0 011-1z" /></svg>
        <span>本周</span>
        <svg class="tiny-chevron" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5" /></svg>
      </div>
    </div>
    <div class="week-grid">
      <div v-for="day in days" :key="day.date" class="week-col">
        <span>{{ day.day }}</span>
        <strong>{{ day.date }}</strong>
        <i :class="day.status">{{ day.status === "done" ? "✓" : "" }}</i>
      </div>
    </div>
    <div class="status-legend">
      <span><i class="mini-dot green"></i> 已完成</span>
      <span><i class="mini-dot orange"></i> 部分完成</span>
      <span><i class="mini-dot gray"></i> 未完成</span>
    </div>
  </article>
</template>
