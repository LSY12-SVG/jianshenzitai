import { createRouter, createWebHistory } from "vue-router";
import { featureRouteMeta } from "@/data/dashboard";

const routes = [
  {
    path: "/",
    component: () => import("@/layouts/AppShell.vue"),
    children: [
      {
        path: "",
        redirect: "/dashboard",
      },
      {
        path: "dashboard",
        name: "dashboard",
        component: () => import("@/views/DashboardView.vue"),
      },
      {
        path: "live-training",
        name: "live-training",
        component: () => import("@/views/LiveTrainingView.vue"),
      },
      {
        path: "movement-analysis",
        name: "movement-analysis",
        component: () => import("@/views/PlaceholderView.vue"),
        meta: featureRouteMeta["movement-analysis"],
      },
      {
        path: "archives",
        name: "archives",
        component: () => import("@/views/PlaceholderView.vue"),
        meta: featureRouteMeta.archives,
      },
      {
        path: "plans",
        name: "plans",
        component: () => import("@/views/PlaceholderView.vue"),
        meta: featureRouteMeta.plans,
      },
      {
        path: "reports",
        name: "reports",
        component: () => import("@/views/PlaceholderView.vue"),
        meta: featureRouteMeta.reports,
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
