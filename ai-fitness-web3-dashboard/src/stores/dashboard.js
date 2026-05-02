import { defineStore } from "pinia";
import { fetchDashboardOverview, fetchRecentTrainings } from "@/services/dashboardApi";

export const useDashboardStore = defineStore("dashboard", {
  state: () => ({
    overview: null,
    trainings: [],
    loading: false,
    hydrated: false,
    error: "",
  }),
  actions: {
    async ensureDashboardLoaded() {
      if (this.hydrated || this.loading) {
        return;
      }

      this.loading = true;
      this.error = "";

      try {
        const [overview, trainings] = await Promise.all([
          fetchDashboardOverview(),
          fetchRecentTrainings(),
        ]);

        this.overview = overview;
        this.trainings = trainings;
        this.hydrated = true;
      } catch (error) {
        this.error = error instanceof Error ? error.message : "训练面板加载失败";
      } finally {
        this.loading = false;
      }
    },
  },
});
