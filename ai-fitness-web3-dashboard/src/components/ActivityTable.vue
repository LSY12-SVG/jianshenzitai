<script setup>
defineProps({
  items: {
    type: Array,
    required: true,
  },
});
</script>

<template>
  <article class="panel activity-panel">
    <div class="panel-head">
      <h3>最近训练动态</h3>
      <a href="#">查看全部 <span>→</span></a>
    </div>
    <div class="training-table">
      <div class="table-head">
        <span>训练项目</span>
        <span>日期</span>
        <span>时长</span>
        <span>得分</span>
      </div>
      <div v-for="item in items" :key="item.title" class="row">
        <div class="title-cell">
          <span class="item-icon" :class="item.theme">
            <svg v-if="item.icon === 'hiit'" viewBox="0 0 24 24"><path d="M7 17c2.5 0 4.7-2 6-6l1 2h3" /></svg>
            <svg v-else-if="item.icon === 'strength'" viewBox="0 0 24 24"><path d="M4 12h16M8 8v8M16 8v8" /></svg>
            <svg v-else viewBox="0 0 24 24"><path d="M12 4l7 14H5zM12 10v3M12 16h.01" /></svg>
          </span>
          <div>
            <strong>{{ item.title }}</strong>
          </div>
          <b class="chain-tag">已上链</b>
        </div>
        <span>{{ item.date }}</span>
        <span>{{ item.duration }}</span>
        <span>{{ item.score }}</span>
        <button class="more-btn">⋮</button>
      </div>
    </div>
  </article>
</template>
