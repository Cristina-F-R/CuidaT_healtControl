<script setup lang="ts">
import { DomainRuleError } from '@cuidat/shared';
import { onMounted, ref } from 'vue';
import { useItemDefinitionStore } from '../../../application/stores/useItemDefinitionStore';
import { FOCUS_RING } from '../../categoryStyles';

// ADR-006: archive is the primary option; permanent delete warns about the logs and needs explicit acceptance.
const props = defineProps<{
  rootId: string;
  isArchived: boolean;
}>();

const emit = defineEmits<{
  (e: 'done'): void;
}>();

const itemStore = useItemDefinitionStore();
const impact = ref<number | null>(null);
const accepted = ref(false);
const errorMessage = ref('');

onMounted(async () => {
  impact.value = await itemStore.getDeleteImpact(props.rootId);
});

async function run(action: () => Promise<void>): Promise<void> {
  errorMessage.value = '';
  try {
    await action();
    emit('done');
  } catch (error) {
    if (error instanceof DomainRuleError) {
      errorMessage.value = error.message;
      return;
    }
    throw error;
  }
}

function archive(): Promise<void> {
  return run(() => itemStore.archiveItemLineage(props.rootId));
}

function restore(): Promise<void> {
  return run(() => itemStore.restoreItemLineage(props.rootId));
}

function deletePermanently(): Promise<void> {
  return run(() => itemStore.deleteItemLineage(props.rootId));
}
</script>

<template>
  <section class="flex flex-col gap-4 pt-4 border-t border-slate-100">
    <div
      v-if="!isArchived"
      class="flex flex-col gap-2"
    >
      <p class="text-xs text-slate">
        Archivar oculta el ítem del panel. Sus registros siguen en el calendario y en los resúmenes.
      </p>
      <button
        type="button"
        class="self-start px-4 py-2 text-sm font-bold text-canvas bg-slate rounded-full transition-colors hover:bg-slate-700"
        :class="FOCUS_RING"
        @click="archive"
      >
        Archivar
      </button>
    </div>
    <div
      v-else
      class="flex flex-col gap-2"
    >
      <p class="text-xs text-slate">
        Este ítem está archivado: su definición es de solo lectura.
      </p>
      <button
        type="button"
        class="self-start px-4 py-2 text-sm font-bold text-canvas bg-slate rounded-full transition-colors hover:bg-slate-700"
        :class="FOCUS_RING"
        @click="restore"
      >
        Restaurar
      </button>
    </div>

    <div class="flex flex-col gap-3 p-3 border border-danger/40 rounded-xl">
      <h3 class="text-sm font-extrabold text-slate-800">
        Eliminar definitivamente
      </h3>
      <p class="text-xs text-slate-800">
        Se borrarán todas las versiones de este ítem y
        <strong>{{ impact === null ? '…' : impact }}</strong>
        {{ impact === 1 ? 'registro' : 'registros' }}. No se puede deshacer.
      </p>
      <label class="flex items-start gap-2 text-xs font-bold text-slate-800">
        <input
          v-model="accepted"
          type="checkbox"
          class="mt-0.5"
        >
        Entiendo que se borrarán los registros asociados.
      </label>
      <p
        v-if="errorMessage"
        role="alert"
        class="text-sm font-bold text-danger-dark"
      >
        {{ errorMessage }}
      </p>
      <button
        type="button"
        :disabled="!accepted"
        class="self-start px-4 py-2 text-sm font-bold rounded-full transition-colors"
        :class="[
          FOCUS_RING,
          accepted ? 'text-canvas bg-danger hover:bg-danger-dark' : 'text-slate-800 bg-slate-300 opacity-50 cursor-not-allowed',
        ]"
        @click="deletePermanently"
      >
        Eliminar definitivamente
      </button>
    </div>
  </section>
</template>
