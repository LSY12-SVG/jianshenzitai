import { defineStore } from "pinia";
import { fetchLiveTrainingSession } from "@/services/dashboardApi";

export const useLiveTrainingStore = defineStore("liveTraining", {
  state: () => ({
    sessionData: null,
    loading: false,
    hydrated: false,
    error: "",
  }),
  actions: {
    async ensureLoaded() {
      if (this.hydrated || this.loading) {
        return;
      }

      this.loading = true;
      this.error = "";

      try {
        this.sessionData = await fetchLiveTrainingSession();
        this.hydrated = true;
      } catch (error) {
        this.error = error instanceof Error ? error.message : "实时训练数据加载失败";
      } finally {
        this.loading = false;
      }
    },
  },
});
