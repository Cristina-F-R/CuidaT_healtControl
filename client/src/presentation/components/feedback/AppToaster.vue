<script setup lang="ts">
import { X } from '@lucide/vue';
import { useToast } from '../../../application/composables/useToast';
import { FOCUS_RING } from '../../categoryStyles';

const { toasts, dismissToast } = useToast();

function runAction(id: number, run: () => void): void {
  run();
  dismissToast(id);
}
</script>

<template>
  <div
    role="status"
    aria-live="polite"
    class="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 lg:items-end lg:px-6"
  >
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="pointer-events-auto flex w-full max-w-md items-start gap-3 px-4 py-3 text-sm font-semibold text-slate-800 rounded-xl border shadow-lg"
      :class="toast.tone === 'warning' ? 'bg-peach border-peach' : 'bg-canvas border-slate-200'"
    >
      <p class="flex-1">
        {{ toast.message }}
      </p>
      <button
        v-if="toast.action"
        type="button"
        class="font-extrabold underline rounded"
        :class="FOCUS_RING"
        @click="runAction(toast.id, toast.action.run)"
      >
        {{ toast.action.label }}
      </button>
      <button
        type="button"
        aria-label="Cerrar aviso"
        class="p-0.5 rounded"
        :class="FOCUS_RING"
        @click="dismissToast(toast.id)"
      >
        <X
          :size="16"
          aria-hidden="true"
        />
      </button>
    </div>
  </div>
</template>
