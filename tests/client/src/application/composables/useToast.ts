import { readonly, ref } from 'vue';
import type { DeepReadonly, Ref } from 'vue';

export type ToastTone = 'info' | 'warning';

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  action?: ToastAction;
}

export interface ToastOptions {
  tone?: ToastTone;
  action?: ToastAction;
}

const TOAST_DURATION_MS = 4500;

const toasts = ref<Toast[]>([]);
const timers = new Map<number, ReturnType<typeof setTimeout>>();
let nextId = 1;

function dismissToast(id: number): void {
  clearTimeout(timers.get(id));
  timers.delete(id);
  toasts.value = toasts.value.filter((toast) => toast.id !== id);
}

function showToast(message: string, options: ToastOptions = {}): void {
  // The same warning repeated (e.g. tapping several future days) replaces the previous one.
  const repeated = toasts.value.find((toast) => toast.message === message);
  if (repeated) {
    dismissToast(repeated.id);
  }
  const id = nextId++;
  toasts.value = [...toasts.value, { id, message, tone: options.tone ?? 'info', action: options.action }];
  timers.set(id, setTimeout(() => dismissToast(id), TOAST_DURATION_MS));
}

export function useToast(): {
  toasts: DeepReadonly<Ref<Toast[]>>;
  showToast: (message: string, options?: ToastOptions) => void;
  dismissToast: (id: number) => void;
} {
  return { toasts: readonly(toasts), showToast, dismissToast };
}
