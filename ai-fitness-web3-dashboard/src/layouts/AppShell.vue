<script setup>
import { computed, onMounted } from "vue";
import { RouterView } from "vue-router";
import { storeToRefs } from "pinia";
import Sidebar from "@/components/Sidebar.vue";
import {
  defaultArchiveCard,
  defaultPoints,
  navigationItems,
} from "@/data/dashboard";
import { useDashboardStore } from "@/stores/dashboard";

const dashboardStore = useDashboardStore();
const { overview } = storeToRefs(dashboardStore);

const archiveCard = computed(() => overview.value?.archiveCard ?? defaultArchiveCard);
const points = computed(() => overview.value?.points ?? defaultPoints);

onMounted(() => {
  dashboardStore.ensureDashboardLoaded();
});
</script>

<template>
  <main class="window">
    <div class="app-shell">
      <Sidebar :items="navigationItems" :archive-card="archiveCard" :points="points" />

      <section class="content">
        <RouterView />
      </section>
    </div>
  </main>
</template>
