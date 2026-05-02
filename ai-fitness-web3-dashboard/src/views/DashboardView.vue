<script setup>
import { computed, onMounted } from "vue";
import { storeToRefs } from "pinia";
import DashboardHeader from "@/components/DashboardHeader.vue";
import StatCard from "@/components/StatCard.vue";
import HeartRatePanel from "@/components/HeartRatePanel.vue";
import RadarPanel from "@/components/RadarPanel.vue";
import ProgressPanel from "@/components/ProgressPanel.vue";
import ActivityTable from "@/components/ActivityTable.vue";
import AdvicePanel from "@/components/AdvicePanel.vue";
import FeatureCard from "@/components/FeatureCard.vue";
import { useDashboardStore } from "@/stores/dashboard";

const dashboardStore = useDashboardStore();
const { error, hydrated, loading, overview, trainings } = storeToRefs(dashboardStore);

const header = computed(() => overview.value?.header);
const wallet = computed(() => overview.value?.wallet);
const notifications = computed(() => overview.value?.notifications ?? 0);
const user = computed(() => overview.value?.user);
const stats = computed(() => overview.value?.stats ?? []);
const heartZones = computed(() => overview.value?.heartZones ?? []);
const radar = computed(() => overview.value?.radar);
const weekProgress = computed(() => overview.value?.weekProgress ?? []);
const advice = computed(() => overview.value?.advice);
const features = computed(() => overview.value?.features ?? []);

onMounted(() => {
  dashboardStore.ensureDashboardLoaded();
});
</script>

<template>
  <div v-if="!overview && !error" class="state-card">
    <h3>正在加载训练面板...</h3>
    <p>已接入 Pinia + Mock API，当前正在模拟真实请求。</p>
  </div>

  <div v-else-if="error" class="state-card state-error">
    <h3>训练面板加载失败</h3>
    <p>{{ error }}</p>
    <button class="retry-btn" @click="dashboardStore.ensureDashboardLoaded()">重新加载</button>
  </div>

  <template v-else>
    <DashboardHeader
      :header="header"
      :wallet="wallet"
      :notifications="notifications"
      :user="user"
    />

    <section class="stats-grid">
      <StatCard v-for="card in stats" :key="card.title" :card="card" />
    </section>

    <section class="main-grid">
      <HeartRatePanel :zones="heartZones" />
      <RadarPanel :radar="radar" />
      <ProgressPanel :days="weekProgress" />
      <ActivityTable :items="trainings" />
      <AdvicePanel :advice="advice" />
    </section>

    <section class="feature-grid">
      <FeatureCard v-for="item in features" :key="item.title" :item="item" />
    </section>
  </template>
</template>
