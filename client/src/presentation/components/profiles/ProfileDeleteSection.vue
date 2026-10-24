<script setup lang="ts">
import { ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useProfileStore } from '../../../application/stores/useProfileStore';
import { FOCUS_RING } from '../../categoryStyles';

defineProps<{
  profileName: string;
  busy: boolean;
}>();

const emit = defineEmits<{
  (e: 'confirm'): void;
}>();

// Deleting is irreversible: the first click asks for confirmation (ADR-003: never the last calendar).
const { canDeleteProfile } = storeToRefs(useProfileStore());
const confirming = ref(false);
</script>

<template>
  <section
    aria-labelledby="profile-delete-title"
    class="flex flex-col gap-2 p-3 border border-danger rounded-xl"
  >
    <h3
      id="profile-delete-title"
      class="text-sm font-extrabold text-danger-dark"
    >
      Eliminar calendario
    </h3>
    <p
      v-if="!canDeleteProfile"
      class="text-sm text-slate-800"
    >
      No puedes eliminar tu único calendario. Crea otro antes.
    </p>
    <template v-else-if="!confirming">
      <p class="text-sm text-slate-800">
        Se borrarán también sus ítems y todos sus registros.
      </p>
      <button
        type="button"
        class="self-start px-3 py-1.5 text-sm font-bold text-danger-dark border border-danger rounded-full hover:bg-tint"
        :class="FOCUS_RING"
        @click="confirming = true"
      >
        Eliminar calendario
      </button>
    </template>
    <template v-else>
      <p
        role="alert"
        class="text-sm font-bold text-danger-dark"
      >
        ¿Eliminar «{{ profileName }}» con todos sus datos? No se puede deshacer.
      </p>
      <div class="flex gap-2">
        <button
          type="button"
          :disabled="busy"
          class="px-3 py-1.5 text-sm font-bold text-canvas bg-danger rounded-full hover:bg-danger-dark disabled:opacity-50"
          :class="FOCUS_RING"
          @click="emit('confirm')"
        >
          Sí, eliminar
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-sm font-bold text-slate-800 rounded-full hover:bg-tint"
          :class="FOCUS_RING"
          @click="confirming = false"
        >
          Cancelar
        </button>
      </div>
    </template>
  </section>
</template>
