<script setup lang="ts">
import dayjs from 'dayjs';
import { PERIOD_PRESETS, useCorrelationFilter } from '../../../application/composables/useCorrelationFilter';
import { useOverlays } from '../../../application/composables/useOverlays';
import { GUEST_LOCKED_WARNING, PATTERN_DETECTED_MIN_OCCURRENCES, PATTERN_WATCH_MIN_OCCURRENCES } from '@cuidat/shared';
import { FOCUS_RING } from '../../categoryStyles';
import AppModal from '../feedback/AppModal.vue';
import LineageCheckboxGroup from './LineageCheckboxGroup.vue';
import PatternSection from './PatternSection.vue';

// «Ver resúmenes» (TECH_SPEC.md use case 3): correlations of a chosen period, filtered by symptoms and
// triggers, recalculated as the controls change.
const { closeOverlay, openOverlay } = useOverlays();
const filter = useCorrelationFilter();
const { from, to, today, selectedSymptoms, selectedTriggers, loading, periodLocked } = filter;

const WATCH_THRESHOLD = `Entre ${PATTERN_WATCH_MIN_OCCURRENCES} y ${PATTERN_DETECTED_MIN_OCCURRENCES - 1} coincidencias`;
const DETECTED_THRESHOLD = `${PATTERN_DETECTED_MIN_OCCURRENCES} o más coincidencias`;
const DATE_INPUT = 'px-2 py-1.5 font-normal text-slate-800 bg-canvas border border-slate-200 rounded-lg';
</script>

<template>
  <AppModal
    title="Resúmenes y correlaciones"
    @close="closeOverlay"
  >
    <section
      aria-labelledby="filter-period"
      class="flex flex-col gap-2"
    >
      <h3
        id="filter-period"
        class="text-sm font-extrabold text-slate-800"
      >
        Periodo
      </h3>
      <div
        v-if="periodLocked"
        class="flex flex-col items-start gap-2 text-sm text-slate-800"
      >
        <p>Este mes ({{ dayjs(from).format('MMMM YYYY') }}). {{ GUEST_LOCKED_WARNING }}</p>
        <button
          type="button"
          class="px-3 py-1.5 text-xs font-bold text-canvas bg-slate rounded-full hover:bg-slate-700"
          :class="FOCUS_RING"
          @click="openOverlay({ kind: 'auth', mode: 'register' })"
        >
          Crear cuenta
        </button>
      </div>
      <template v-else>
        <div
          role="group"
          aria-label="Periodos rápidos"
          class="flex flex-wrap gap-1"
        >
          <button
            v-for="preset in PERIOD_PRESETS"
            :key="preset.months"
            type="button"
            class="px-3 py-1 text-xs font-bold text-slate-800 bg-tint rounded-full hover:bg-slate-100"
            :class="FOCUS_RING"
            @click="filter.applyPreset(preset.months)"
          >
            {{ preset.label }}
          </button>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <label class="flex flex-col gap-1 text-sm font-bold text-slate-800">
            Desde
            <input
              v-model="from"
              type="date"
              :max="to"
              :class="[DATE_INPUT, FOCUS_RING]"
            >
          </label>
          <label class="flex flex-col gap-1 text-sm font-bold text-slate-800">
            Hasta
            <input
              v-model="to"
              type="date"
              :min="from"
              :max="today"
              :class="[DATE_INPUT, FOCUS_RING]"
            >
          </label>
        </div>
      </template>
      <p
        v-if="loading"
        role="status"
        class="text-xs text-slate-600"
      >
        Cargando registros del periodo…
      </p>
    </section>

    <div class="grid gap-4 sm:grid-cols-2">
      <LineageCheckboxGroup
        legend="Síntomas"
        :options="filter.symptomOptions.value"
        :selected="selectedSymptoms"
        @toggle="filter.toggle('symptoms', $event)"
        @select-all="filter.selectAll('symptoms')"
      />
      <LineageCheckboxGroup
        legend="Triggers / Medicación"
        :options="filter.triggerOptions.value"
        :selected="selectedTriggers"
        @toggle="filter.toggle('triggers', $event)"
        @select-all="filter.selectAll('triggers')"
      />
    </div>

    <div
      aria-live="polite"
      class="flex flex-col gap-3"
    >
      <PatternSection
        heading-id="filter-watch"
        title="Vigilar posible patrón"
        :threshold="WATCH_THRESHOLD"
        empty-text="No hay coincidencias suficientes con este filtro."
        surface="bg-tint"
        :patterns="filter.watchPatterns.value"
      />
      <PatternSection
        heading-id="filter-detected"
        title="Patrón detectado"
        :threshold="DETECTED_THRESHOLD"
        empty-text="Ningún patrón detectado con este filtro."
        surface="bg-mint/40"
        :patterns="filter.detectedPatterns.value"
      />
    </div>
  </AppModal>
</template>
