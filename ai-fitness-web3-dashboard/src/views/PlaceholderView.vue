<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();

const title = computed(() => route.meta.title ?? "功能页");
const description = computed(
  () => route.meta.description ?? "这个页面现在作为业务扩展占位，方便继续挂接口和真实模块。"
);
const highlights = computed(() => route.meta.highlights ?? []);
</script>

<template>
  <section class="placeholder-page">
    <div class="placeholder-hero panel">
      <div>
        <p class="placeholder-eyebrow">模块占位</p>
        <h2>{{ title }}</h2>
        <p class="placeholder-copy">{{ description }}</p>
      </div>
      <div class="placeholder-chip">Router 已接入</div>
    </div>

    <div class="placeholder-grid">
      <article v-for="item in highlights" :key="item" class="panel placeholder-card">
        <h3>{{ item }}</h3>
        <p>这个模块目前已具备路由承载位，可以继续接 store、api 和具体业务组件。</p>
      </article>
    </div>
  </section>
</template>
