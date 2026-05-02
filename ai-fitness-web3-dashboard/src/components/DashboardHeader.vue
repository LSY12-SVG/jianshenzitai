<script setup>
defineProps({
  header: {
    type: Object,
    default: () => ({
      title: "训练总览",
      subtitle: "欢迎回来，保持热爱，持续进步！",
    }),
  },
  wallet: {
    type: Object,
    default: () => ({
      address: "0xA3...9F2B",
      status: "已连接",
    }),
  },
  notifications: {
    type: Number,
    default: 0,
  },
  user: {
    type: Object,
    default: () => ({
      name: "Aileen",
    }),
  },
});
</script>

<template>
  <div class="top-row">
    <div class="hero-copy">
      <h2>{{ header.title }}</h2>
      <p>{{ header.subtitle }} <span>🌿</span></p>
    </div>

    <div class="search-wrap">
      <svg viewBox="0 0 24 24"><path d="M11 5a6 6 0 110 12 6 6 0 010-12zm8 14l-3.4-3.4" /></svg>
      <input type="text" placeholder="搜索训练、动作、计划..." />
      <kbd>⌘K</kbd>
    </div>

    <div class="top-actions">
      <button class="wallet-pill">
        <span class="wallet-icon">
          <svg viewBox="0 0 24 24"><path d="M4 7h14a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2zM4 7V6a2 2 0 012-2h9M16 13h4" /></svg>
        </span>
        <span class="wallet-text">
          {{ wallet.address }} <em>{{ wallet.status }}</em>
        </span>
        <span class="dot"></span>
      </button>

      <button class="notify-btn" aria-label="通知">
        <svg viewBox="0 0 24 24"><path d="M6 10a6 6 0 0112 0v4l1.5 2.5H4.5L6 14zm4.5 8a1.5 1.5 0 003 0" /></svg>
        <span class="notify-count">{{ notifications }}</span>
      </button>

      <div class="avatar" :title="user.name"></div>
      <button class="chevron-btn" aria-label="展开">
        <svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5" /></svg>
      </button>
    </div>
  </div>
</template>
