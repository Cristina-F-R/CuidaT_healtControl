<script setup lang="ts">
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useProfileStore } from '../../../application/stores/useProfileStore';
import { useReportStore } from '../../../application/stores/useReportStore';
import { FOCUS_RING } from '../../categoryStyles';

const props = defineProps<{
  profileId: string;
  profileName: string;
  busy: boolean;
}>();

const emit = defineEmits<{
  (e: 'confirm'): void;
}>();

// Deleting is irreversible: the first click asks for confirmation (ADR-003: never the last calendar).
const { canDeleteProfile } = storeToRefs(useProfileStore());
const reportStore = useReportStore();
const confirming = ref(false);

// Saved reports go with their calendar (cascade), so the confirmation says so (TECH_SPEC.md section 9.1).
const confirmation = computed(() => {
  const reports = reportStore.countFor(props.profileId);
  const question = `¿Seguro que quieres eliminar «${props.profileName}»?`;
  const end = 'Esta acción no se puede deshacer.';
  if (reports === 0) {
    return `${question} También se borrarán sus ítems y todos sus registros. ${end}`;
  }
  const saved = reports === 1 ? 'el informe guardado' : `los ${reports} informes guardados`;
  const keep = reports === 1 ? 'conservarlo, descárgalo' : 'conservarlos, descárgalos';
  return `${question} También se borrarán sus ítems, todos sus registros y ${saved} de este calendario. Si quieres ${keep} en PDF antes de continuar. ${end}`;
});

async function startConfirmation(): Promise<void> {
  // The count needs the list of reports; without it (offline) the generic message stays.
  await reportStore.ensureLoaded().catch(() => undefined);
  confirming.value = true;
}
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
        @click="startConfirmation"
      >
        Eliminar calendario
      </button>
    </template>
    <template v-else>
      <p
        role="alert"
        class="text-sm font-bold text-danger-dark"
      >
        {{ confirmation }}
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
