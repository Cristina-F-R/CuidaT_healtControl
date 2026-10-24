<script setup lang="ts">
import type { SavedReport } from '@cuidat/shared';
import dayjs from 'dayjs';
import { onMounted, ref } from 'vue';
import { useOverlays } from '../../../application/composables/useOverlays';
import { downloadReportPdf } from '../../../application/composables/useReportDownload';
import { userMessageOf } from '../../../application/errors';
import { formatPeriod } from '../../../application/reportFormat';
import { useReportStore } from '../../../application/stores/useReportStore';
import { FOCUS_RING, PROFILE_THEME } from '../../categoryStyles';
import PatternLegend from '../calendar/PatternLegend.vue';
import AppModal from '../feedback/AppModal.vue';
import ReportDayList from './ReportDayList.vue';
import ReportItemLegend from './ReportItemLegend.vue';
import ReportMiniMonth from './ReportMiniMonth.vue';
import ReportPatternList from './ReportPatternList.vue';
import ReportStatsList from './ReportStatsList.vue';

// A saved report on screen (TECH_SPEC.md section 9.1): the same content and order as its PDF, drawn
// only from the stored snapshot, so it looks the same however the data changed afterwards.
const props = defineProps<{
  reportId: string;
}>();

const { closeOverlay } = useOverlays();
const reportStore = useReportStore();
const report = ref<SavedReport | null>(null);
const error = ref('');
const downloading = ref(false);

onMounted(async () => {
  try {
    report.value = await reportStore.openReport(props.reportId);
  } catch (failure) {
    error.value = userMessageOf(failure);
  }
});

async function onDownload(): Promise<void> {
  if (!report.value) {
    return;
  }
  downloading.value = true;
  error.value = '';
  try {
    await downloadReportPdf(report.value);
  } catch (failure) {
    error.value = `No se pudo descargar el informe. ${userMessageOf(failure)}`;
  } finally {
    downloading.value = false;
  }
}
</script>

<template>
  <AppModal
    :title="report?.title ?? 'Informe'"
    wide
    @close="closeOverlay"
  >
    <p
      v-if="error"
      role="alert"
      class="text-sm font-bold text-danger-dark"
    >
      {{ error }}
    </p>
    <p
      v-if="!report && !error"
      role="status"
      class="text-sm text-slate"
    >
      Cargando informe…
    </p>
    <article
      v-if="report"
      class="flex flex-col gap-6"
    >
      <header
        class="flex flex-wrap items-start justify-between gap-3 pt-3 border-t-4"
        :class="PROFILE_THEME[report.snapshot.calendar.colorTheme].band"
      >
        <div class="flex flex-col gap-1 text-sm text-slate-800">
          <p class="flex items-center gap-2 text-base font-extrabold">
            <span
              aria-hidden="true"
              class="grid h-8 w-8 place-items-center rounded-full"
              :class="PROFILE_THEME[report.snapshot.calendar.colorTheme].surface"
            >{{ report.snapshot.calendar.avatarIcon }}</span>
            {{ report.snapshot.calendar.name }} · {{ report.snapshot.calendar.profileType }}
          </p>
          <p>{{ formatPeriod(report.snapshot.period.from, report.snapshot.period.to) }}</p>
          <p>Ventana de correlación: {{ report.snapshot.calendar.correlationWindowHours }} horas</p>
          <p class="text-xs text-slate">
            Generado el {{ dayjs(report.snapshot.generatedAt).format('D [de] MMMM [de] YYYY [a las] HH:mm') }}
          </p>
        </div>
        <button
          type="button"
          :disabled="downloading"
          class="px-4 py-2 text-sm font-bold text-canvas bg-slate rounded-full transition-colors hover:bg-slate-700 disabled:opacity-50"
          :class="FOCUS_RING"
          @click="onDownload"
        >
          {{ downloading ? 'Preparando…' : 'Descargar PDF' }}
        </button>
      </header>
      <ReportPatternList :snapshot="report.snapshot" />
      <ReportStatsList :snapshot="report.snapshot" />
      <section
        aria-labelledby="report-calendars"
        class="flex flex-col gap-3"
      >
        <h3
          id="report-calendars"
          class="text-base font-extrabold text-slate-800"
        >
          Calendarios
        </h3>
        <PatternLegend />
        <ReportItemLegend :items="report.snapshot.items" />
        <div class="grid gap-4 sm:grid-cols-2">
          <ReportMiniMonth
            v-for="monthKey in report.snapshot.months"
            :key="monthKey"
            :snapshot="report.snapshot"
            :month-key="monthKey"
          />
        </div>
      </section>
      <ReportDayList :snapshot="report.snapshot" />
      <p class="text-xs text-slate">
        Una coincidencia no confirma una causa. Puede ser útil comentarla con un profesional.
      </p>
    </article>
  </AppModal>
</template>
