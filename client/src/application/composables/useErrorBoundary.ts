import { readonly, ref } from 'vue';
import type { Ref } from 'vue';

const criticalError = ref(false);

/** Called by `app.config.errorHandler`: App.vue unmounts the workspace and renders FallbackError.vue. */
export function raiseCriticalError(): void {
  criticalError.value = true;
}

export function useErrorBoundary(): { criticalError: Readonly<Ref<boolean>> } {
  return { criticalError: readonly(criticalError) };
}
