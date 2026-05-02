<script setup>
defineProps({
  item: {
    type: Object,
    required: true,
  },
});
</script>

<template>
  <article class="feature-card" :class="item.theme">
    <div>
      <h3>{{ item.title }}</h3>
      <p>{{ item.description[0] }}<br />{{ item.description[1] }}</p>
      <button>→</button>
    </div>

    <div v-if="item.visual === 'watch'" class="watch-visual">
      <div class="watch-strap top"></div>
      <div class="watch-body">
        <div class="watch-screen">♥ 128</div>
      </div>
      <div class="watch-strap bottom"></div>
    </div>

    <div v-else-if="item.visual === 'figure'" class="figure-visual">
      <span class="skeleton head"></span>
      <span class="skeleton torso"></span>
      <span class="skeleton arm left"></span>
      <span class="skeleton arm right"></span>
      <span class="skeleton leg left"></span>
      <span class="skeleton leg right"></span>
    </div>

    <div v-else-if="item.visual === 'folder'" class="folder-visual">
      <div class="folder"></div>
      <div class="lock"></div>
    </div>

    <div v-else-if="item.visual === 'clipboard'" class="clipboard-visual">
      <div class="sheet"></div>
      <div class="clip"></div>
      <div class="check one"></div>
      <div class="check two"></div>
      <div class="check three"></div>
    </div>

    <div v-else class="report-visual">
      <div class="report-card"></div>
      <div class="ring"></div>
    </div>
  </article>
</template>
