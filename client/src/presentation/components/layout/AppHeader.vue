<script setup lang="ts">
import { LogIn } from '@lucide/vue';
import { storeToRefs } from 'pinia';
import { useOverlays } from '../../../application/composables/useOverlays';
import { useSyncStatus } from '../../../application/composables/useSyncStatus';
import { useAuthStore } from '../../../application/stores/useAuthStore';
import { useProfileStore } from '../../../application/stores/useProfileStore';
import { FOCUS_RING } from '../../categoryStyles';
import AccountMenu from './AccountMenu.vue';

const { activeProfile } = storeToRefs(useProfileStore());
const { user } = storeToRefs(useAuthStore());
const { openOverlay } = useOverlays();
const syncBadge = useSyncStatus();
</script>

<template>
  <header class="flex items-center justify-between gap-4 px-4 py-3 bg-canvas border-b border-slate-100 lg:px-8">
    <div class="flex min-w-0 items-center gap-3">
      <h1 class="text-2xl font-extrabold text-slate">
        CuidaT
      </h1>
      <p class="flex min-w-0 items-center gap-2 px-3 py-1 text-sm font-bold text-slate-800 bg-tint rounded-full">
        <span aria-hidden="true">{{ activeProfile.avatarIcon }}</span>
        <span class="truncate">{{ activeProfile.name }} · {{ activeProfile.profileType }}</span>
      </p>
    </div>
    <div class="flex min-w-0 items-center gap-2">
      <span
        role="status"
        class="shrink-0 px-3 py-1 text-xs font-bold rounded-full"
        :class="syncBadge.classes"
      >
        {{ syncBadge.label }}
      </span>
      <AccountMenu
        v-if="user"
        :email="user.email"
      />
      <button
        v-else
        type="button"
        class="inline-flex shrink-0 items-center gap-1.5 px-3 py-1 text-xs font-bold text-slate-800 rounded-full hover:bg-tint"
        :class="FOCUS_RING"
        @click="openOverlay({ kind: 'auth', mode: 'login' })"
      >
        <LogIn
          :size="14"
          aria-hidden="true"
        />
        Iniciar sesión
      </button>
    </div>
  </header>
</template>
