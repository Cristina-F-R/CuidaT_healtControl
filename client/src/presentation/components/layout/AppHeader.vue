<script setup lang="ts">
import { LogIn } from '@lucide/vue';
import { storeToRefs } from 'pinia';
import { useOverlays } from '../../../application/composables/useOverlays';
import { useSyncStatus } from '../../../application/composables/useSyncStatus';
import { useAuthStore } from '../../../application/stores/useAuthStore';
import { useProfileStore } from '../../../application/stores/useProfileStore';
import { FOCUS_RING } from '../../categoryStyles';
import ProfileMenu from '../profiles/ProfileMenu.vue';
import AccountMenu from './AccountMenu.vue';

const { profiles } = storeToRefs(useProfileStore());
const { user } = storeToRefs(useAuthStore());
const { openOverlay } = useOverlays();
const syncBadge = useSyncStatus();
</script>

<template>
  <!-- From md: logo | calendar menu centered | sync and account. Below md: the calendar menu takes a
       second row of its own, centered (TECH_SPEC.md section 2). -->
  <header
    class="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-3 bg-canvas border-b border-slate-100 md:grid-cols-[1fr_auto_1fr] lg:px-8"
  >
    <h1 class="col-start-1 row-start-1 text-2xl font-extrabold text-slate">
      CuidaT
    </h1>
    <div
      v-if="profiles.length > 0"
      class="col-span-2 row-start-2 flex min-w-0 justify-center md:col-span-1 md:col-start-2 md:row-start-1"
    >
      <ProfileMenu />
    </div>
    <div class="col-start-2 row-start-1 flex min-w-0 items-center justify-end gap-2 md:col-start-3">
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
