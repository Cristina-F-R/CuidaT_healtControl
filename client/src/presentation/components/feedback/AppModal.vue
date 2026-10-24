<script setup lang="ts">
import { X } from '@lucide/vue';
import { onBeforeUnmount, onMounted, ref, useId } from 'vue';
import { FOCUS_RING } from '../../categoryStyles';

defineProps<{
  title: string;
  /** Wider dialog for long documents (saved reports). */
  wide?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

const dialogRef = ref<HTMLElement | null>(null);
const titleId = useId();
// ADR-015: focus returns to the element that opened the modal.
let trigger: HTMLElement | null = null;

function focusableElements(): HTMLElement[] {
  return Array.from(dialogRef.value?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
}

// Esc works wherever the focus is, including after a click outside the dialog.
function onEscape(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    emit('close');
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Tab') {
    return;
  }
  // Focus trap: Tab and Shift+Tab wrap around the dialog.
  const elements = focusableElements();
  const first = elements[0];
  const last = elements[elements.length - 1];
  if (!first || !last) {
    return;
  }
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

onMounted(() => {
  trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  focusableElements()[0]?.focus();
  document.addEventListener('keydown', onEscape);
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onEscape);
  trigger?.focus();
});
</script>

<template>
  <div class="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/40 sm:items-center sm:p-4">
    <div
      ref="dialogRef"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      class="flex max-h-[92vh] w-full flex-col gap-4 overflow-y-auto p-5 bg-canvas rounded-t-2xl shadow-xl sm:rounded-2xl"
      :class="wide ? 'max-w-3xl' : 'max-w-lg'"
      @keydown="onKeydown"
    >
      <header class="flex items-start justify-between gap-3">
        <h2
          :id="titleId"
          class="text-lg font-extrabold text-slate-800"
        >
          {{ title }}
        </h2>
        <button
          type="button"
          aria-label="Cerrar"
          class="grid h-8 w-8 shrink-0 place-items-center text-slate-800 rounded-full hover:bg-tint"
          :class="FOCUS_RING"
          @click="emit('close')"
        >
          <X
            :size="18"
            aria-hidden="true"
          />
        </button>
      </header>
      <slot />
    </div>
  </div>
</template>
