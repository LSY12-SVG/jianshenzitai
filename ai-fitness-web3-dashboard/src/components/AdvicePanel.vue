<script setup>
defineProps({
  advice: {
    type: Object,
    default: () => ({
      title: "AI 每日建议",
      summary: "根据你最近的训练表现，整体状态良好，轻度疲劳。",
      recommendation:
        "建议今天进行 中等强度的心肺训练 + 核心力量 组合，有助于提升耐力并增强核心稳定性。",
      tags: [
        { label: "推荐强度", value: "中等" },
        { label: "推荐时长", value: "45-60 分钟" },
      ],
    }),
  },
});
</script>

<template>
  <article class="panel advice-panel">
    <div class="panel-head">
      <h3><span class="spark-star">✦</span> {{ advice.title }}</h3>
    </div>
    <div class="advice-layout">
      <div class="advice-copy">
        <p>{{ advice.summary }}</p>
        <p>{{ advice.recommendation }}</p>
        <div class="advice-tags">
          <span v-for="tag in advice.tags" :key="tag.label">{{ tag.label }} <strong>{{ tag.value }}</strong></span>
        </div>
      </div>
      <div class="robot">
        <div class="halo"></div>
        <div class="robot-head">
          <span class="antenna"></span>
          <span class="face">
            <i></i>
            <i></i>
          </span>
        </div>
        <div class="robot-body"></div>
      </div>
    </div>
  </article>
</template>
