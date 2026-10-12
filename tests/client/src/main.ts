import '@fontsource-variable/nunito-sans';
import './style.css';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import { raiseCriticalError } from './application/composables/useErrorBoundary';
import { initSentry, reportError } from './infrastructure/sentry';

dayjs.locale('es');

const app = createApp(App);
app.use(createPinia());

// Global error boundary (ADR-009): report, then swap the workspace for FallbackError.vue.
app.config.errorHandler = (error: unknown): void => {
  if (import.meta.env.DEV) {
    console.error(error);
  }
  reportError(error);
  raiseCriticalError();
};

initSentry(app);
app.mount('#app');
