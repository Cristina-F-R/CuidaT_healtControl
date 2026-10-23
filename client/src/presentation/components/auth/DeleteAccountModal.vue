<script setup lang="ts">
import { computed, ref } from 'vue';
import { deletionFailureMessage, useAccount } from '../../../application/composables/useAccount';
import { useOverlays } from '../../../application/composables/useOverlays';
import { useToast } from '../../../application/composables/useToast';
import { sanitizeText } from '../../../application/sanitizeText';
import AppModal from '../feedback/AppModal.vue';
import { FOCUS_RING } from '../../categoryStyles';

const CONFIRMATION_WORD = 'ELIMINAR';

const { closeOverlay } = useOverlays();
const { deleteAccountAndData } = useAccount();
const { showToast } = useToast();

const typed = ref('');
const deleting = ref(false);
const errorMessage = ref('');
const confirmed = computed(() => sanitizeText(typed.value) === CONFIRMATION_WORD);

async function onConfirm(): Promise<void> {
  if (!confirmed.value || deleting.value) {
    return;
  }
  deleting.value = true;
  errorMessage.value = '';
  try {
    await deleteAccountAndData();
    showToast('Tu cuenta y todos tus datos se han eliminado.');
  } catch (error) {
    deleting.value = false;
    errorMessage.value = deletionFailureMessage(error);
  }
}
</script>

<template>
  <AppModal
    title="Eliminar cuenta y datos"
    @close="closeOverlay"
  >
    <div class="flex flex-col gap-2 text-sm text-slate-800">
      <p>
        Se eliminarán de forma definitiva tu cuenta, todos tus calendarios, ítems y registros, también los
        guardados en este navegador. Esta acción no se puede deshacer.
      </p>
      <p>Si quieres conservar una copia, descarga antes tus datos desde el menú de la cuenta.</p>
    </div>
    <form
      novalidate
      class="flex flex-col gap-4"
      @submit.prevent="onConfirm"
    >
      <label class="flex flex-col gap-2 text-sm font-bold text-slate-800">
        Escribe {{ CONFIRMATION_WORD }} para confirmar
        <input
          v-model="typed"
          type="text"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          class="px-2 py-1.5 font-normal text-slate-800 bg-canvas border border-slate-200 rounded-lg"
          :class="FOCUS_RING"
        >
      </label>
      <p
        v-if="errorMessage"
        role="alert"
        class="text-sm font-bold text-danger-dark"
      >
        {{ errorMessage }}
      </p>
      <div class="flex justify-end gap-2">
        <button
          type="button"
          class="px-4 py-2 text-sm font-bold text-slate-800 rounded-full hover:bg-tint"
          :class="FOCUS_RING"
          @click="closeOverlay"
        >
          Cancelar
        </button>
        <button
          type="submit"
          :disabled="!confirmed || deleting"
          class="px-4 py-2 text-sm rounded-full"
          :class="[
            FOCUS_RING,
            confirmed && !deleting
              ? 'bg-danger hover:bg-danger-dark text-canvas font-bold transition-colors'
              : 'opacity-50 cursor-not-allowed bg-slate-300 font-bold text-slate-800',
          ]"
        >
          {{ deleting ? 'Eliminando…' : 'Eliminar definitivamente' }}
        </button>
      </div>
    </form>
  </AppModal>
</template>
