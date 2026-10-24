<script setup lang="ts">
import { REPORTS_MAX_PER_USER } from '@cuidat/shared';
import type { ReportSummary } from '@cuidat/shared';
import { storeToRefs } from 'pinia';
import { onMounted, ref } from 'vue';
import { useOverlays } from '../../../application/composables/useOverlays';
import { downloadReportPdf } from '../../../application/composables/useReportDownload';
import { useToast } from '../../../application/composables/useToast';
import { useViewMode } from '../../../application/composables/useViewMode';
import { userMessageOf } from '../../../application/errors';
import { formatPeriod, formatReportDate } from '../../../application/reportFormat';
import { useReportStore } from '../../../application/stores/useReportStore';
import { FOCUS_RING } from '../../categoryStyles';
import AppModal from '../feedback/AppModal.vue';

// «Informes guardados» (TECH_SPEC.md section 9.1): view, download as PDF or delete. Consultation mode
// keeps viewing and downloading but hides deletion (ADR-021).
const { closeOverlay, openOverlay } = useOverlays();
const { showToast } = useToast();
const { consultationMode } = useViewMode();
const reportStore = useReportStore();
const { reports } = storeToRefs(reportStore);

const loading = ref(true);
const loadError = ref('');
const busyId = ref<string | null>(null);
const confirmingId = ref<string | null>(null);

onMounted(async () => {
  try {
    await reportStore.loadReports();
  } catch (error) {
    loadError.value = userMessageOf(error);
  } finally {
    loading.value = false;
  }
});

async function run(report: ReportSummary, action: () => Promise<void>, failure: string): Promise<void> {
  busyId.value = report.id;
  try {
    await action();
  } catch (error) {
    showToast(`${failure} ${userMessageOf(error)}`, { tone: 'warning' });
  } finally {
    busyId.value = null;
  }
}

function onDownload(report: ReportSummary): Promise<void> {
  return run(report, async () => downloadReportPdf(await reportStore.openReport(report.id)), 'No se pudo descargar el informe.');
}

function onDelete(report: ReportSummary): Promise<void> {
  confirmingId.value = null;
  return run(report, async () => {
    await reportStore.removeReport(report.id);
    showToast('Informe eliminado.');
  }, 'No se pudo eliminar el informe.');
}

const ACTION = 'px-3 py-1.5 text-xs font-bold rounded-full transition-colors disabled:opacity-50';
</script>

<template>
  <AppModal
    title="Informes guardados"
    @close="closeOverlay"
  >
    <p
      v-if="loading"
      role="status"
      class="text-sm text-slate"
    >
      Cargando informes…
    </p>
    <p
      v-else-if="loadError"
      role="alert"
      class="text-sm font-bold text-danger-dark"
    >
      {{ loadError }}
    </p>
    <template v-else>
      <p class="text-sm text-slate-800">
        {{ reports.length }} de {{ REPORTS_MAX_PER_USER }} informes. Se crean desde «Ver resúmenes».
      </p>
      <ul
        v-if="reports.length > 0"
        class="flex flex-col gap-2"
      >
        <li
          v-for="report in reports"
          :key="report.id"
          class="flex flex-col gap-2 p-3 bg-canvas border border-slate-100 rounded-xl"
        >
          <div>
            <p class="text-sm font-extrabold text-slate-800">
              {{ report.title }}
            </p>
            <p class="text-xs text-slate">
              {{ report.calendarName }} · {{ formatPeriod(report.periodFrom, report.periodTo) }} · Guardado el {{ formatReportDate(report.createdAt) }}
            </p>
          </div>
          <div
            v-if="confirmingId === report.id"
            role="alert"
            class="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-800"
          >
            ¿Eliminar «{{ report.title }}»? No se puede deshacer.
            <button
              type="button"
              :class="[ACTION, FOCUS_RING, 'text-canvas bg-danger hover:bg-danger-dark']"
              @click="onDelete(report)"
            >
              Sí, eliminar
            </button>
            <button
              type="button"
              :class="[ACTION, FOCUS_RING, 'text-slate-800 hover:bg-tint']"
              @click="confirmingId = null"
            >
              Cancelar
            </button>
          </div>
          <div
            v-else
            class="flex flex-wrap gap-2"
          >
            <button
              type="button"
              :aria-label="`Ver ${report.title}`"
              :class="[ACTION, FOCUS_RING, 'text-canvas bg-slate hover:bg-slate-700']"
              @click="openOverlay({ kind: 'reportView', reportId: report.id })"
            >
              Ver
            </button>
            <button
              type="button"
              :aria-label="`Descargar PDF de ${report.title}`"
              :disabled="busyId === report.id"
              :class="[ACTION, FOCUS_RING, 'text-slate-800 border border-slate hover:bg-tint']"
              @click="onDownload(report)"
            >
              {{ busyId === report.id ? 'Preparando…' : 'Descargar PDF' }}
            </button>
            <button
              v-if="!consultationMode"
              type="button"
              :aria-label="`Eliminar ${report.title}`"
              :disabled="busyId === report.id"
              :class="[ACTION, FOCUS_RING, 'text-danger hover:bg-tint']"
              @click="confirmingId = report.id"
            >
              Eliminar
            </button>
          </div>
        </li>
      </ul>
      <p
        v-else
        class="p-3 text-sm text-slate-800 bg-tint rounded-xl"
      >
        Todavía no has guardado ningún informe.
      </p>
    </template>
  </AppModal>
</template>
