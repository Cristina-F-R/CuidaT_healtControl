<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { ref } from 'vue';
import { typeSuggestions, useProfileForm } from '../../../application/composables/useProfileForm';
import { completeOnboarding } from '../../../application/composables/useWorkspace';
import { userMessageOf } from '../../../application/errors';
import { useProfileStore } from '../../../application/stores/useProfileStore';
import { FOCUS_RING } from '../../categoryStyles';
import ProfileTypeField from './ProfileTypeField.vue';

// «Crea tu primer calendario» (TECH_SPEC.md use case 6): only name and type; avatar, color and
// correlation window take their defaults and can be edited later.
const form = useProfileForm();
const { name, profileType, error } = form;
const { profileTypes } = storeToRefs(useProfileStore());
const saving = ref(false);

async function onSubmit(): Promise<void> {
  const draft = form.validate();
  if (!draft || saving.value) {
    return;
  }
  saving.value = true;
  try {
    await completeOnboarding({ name: draft.name, profileType: draft.profileType });
  } catch (failure) {
    error.value = userMessageOf(failure);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <main class="mx-auto flex max-w-md flex-col gap-4 px-4 py-10">
    <h2 class="text-2xl font-extrabold text-slate-800">
      Crea tu primer calendario
    </h2>
    <p class="text-sm text-slate-800">
      Un calendario reúne los síntomas, desencadenantes y medicación de una persona o mascota.
    </p>
    <form
      novalidate
      class="flex flex-col gap-4"
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
      <ProfileTypeField
        v-model="profileType"
        :suggestions="typeSuggestions(profileTypes)"
      />
      <p
        v-if="error"
        role="alert"
        class="text-sm font-bold text-danger-dark"
      >
        {{ error }}
      </p>
      <button
        type="submit"
        :disabled="saving"
        class="self-start px-4 py-2 text-sm font-bold text-canvas bg-slate rounded-full transition-colors hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
        :class="FOCUS_RING"
      >
        {{ saving ? 'Creando…' : 'Crear calendario' }}
      </button>
    </form>
  </main>
</template>
