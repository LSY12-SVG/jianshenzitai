import http from "./http";

export async function fetchDashboardOverview() {
  const { data } = await http.get("/dashboard/overview");
  return data;
}

export async function fetchRecentTrainings() {
  const { data } = await http.get("/dashboard/trainings");
  return data.items;
}

export async function fetchLiveTrainingSession() {
  const { data } = await http.get("/live-training/session");
  return data;
}
