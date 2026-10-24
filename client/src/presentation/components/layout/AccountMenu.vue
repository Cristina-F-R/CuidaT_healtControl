<script setup lang="ts">
import { ChevronDown, Download, LogOut, Trash2, UserRound } from '@lucide/vue';
import { onBeforeUnmount, onMounted, ref, useId } from 'vue';
import { useAccount } from '../../../application/composables/useAccount';
import { useOverlays } from '../../../application/composables/useOverlays';
import { useToast } from '../../../application/composables/useToast';
import { useViewMode } from '../../../application/composables/useViewMode';
import { userMessageOf } from '../../../application/errors';
import { FOCUS_RING } from '../../categoryStyles';

defineProps<{
  email: string;
}>();

const { downloadMyData, signOut } = useAccount();
const { openOverlay } = useOverlays();
const { showToast } = useToast();
// Consultation mode hides the destructive action (TECH_SPEC.md use case 12).
const { consultationMode } = useViewMode();

// Disclosure pattern: a button that shows a list of actions; Esc and a click outside close it.
const open = ref(false);
const rootRef = ref<HTMLElement | null>(null);
const toggleRef = ref<HTMLButtonElement | null>(null);
const listId = useId();

function close(returnFocus = false): void {
  open.value = false;
  if (returnFocus) {
    toggleRef.value?.focus();
  }
}

function onDocumentClick(event: MouseEvent): void {
  if (open.value && event.target instanceof Node && !rootRef.value?.contains(event.target)) {
    close();
  }
}

onMounted(() => document.addEventListener('click', onDocumentClick));
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick));

async function onDownload(): Promise<void> {
  close();
  try {
    await downloadMyData();
  } catch {
    showToast('No se pudieron descargar tus datos. Inténtalo de nuevo.', { tone: 'warning' });
  }
}

function onDelete(): void {
  close();
  openOverlay({ kind: 'deleteAccount' });
}

async function onSignOut(): Promise<void> {
  close();
  try {
    await signOut();
    showToast('Has cerrado la sesión.');
  } catch (error) {
    showToast(userMessageOf(error), { tone: 'warning' });
  }
}

const ITEM = 'flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold rounded-lg hover:bg-tint';
</script>

<template>
  <div
    ref="rootRef"
    class="relative"
    @keydown.esc="close(true)"
  >
    <button
      ref="toggleRef"
      type="button"
      :aria-expanded="open"
      :aria-controls="listId"
      aria-label="Menú de la cuenta"
      class="inline-flex max-w-[16rem] items-center gap-1.5 px-3 py-1 text-xs font-bold text-slate-800 rounded-full hover:bg-tint"
      :class="FOCUS_RING"
      @click="open = !open"
    >
      <UserRound
        :size="14"
        aria-hidden="true"
      />
      <span class="hidden truncate sm:inline">{{ email }}</span>
      <ChevronDown
        :size="14"
        aria-hidden="true"
      />
    </button>
    <ul
      v-show="open"
      :id="listId"
      class="absolute right-0 z-30 mt-2 w-64 p-1.5 bg-canvas border border-slate-200 rounded-2xl shadow-xl"
    >
      <li class="px-3 py-2 truncate text-xs text-slate-600">
        {{ email }}
      </li>
      <li>
        <button
          type="button"
          :class="[ITEM, FOCUS_RING, 'text-slate-800']"
          @click="onDownload"
        >
          <Download
            :size="16"
            aria-hidden="true"
          />
          Descargar mis datos (JSON)
        </button>
      </li>
      <li v-if="!consultationMode">
        <button
          type="button"
          :class="[ITEM, FOCUS_RING, 'text-danger']"
          @click="onDelete"
        >
          <Trash2
            :size="16"
            aria-hidden="true"
          />
          Eliminar cuenta y datos
        </button>
      </li>
      <li>
        <button
          type="button"
          :class="[ITEM, FOCUS_RING, 'text-slate-800']"
          @click="onSignOut"
        >
          <LogOut
            :size="16"
            aria-hidden="true"
          />
          Cerrar sesión
        </button>
      </li>
    </ul>
  </div>
</template>
