<script setup lang="ts">
import { FOCUS_RING } from '../../categoryStyles';

function reload(): void {
  window.location.reload();
}
</script>

<template>
  <main class="grid min-h-screen place-items-center p-6 bg-slate-50">
    <section
      aria-labelledby="fallback-title"
      class="flex max-w-md flex-col items-center gap-4 p-8 text-center bg-canvas rounded-2xl border border-slate-100 shadow-sm"
    >
      <span
        aria-hidden="true"
        class="text-5xl"
      >🩹</span>
      <h1
        id="fallback-title"
        class="text-xl font-extrabold text-slate-800"
      >
        Algo no ha ido bien
      </h1>
      <p class="text-sm text-slate">
        Se ha producido un error inesperado y hemos detenido la vista para no mostrar información incorrecta.
        Recarga la página para continuar.
      </p>
      <button
        type="button"
        class="px-5 py-2 text-sm font-bold text-canvas bg-slate rounded-full transition-colors hover:bg-slate-700"
        :class="FOCUS_RING"
        @click="reload"
      >
        Recargar la página
      </button>
    </section>
  </main>
</template>
