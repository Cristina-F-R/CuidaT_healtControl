<script setup lang="ts">
defineProps<{
  headingId: string;
  title: string;
  threshold: string;
  emptyText: string;
  surface: 'bg-tint' | 'bg-mint/40';
}>();
</script>

<template>
  <section
    :aria-labelledby="headingId"
    class="flex flex-col gap-1 p-4 rounded-xl"
    :class="surface"
  >
    <h3
      :id="headingId"
      class="text-sm font-extrabold text-slate-800"
    >
      {{ title }}
    </h3>
    <p class="text-xs font-bold text-slate-800">
      {{ threshold }}
    </p>
    <p class="mt-1 text-sm text-slate-800">
      {{ emptyText }}
    </p>
  </section>
</template>
