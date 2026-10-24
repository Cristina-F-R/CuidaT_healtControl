<script setup lang="ts">
import { REPORT_TITLE_MAX_LENGTH, REPORTS_MAX_PER_USER } from '@cuidat/shared';
import { storeToRefs } from 'pinia';
import { computed, onMounted, ref } from 'vue';
import { useGuestLimits } from '../../../application/composables/useGuestLimits';
import { useOverlays } from '../../../application/composables/useOverlays';
import { useToast } from '../../../application/composables/useToast';
import { userMessageOf } from '../../../application/errors';
import { useProfileStore } from '../../../application/stores/useProfileStore';
import { useReportStore } from '../../../application/stores/useReportStore';
import { useSyncStore } from '../../../application/stores/useSyncStore';
import { FOCUS_RING } from '../../categoryStyles';

// «Guardar informe» in «Ver resúmenes» (TECH_SPEC.md section 9.1): the server builds the report from
// this selection. Registered users only, and with connection.
const props = defineProps<{
  from: string;
  to: string;
  symptomRootIds: ReadonlySet<string>;
  triggerRootIds: ReadonlySet<string>;
}>();

const { isGuest, showLockedNotice } = useGuestLimits();
const { openOverlay } = useOverlays();
const { showToast } = useToast();
const reportStore = useReportStore();
const { reports, isFull } = storeToRefs(reportStore);
const { activeProfile } = storeToRefs(useProfileStore());
const { online } = storeToRefs(useSyncStore());

const title = ref('');
const saving = ref(false);
const error = ref('');
const nothingSelected = computed(() => props.symptomRootIds.size + props.triggerRootIds.size === 0);
// The report holds only what is checked above (TECH_SPEC.md section 9.1): say so, with the counts.
const scope = computed(() => {
  const symptoms = props.symptomRootIds.size;
  const triggers = props.triggerRootIds.size;
  return `Incluirá ${symptoms} ${symptoms === 1 ? 'síntoma' : 'síntomas'} y ${triggers} ${triggers === 1 ? 'trigger o medicación' : 'triggers o medicaciones'}: lo que desmarques arriba no aparecerá en el informe.`;
});
const hint = computed(() => {
  if (!online.value) {
    return 'Necesitas conexión para guardar informes.';
  }
  if (isFull.value) {
    return `Ya tienes ${REPORTS_MAX_PER_USER} informes guardados. Elimina uno en «Informes guardados» para guardar otro.`;
  }
  return nothingSelected.value ? 'Elige al menos un síntoma o un trigger.' : '';
});

onMounted(() => {
  if (!isGuest.value) {
    reportStore.ensureLoaded().catch(() => undefined);
  }
});

async function onSave(): Promise<void> {
  if (isGuest.value) {
    showLockedNotice();
    return;
  }
  saving.value = true;
  error.value = '';
  try {
    const report = await reportStore.createReport({
      calendarId: activeProfile.value.id,
      from: props.from,
      to: props.to,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      symptomRootIds: [...props.symptomRootIds],
      triggerRootIds: [...props.triggerRootIds],
      title: title.value,
    });
    title.value = '';
    showToast('Informe guardado en «Informes guardados».', {
      action: { label: 'Ver', run: () => openOverlay({ kind: 'reportView', reportId: report.id }) },
    });
  } catch (failure) {
    error.value = userMessageOf(failure);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <section
    aria-labelledby="save-report-title"
    class="flex flex-col gap-2 p-3 bg-tint rounded-xl"
  >
    <h3
      id="save-report-title"
      class="text-sm font-extrabold text-slate-800"
    >
      Guardar como informe
    </h3>
    <p class="text-xs text-slate-800">
      Guarda este periodo y esta selección para consultarlos o descargarlos en PDF cuando quieras.
      <span v-if="!isGuest">({{ reports.length }} de {{ REPORTS_MAX_PER_USER }})</span>
    </p>
    <p
      v-if="!nothingSelected"
      class="text-xs font-bold text-slate-800"
    >
      {{ scope }}
    </p>
    <form
      class="flex flex-wrap items-end gap-2"
      novalidate
      @submit.prevent="onSave"
    >
      <label
        v-if="!isGuest"
        class="flex min-w-0 flex-1 flex-col gap-1 text-xs font-bold text-slate-800"
      >
        Título (opcional)
        <input
          v-model="title"
          type="text"
          :maxlength="REPORT_TITLE_MAX_LENGTH"
          :placeholder="`Informe de ${activeProfile.name}`"
          class="px-2 py-1.5 text-sm font-normal text-slate-800 bg-canvas border border-slate-200 rounded-lg"
          :class="FOCUS_RING"
        >
      </label>
      <button
        type="submit"
        :disabled="!isGuest && (saving || hint !== '')"
        class="px-4 py-2 text-sm font-bold text-canvas bg-slate rounded-full transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        :class="FOCUS_RING"
      >
        {{ saving ? 'Guardando…' : 'Guardar informe' }}
      </button>
    </form>
    <p
      v-if="!isGuest && hint"
      class="text-xs text-slate-800"
    >
      {{ hint }}
    </p>
    <p
      v-if="error"
      role="alert"
      class="text-xs font-bold text-danger-dark"
    >
      {{ error }}
    </p>
  </section>
</template>
