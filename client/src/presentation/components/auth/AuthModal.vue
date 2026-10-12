<script setup lang="ts">
import { useOverlays } from '../../../application/composables/useOverlays';
import AppModal from '../feedback/AppModal.vue';
import { FOCUS_RING } from '../../categoryStyles';

// Placeholder until the account flow (Phase 3). Guest limits already open it through «Crear cuenta».
const { closeOverlay } = useOverlays();
</script>

<template>
  <AppModal
    title="Crear cuenta"
    @close="closeOverlay"
  >
    <p class="text-sm text-slate-800">
      El registro con cuenta llega en la Fase 3. Mientras tanto, tus datos se quedan guardados en este navegador.
    </p>
    <div class="flex justify-end">
      <button
        type="button"
        class="px-4 py-2 text-sm font-bold text-canvas bg-slate rounded-full hover:bg-slate-700"
        :class="FOCUS_RING"
        @click="closeOverlay"
      >
        Entendido
      </button>
    </div>
  </AppModal>
</template>
