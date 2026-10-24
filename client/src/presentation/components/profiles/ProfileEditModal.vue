<script setup lang="ts">
import { CORRELATION_WINDOWS } from '@cuidat/shared';
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';
import { useGuestLimits } from '../../../application/composables/useGuestLimits';
import { useOverlays } from '../../../application/composables/useOverlays';
import { typeSuggestions, useProfileForm } from '../../../application/composables/useProfileForm';
import { useToast } from '../../../application/composables/useToast';
import { createCalendar, deleteCalendar } from '../../../application/composables/useWorkspace';
import { userMessageOf } from '../../../application/errors';
import { useProfileStore } from '../../../application/stores/useProfileStore';
import { FOCUS_RING } from '../../categoryStyles';
import { PROFILE_AVATARS } from '../../emojiSets';
import EmojiPicker from '../catalog/EmojiPicker.vue';
import AppModal from '../feedback/AppModal.vue';
import ProfileColorField from './ProfileColorField.vue';
import ProfileDeleteSection from './ProfileDeleteSection.vue';
import ProfileTypeField from './ProfileTypeField.vue';

// `profileId` null creates a calendar; otherwise it edits that one (TECH_SPEC.md use case 6).
const props = defineProps<{
  profileId: string | null;
}>();

const { closeOverlay } = useOverlays();
const { showToast } = useToast();
const { handleStoreError } = useGuestLimits();
const profileStore = useProfileStore();
const { profiles, profileTypes } = storeToRefs(profileStore);

const existing = computed(() => profiles.value.find((profile) => profile.id === props.profileId));
const form = useProfileForm(existing.value);
const { name, profileType, avatarIcon, colorTheme, correlationWindowHours, error } = form;
const saving = ref(false);
const title = computed(() => (existing.value ? 'Editar calendario' : 'Nuevo calendario'));
const INPUT = 'px-2 py-1.5 font-normal text-slate-800 bg-canvas border border-slate-200 rounded-lg';

async function run(action: () => Promise<void>, done: string): Promise<void> {
  saving.value = true;
  try {
    await action();
    showToast(done);
    closeOverlay();
  } catch (failure) {
    try {
      handleStoreError(failure);
    } catch {
      error.value = userMessageOf(failure);
    }
  } finally {
    saving.value = false;
  }
}

async function onSubmit(): Promise<void> {
  const draft = form.validate();
  if (!draft || saving.value) {
    return;
  }
  const current = existing.value;
  if (current) {
    await run(async () => void (await profileStore.updateProfile(current.id, draft)), 'Calendario actualizado.');
  } else {
    await run(() => createCalendar(draft), 'Calendario creado.');
  }
}

async function onDelete(): Promise<void> {
  const current = existing.value;
  if (current) {
    await run(() => deleteCalendar(current.id), 'Calendario eliminado.');
  }
}
</script>

<template>
  <AppModal
    :title="title"
    @close="closeOverlay"
  >
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
          :class="[INPUT, FOCUS_RING]"
        >
      </label>
      <ProfileTypeField
        v-model="profileType"
        :suggestions="typeSuggestions(profileTypes)"
      />
      <div class="flex flex-col gap-2 text-sm font-bold text-slate-800">
        Avatar
        <EmojiPicker
          v-model="avatarIcon"
          :emojis="PROFILE_AVATARS"
          label="Avatar del calendario"
        />
      </div>
      <ProfileColorField v-model="colorTheme" />
      <label class="flex flex-col gap-2 text-sm font-bold text-slate-800">
        Ventana de correlación
        <select
          v-model.number="correlationWindowHours"
          :class="[INPUT, FOCUS_RING]"
        >
          <option
            v-for="hours in CORRELATION_WINDOWS"
            :key="hours"
            :value="hours"
          >
            {{ hours }} horas
          </option>
        </select>
        <span class="font-normal text-slate-600">Tiempo máximo entre un desencadenante y un síntoma para contarlos como coincidencia.</span>
      </label>
      <p
        v-if="error"
        role="alert"
        class="text-sm font-bold text-danger-dark"
      >
        {{ error }}
      </p>
      <div class="flex justify-end">
        <button
          type="submit"
          :disabled="saving"
          class="px-4 py-2 text-sm font-bold text-canvas bg-slate rounded-full transition-colors hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
          :class="FOCUS_RING"
        >
          {{ saving ? 'Guardando…' : 'Guardar' }}
        </button>
      </div>
    </form>
    <ProfileDeleteSection
      v-if="existing"
      :profile-name="existing.name"
      :busy="saving"
      @confirm="onDelete"
    />
  </AppModal>
</template>
