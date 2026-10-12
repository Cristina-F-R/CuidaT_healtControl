<script setup lang="ts">
import type { ItemCategory } from '@cuidat/shared';
import { useId } from 'vue';
import { useItemForm } from '../../../application/composables/useItemForm';
import { FOCUS_RING } from '../../categoryStyles';
import EmojiPicker from './EmojiPicker.vue';

const props = defineProps<{
  /** `null` creates a new item; otherwise the lineage is edited (category locked). */
  rootId: string | null;
}>();

const emit = defineEmits<{
  (e: 'done'): void;
  (e: 'cancel'): void;
}>();

const { isEdit, name, emoji, category, trackIntensity, trackDuration, errorMessage, save } = useItemForm(props.rootId);
const categoryGroupId = useId();

const CATEGORY_OPTIONS: ReadonlyArray<{ value: ItemCategory; label: string }> = [
  { value: 'symptom', label: 'Síntoma' },
  { value: 'trigger', label: 'Trigger' },
  { value: 'medication', label: 'Medicación' },
];

async function onSubmit(): Promise<void> {
  if (await save()) {
    emit('done');
  }
}
</script>

<template>
  <form
    novalidate
    class="flex flex-col gap-5"
    @submit.prevent="onSubmit"
  >
    <label class="flex flex-col gap-2 text-sm font-bold text-slate-800">
      Nombre
      <input
        v-model="name"
        type="text"
        maxlength="100"
        required
        class="px-2 py-1.5 font-normal text-slate-800 bg-canvas border border-slate-200 rounded-lg"
        :class="FOCUS_RING"
      >
    </label>

    <fieldset class="flex flex-col gap-2">
      <legend class="text-sm font-bold text-slate-800">
        Emoji
      </legend>
      <EmojiPicker v-model="emoji" />
    </fieldset>

    <fieldset
      class="flex flex-col gap-2"
      :aria-describedby="isEdit ? `${categoryGroupId}-note` : undefined"
    >
      <legend class="text-sm font-bold text-slate-800">
        Categoría
      </legend>
      <div class="flex flex-wrap gap-1.5">
        <label
          v-for="option in CATEGORY_OPTIONS"
          :key="option.value"
          class="inline-flex items-center"
          :class="isEdit ? 'cursor-not-allowed' : 'cursor-pointer'"
        >
          <input
            v-model="category"
            type="radio"
            :value="option.value"
            :disabled="isEdit"
            class="peer sr-only"
          >
          <span
            class="px-3 py-1.5 text-xs font-bold text-slate-800 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-slate"
            :class="[category === option.value ? 'bg-mint' : 'bg-tint', isEdit && 'opacity-60']"
          >
            {{ option.label }}
          </span>
        </label>
      </div>
      <p
        v-if="isEdit"
        :id="`${categoryGroupId}-note`"
        class="text-xs text-slate"
      >
        La categoría está bloqueada. Para cambiarla, crea un ítem nuevo.
      </p>
    </fieldset>

    <div class="flex flex-col gap-3">
      <label class="flex items-center justify-between gap-3 text-sm font-bold text-slate-800">
        Registrar intensidad (1 a 3)
        <span class="relative inline-flex">
          <input
            v-model="trackIntensity"
            type="checkbox"
            class="peer sr-only"
          >
          <span
            aria-hidden="true"
            class="h-5 w-9 rounded-full bg-slate-300 transition-colors peer-checked:bg-slate-700 peer-focus-visible:ring-2 peer-focus-visible:ring-slate"
          />
        </span>
      </label>
      <label class="flex items-center justify-between gap-3 text-sm font-bold text-slate-800">
        Registrar duración (minutos)
        <span class="relative inline-flex">
          <input
            v-model="trackDuration"
            type="checkbox"
            class="peer sr-only"
          >
          <span
            aria-hidden="true"
            class="h-5 w-9 rounded-full bg-slate-300 transition-colors peer-checked:bg-slate-700 peer-focus-visible:ring-2 peer-focus-visible:ring-slate"
          />
        </span>
      </label>
    </div>

    <p
      v-if="isEdit"
      class="p-3 text-xs text-slate-800 bg-sky/40 rounded-xl"
    >
      Los cambios de nombre y emoji son retroactivos: se aplican también a los registros anteriores.
      Cambiar la intensidad o la duración crea una versión nueva; los registros previos conservan sus campos.
    </p>

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
        class="px-4 py-2 text-sm font-bold text-slate-800 border border-slate rounded-full hover:bg-tint"
        :class="FOCUS_RING"
        @click="emit('cancel')"
      >
        Cancelar
      </button>
      <button
        type="submit"
        class="px-4 py-2 text-sm font-bold text-canvas bg-slate rounded-full transition-colors hover:bg-slate-700"
        :class="FOCUS_RING"
      >
        Guardar
      </button>
    </div>
  </form>
</template>
