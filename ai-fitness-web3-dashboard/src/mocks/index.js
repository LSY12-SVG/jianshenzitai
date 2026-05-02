import AxiosMockAdapter from "axios-mock-adapter";
import http from "@/services/http";
import {
  dashboardOverviewMock,
  dashboardTrainingsMock,
  liveTrainingSessionMock,
} from "@/data/dashboard";

let mock;

export async function setupMocks() {
  if (import.meta.env.PROD || mock) {
    return;
  }

  mock = new AxiosMockAdapter(http, {
    delayResponse: 650,
  });

  mock.onGet("/dashboard/overview").reply(200, dashboardOverviewMock);
  mock.onGet("/dashboard/trainings").reply(200, {
    items: dashboardTrainingsMock,
  });
  mock.onGet("/live-training/session").reply(200, liveTrainingSessionMock);
}
