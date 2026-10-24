import { onBeforeUnmount, onMounted, ref, useId } from 'vue';
import type { Ref } from 'vue';

export interface Disclosure {
  open: Ref<boolean>;
  rootRef: Ref<HTMLElement | null>;
  toggleRef: Ref<HTMLButtonElement | null>;
  panelId: string;
  close: (returnFocus?: boolean) => void;
}

/**
 * Disclosure pattern (a button that shows a panel): Esc and a click outside close it, and Esc
 * returns the focus to the button. Bind `rootRef` to the wrapper and `toggleRef` to the button.
 */
export function useDisclosure(): Disclosure {
  const open = ref(false);
  const rootRef = ref<HTMLElement | null>(null);
  const toggleRef = ref<HTMLButtonElement | null>(null);
  const panelId = useId();

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

  return { open, rootRef, toggleRef, panelId, close };
}
