import dayjs from 'dayjs';
import { computed, ref, watch } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import { userMessageOf } from '../errors';
import { useAuthStore } from '../stores/useAuthStore';
import { useEventStore } from '../stores/useEventStore';
import { useItemDefinitionStore } from '../stores/useItemDefinitionStore';
import { useProfileStore } from '../stores/useProfileStore';
import { DAY_KEY_FORMAT } from './useCalendar';
import { collectPatterns, splitByCategory } from './usePatterns';
import type { PatternView } from './usePatterns';
import { useToast } from './useToast';

export interface LineageOption {
  rootId: string;
  label: string;
  archived: boolean;
}

export interface PeriodPreset {
  months: number;
  label: string;
}

export const PERIOD_PRESETS: readonly PeriodPreset[] = [
  { months: 1, label: 'Este mes' },
  { months: 3, label: '3 meses' },
  { months: 6, label: '6 meses' },
  { months: 12, label: '12 meses' },
];

export type LineageGroup = 'symptoms' | 'triggers';

export interface CorrelationFilter {
  from: Ref<string>;
  to: Ref<string>;
  today: string;
  selectedSymptoms: Ref<Set<string>>;
  selectedTriggers: Ref<Set<string>>;
  symptomOptions: ComputedRef<LineageOption[]>;
  triggerOptions: ComputedRef<LineageOption[]>;
  loading: Ref<boolean>;
  /** Guests only see the current month, so the period cannot be changed (ADR-018). */
  periodLocked: ComputedRef<boolean>;
  watchPatterns: ComputedRef<PatternView[]>;
  detectedPatterns: ComputedRef<PatternView[]>;
  applyPreset: (months: number) => void;
  toggle: (group: LineageGroup, rootId: string) => void;
  selectAll: (group: LineageGroup) => void;
}

function startOfMonthsAgo(months: number): string {
  return dayjs().subtract(months - 1, 'month').startOf('month').format(DAY_KEY_FORMAT);
}

/**
 * State of the correlation filter (TECH_SPEC.md use case 3): a period, the symptoms and the
 * triggers/medication to cross, recalculated as the user changes them. A period older than the
 * loaded months fetches the missing range first.
 */
export function useCorrelationFilter(): CorrelationFilter {
  const itemStore = useItemDefinitionStore();
  const eventStore = useEventStore();
  const profileStore = useProfileStore();
  const authStore = useAuthStore();
  const { showToast } = useToast();

  const today = dayjs().format(DAY_KEY_FORMAT);
  const from = ref(startOfMonthsAgo(authStore.isGuest ? 1 : 3));
  const to = ref(today);
  const loading = ref(false);

  /** One option per lineage, through its live version (archived ones stay in the analytics). */
  function optionsOf(symptoms: boolean): LineageOption[] {
    return itemStore.items
      .filter((item) => item.status !== 'superseded' && (item.category === 'symptom') === symptoms)
      .map((item) => ({ rootId: item.rootId, label: `${item.emoji} ${item.name}`, archived: item.status === 'archived' }));
  }
  const symptomOptions = computed(() => optionsOf(true));
  const triggerOptions = computed(() => optionsOf(false));

  const selectedSymptoms = ref(new Set(symptomOptions.value.map((option) => option.rootId)));
  const selectedTriggers = ref(new Set(triggerOptions.value.map((option) => option.rootId)));

  const patterns = computed(() =>
    collectPatterns({
      from: dayjs(from.value).startOf('day').valueOf(),
      to: Math.min(dayjs(to.value).endOf('day').valueOf(), Date.now()),
      windowHours: profileStore.activeProfile.correlationWindowHours,
      symptomRoots: selectedSymptoms.value,
      triggerRoots: selectedTriggers.value,
    }),
  );
  const split = computed(() => splitByCategory(patterns.value));

  // A period older than the loaded months asks the server for the range that is missing.
  watch(from, async (value) => {
    if (!dayjs(value).isValid()) {
      return;
    }
    loading.value = true;
    try {
      await eventStore.ensureMonthLoaded(profileStore.activeProfileId, dayjs(value).format('YYYY-MM'));
    } catch (error) {
      showToast(`No se pudieron cargar los registros de ese periodo. ${userMessageOf(error)}`, { tone: 'warning' });
    } finally {
      loading.value = false;
    }
  }, { immediate: true });

  function applyPreset(months: number): void {
    from.value = startOfMonthsAgo(months);
    to.value = today;
  }

  function toggle(group: LineageGroup, rootId: string): void {
    const selection = group === 'symptoms' ? selectedSymptoms : selectedTriggers;
    const next = new Set(selection.value);
    if (!next.delete(rootId)) {
      next.add(rootId);
    }
    selection.value = next;
  }

  function selectAll(group: LineageGroup): void {
    const symptoms = group === 'symptoms';
    const options = symptoms ? symptomOptions.value : triggerOptions.value;
    (symptoms ? selectedSymptoms : selectedTriggers).value = new Set(options.map((option) => option.rootId));
  }

  return {
    from,
    to,
    today,
    selectedSymptoms,
    selectedTriggers,
    symptomOptions,
    triggerOptions,
    loading,
    periodLocked: computed(() => authStore.isGuest),
    watchPatterns: computed(() => split.value.watch),
    detectedPatterns: computed(() => split.value.detected),
    applyPreset,
    toggle,
    selectAll,
  };
}
