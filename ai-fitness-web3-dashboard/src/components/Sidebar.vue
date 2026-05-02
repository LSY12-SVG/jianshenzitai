<script setup>
import { RouterLink, useRoute } from "vue-router";

defineProps({
  items: {
    type: Array,
    required: true,
  },
  archiveCard: {
    type: Object,
    required: true,
  },
  points: {
    type: Object,
    required: true,
  },
});

const route = useRoute();
</script>

<template>
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-mark">
        <svg viewBox="0 0 64 64">
          <defs>
            <linearGradient id="brandGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#24d1b5" />
              <stop offset="100%" stop-color="#43a6ff" />
            </linearGradient>
          </defs>
          <path
            d="M15 47L26.4 18.5c1.5-3.8 6.8-3.8 8.2 0l6 15.4 7.8-17.6c1.4-3.2 6.1-2.2 6.1 1.3V47c0 2.2-1.8 4-4 4s-4-1.8-4-4V28.1l-7.5 16.8c-1.5 3.3-6.2 3.3-7.7-.1L30.6 27 22.6 47c-.8 2.1-3.2 3.2-5.2 2.4-2.1-.9-3.1-3.2-2.4-5.4z"
            fill="url(#brandGradient)"
          />
        </svg>
      </div>
      <div>
        <h1>AI Fitness</h1>
        <p>Web3 系统</p>
      </div>
    </div>

    <nav class="side-nav">
      <RouterLink
        v-for="item in items"
        :key="item.label"
        class="nav-item"
        :class="{ active: route.path === item.to }"
        :to="item.to"
      >
        <svg v-if="item.icon === 'home'" viewBox="0 0 24 24"><path d="M4 11.5L12 5l8 6.5V20H4zM9 20v-5h6v5" /></svg>
        <svg v-else-if="item.icon === 'clock'" viewBox="0 0 24 24"><path d="M12 4a8 8 0 108 8 8 8 0 00-8-8zm-1 4h2v5l4 2-1 1.8-5-2.8z" /></svg>
        <svg v-else-if="item.icon === 'pulse'" viewBox="0 0 24 24"><path d="M4 13h4l2-6 4 12 2-6h4" /></svg>
        <svg v-else-if="item.icon === 'folder'" viewBox="0 0 24 24"><path d="M4 7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2z" /></svg>
        <svg v-else-if="item.icon === 'calendar'" viewBox="0 0 24 24"><path d="M7 3v3M17 3v3M4 9h16M5 6h14a1 1 0 011 1v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7a1 1 0 011-1zM8 13h3M8 17h3M13 13h3M13 17h3" /></svg>
        <svg v-else viewBox="0 0 24 24"><path d="M5 20V10M10 20V4M15 20v-7M20 20v-11" /></svg>
        <span>{{ item.label }}</span>
      </RouterLink>
    </nav>

    <div class="side-illustration">
      <div class="hill hill-back"></div>
      <div class="hill hill-front"></div>
      <div class="tree"></div>
      <div class="runner">
        <span class="head"></span>
        <span class="body"></span>
      </div>
    </div>

    <section class="chain-card">
      <div class="chain-icon">
        <svg viewBox="0 0 24 24"><path d="M10.5 13.5l3-3M8.4 16a4 4 0 010-5.7l2.1-2.1a4 4 0 015.7 0M15.6 8a4 4 0 010 5.7l-2.1 2.1a4 4 0 01-5.7 0" /></svg>
      </div>
      <h3>{{ archiveCard.title }}</h3>
      <p>{{ archiveCard.lines[0] }}<br />{{ archiveCard.lines[1] }}</p>
      <button>{{ archiveCard.actionLabel }} <span>→</span></button>
    </section>

    <section class="points-card">
      <div class="points-text">
        <div class="points-label">
          <span class="badge-circle">
            <svg viewBox="0 0 24 24"><path d="M12 3l2.2 4.6L19 8.3l-3.5 3.4.8 4.8L12 14.2l-4.3 2.3.8-4.8L5 8.3l4.8-.7z" /></svg>
          </span>
          <span>{{ points.label }}</span>
        </div>
        <strong>{{ points.total }} <span>{{ points.unit }}</span></strong>
        <p><em>{{ points.weeklyGain }}</em> {{ points.weeklyLabel }}</p>
      </div>
      <div class="coin">
        <div class="coin-inner">
          <svg viewBox="0 0 24 24"><path d="M12 4l4 4v4c0 2.8-1.7 5.3-4 6.4-2.3-1.1-4-3.6-4-6.4V8zM12 9v4M10 11h4" /></svg>
        </div>
      </div>
    </section>
  </aside>
</template>
