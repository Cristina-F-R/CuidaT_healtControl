<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useProfileStore } from '../../../application/stores/useProfileStore';

const { activeProfile } = storeToRefs(useProfileStore());
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
    <span class="shrink-0 px-3 py-1 text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 rounded-full">
      Modo Local
    </span>
  </header>
</template>
