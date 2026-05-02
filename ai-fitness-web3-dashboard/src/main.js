import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import { setupMocks } from "./mocks";
import "./styles.css";

async function bootstrap() {
  await setupMocks();

  const app = createApp(App);
  app.use(createPinia());
  app.use(router);
  app.mount("#app");
}

bootstrap();
