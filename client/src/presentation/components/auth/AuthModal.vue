<script setup lang="ts">
import { computed, useId } from 'vue';
import { useAuthForm } from '../../../application/composables/useAuthForm';
import { useOverlays } from '../../../application/composables/useOverlays';
import type { AuthFormMode } from '../../../application/composables/useOverlays';
import AppModal from '../feedback/AppModal.vue';
import { FOCUS_RING } from '../../categoryStyles';

const props = defineProps<{
  initialMode: AuthFormMode;
}>();

const { closeOverlay } = useOverlays();
const { mode, email, password, migrateGuestData, fieldErrors, formError, submitting, passwordHint, switchMode, submit } = useAuthForm(props.initialMode);

const hintId = useId();
const MODES: { value: AuthFormMode; label: string }[] = [
  { value: 'login', label: 'Iniciar sesión' },
  { value: 'register', label: 'Crear cuenta' },
];
const title = computed(() => (mode.value === 'register' ? 'Crear cuenta' : 'Iniciar sesión'));
const INPUT = 'px-2 py-1.5 font-normal text-slate-800 bg-canvas border border-slate-200 rounded-lg';
</script>

<template>
  <AppModal
    :title="title"
    @close="closeOverlay"
  >
    <div class="inline-flex self-start p-1 gap-1 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl">
      <button
        v-for="option in MODES"
        :key="option.value"
        type="button"
        :aria-pressed="mode === option.value"
        class="px-2.5 py-1 rounded-lg transition-all"
        :class="[FOCUS_RING, mode === option.value && 'text-slate-800 bg-canvas shadow-sm']"
        @click="switchMode(option.value)"
      >
        {{ option.label }}
      </button>
    </div>

    <form
      novalidate
      class="flex flex-col gap-4"
      @submit.prevent="submit"
    >
      <label class="flex flex-col gap-2 text-sm font-bold text-slate-800">
        Email
        <input
          v-model="email"
          type="email"
          autocomplete="email"
          maxlength="255"
          required
          :aria-invalid="fieldErrors.email ? true : undefined"
          :class="[INPUT, FOCUS_RING]"
        >
        <span
          v-if="fieldErrors.email"
          class="font-normal text-danger-dark"
        >{{ fieldErrors.email }}</span>
      </label>

      <label class="flex flex-col gap-2 text-sm font-bold text-slate-800">
        Contraseña
        <input
          v-model="password"
          type="password"
          :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
          required
          :aria-invalid="fieldErrors.password ? true : undefined"
          :aria-describedby="passwordHint ? hintId : undefined"
          :class="[INPUT, FOCUS_RING]"
        >
        <span
          v-if="passwordHint"
          :id="hintId"
          class="font-normal text-slate-600"
        >{{ passwordHint }}</span>
        <span
          v-if="fieldErrors.password"
          class="font-normal text-danger-dark"
        >{{ fieldErrors.password }}</span>
      </label>

      <label
        v-if="mode === 'register'"
        class="flex items-start gap-2 text-sm text-slate-800"
      >
        <input
          v-model="migrateGuestData"
          type="checkbox"
          class="mt-0.5 h-4 w-4 accent-slate"
          :class="FOCUS_RING"
        >
        <span>
          Conservar y migrar datos locales existentes a mi cuenta
          <span
            v-if="!migrateGuestData"
            class="block text-slate-600"
          >Los datos de este navegador se eliminarán al crear la cuenta.</span>
        </span>
      </label>

      <p
        v-if="formError"
        role="alert"
        class="text-sm font-bold text-danger-dark"
      >
        {{ formError }}
      </p>

      <div class="flex justify-end">
        <button
          type="submit"
          :disabled="submitting"
          class="px-4 py-2 text-sm font-bold text-canvas bg-slate rounded-full transition-colors hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
          :class="FOCUS_RING"
        >
          {{ submitting ? 'Enviando…' : title }}
        </button>
      </div>
    </form>
  </AppModal>
</template>
