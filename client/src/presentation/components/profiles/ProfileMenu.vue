<script setup lang="ts">
import { ChevronDown, Pencil, Plus } from '@lucide/vue';
import { storeToRefs } from 'pinia';
import { useDisclosure } from '../../../application/composables/useDisclosure';
import { useGuestLimits } from '../../../application/composables/useGuestLimits';
import { useOverlays } from '../../../application/composables/useOverlays';
import { useToast } from '../../../application/composables/useToast';
import { useViewMode } from '../../../application/composables/useViewMode';
import { switchCalendar } from '../../../application/composables/useWorkspace';
import { userMessageOf } from '../../../application/errors';
import { useProfileStore } from '../../../application/stores/useProfileStore';
import { FOCUS_RING, PROFILE_THEME } from '../../categoryStyles';

const profileStore = useProfileStore();
const { profiles, activeProfile } = storeToRefs(profileStore);
const { openOverlay } = useOverlays();
const { isGuest, showLockedNotice } = useGuestLimits();
const { showToast } = useToast();
// Consultation mode keeps calendar switching but hides editing (TECH_SPEC.md use case 12).
const { consultationMode } = useViewMode();
const disclosure = useDisclosure();
const { open, panelId, close } = disclosure;

async function onSwitch(calendarId: string): Promise<void> {
  close(true);
  try {
    await switchCalendar(calendarId);
  } catch (error) {
    showToast(`No se pudo abrir el calendario. ${userMessageOf(error)}`, { tone: 'warning' });
  }
}

function onEdit(): void {
  close();
  openOverlay({ kind: 'profileEdit', profileId: activeProfile.value.id });
}

// Guests have a single calendar (ADR-018): a second one shows the locked notice.
function onCreate(): void {
  close();
  if (isGuest.value) {
    showLockedNotice();
    return;
  }
  openOverlay({ kind: 'profileEdit', profileId: null });
}

const ITEM = 'flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold text-slate-800 rounded-lg hover:bg-tint';
const AVATAR = 'grid h-6 w-6 shrink-0 place-items-center rounded-full';
</script>

<template>
  <div
    :ref="disclosure.rootRef"
    class="relative min-w-0"
    @keydown.esc="close(true)"
  >
    <button
      :ref="disclosure.toggleRef"
      type="button"
      :aria-expanded="open"
      :aria-controls="panelId"
      aria-label="Calendarios"
      class="flex max-w-full items-center gap-2 px-3 py-1 text-sm font-bold text-slate-800 rounded-full transition-shadow hover:shadow-md"
      :class="[FOCUS_RING, PROFILE_THEME[activeProfile.colorTheme].surface]"
      @click="open = !open"
    >
      <span
        aria-hidden="true"
        :class="[AVATAR, 'bg-canvas']"
      >{{ activeProfile.avatarIcon }}</span>
      <span class="truncate">{{ activeProfile.name }} · {{ activeProfile.profileType }}</span>
      <ChevronDown
        :size="14"
        aria-hidden="true"
      />
    </button>
    <div
      v-show="open"
      :id="panelId"
      class="absolute left-1/2 z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] -translate-x-1/2 p-1.5 bg-canvas border border-slate-200 rounded-2xl shadow-xl"
    >
      <ul
        aria-label="Tus calendarios"
        class="flex flex-col"
      >
        <li
          v-for="profile in profiles"
          :key="profile.id"
        >
          <button
            type="button"
            :aria-current="profile.id === activeProfile.id || undefined"
            :class="[ITEM, FOCUS_RING, profile.id === activeProfile.id && 'bg-tint']"
            @click="onSwitch(profile.id)"
          >
            <span
              aria-hidden="true"
              :class="[AVATAR, PROFILE_THEME[profile.colorTheme].surface]"
            >{{ profile.avatarIcon }}</span>
            <span class="truncate">{{ profile.name }} · {{ profile.profileType }}</span>
          </button>
        </li>
      </ul>
      <button
        v-if="!consultationMode"
        type="button"
        :class="[ITEM, FOCUS_RING]"
        @click="onEdit"
      >
        <Pencil
          :size="16"
          aria-hidden="true"
        />
        Editar calendario
      </button>
      <button
        v-if="!consultationMode"
        type="button"
        :class="[ITEM, FOCUS_RING]"
        @click="onCreate"
      >
        <Plus
          :size="16"
          aria-hidden="true"
        />
        Nuevo calendario
      </button>
    </div>
  </div>
</template>
