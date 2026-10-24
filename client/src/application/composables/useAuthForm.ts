import { loginBodySchema, PASSWORD_MIN_LENGTH, registerBodySchema } from '@cuidat/shared';
import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import { ApiError, NetworkError } from '../../infrastructure/http/apiClient';
import { useAccount } from './useAccount';
import type { AuthFormMode } from './useOverlays';
import { useOverlays } from './useOverlays';
import { useToast } from './useToast';

export interface AuthFieldErrors {
  email?: string;
  password?: string;
}

export interface AuthForm {
  mode: Ref<AuthFormMode>;
  email: Ref<string>;
  password: Ref<string>;
  /** Registration switch: copy the guest calendar to the new account (default on, ADR-020). */
  migrateGuestData: Ref<boolean>;
  fieldErrors: Ref<AuthFieldErrors>;
  formError: Ref<string>;
  submitting: Ref<boolean>;
  passwordHint: ComputedRef<string>;
  switchMode: (next: AuthFormMode) => void;
  submit: () => Promise<void>;
}

const PASSWORD_TOO_SHORT = `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;

/** Turns an API failure into the message shown above the submit button. */
function describeFailure(error: unknown, mode: AuthFormMode): string {
  if (error instanceof NetworkError) {
    return 'No se pudo conectar con el servidor. Inténtalo de nuevo.';
  }
  if (!(error instanceof ApiError)) {
    throw error;
  }
  if (error.code === 'EMAIL_TAKEN') {
    return 'Ya existe una cuenta con ese email. Inicia sesión.';
  }
  if (error.code === 'VALIDATION_ERROR') {
    return mode === 'register' ? 'Revisa los datos: la cuenta no se ha creado.' : 'Revisa el email y la contraseña.';
  }
  // 401, 409 GUEST_LIMIT, 429 RATE_LIMITED and the rest carry a message written for the user.
  return error.status >= 500 ? 'El servidor no está disponible. Inténtalo más tarde.' : error.message;
}

/** Login and registration form (AuthModal.vue). Validates with the shared Zod schemas. */
export function useAuthForm(initialMode: AuthFormMode): AuthForm {
  const account = useAccount();
  const { closeOverlay } = useOverlays();
  const { showToast } = useToast();

  const mode = ref<AuthFormMode>(initialMode);
  const email = ref('');
  const password = ref('');
  const migrateGuestData = ref(true);
  const fieldErrors = ref<AuthFieldErrors>({});
  const formError = ref('');
  const submitting = ref(false);

  const passwordHint = computed(() => (mode.value === 'register' ? `Mínimo ${PASSWORD_MIN_LENGTH} caracteres.` : ''));

  function switchMode(next: AuthFormMode): void {
    mode.value = next;
    fieldErrors.value = {};
    formError.value = '';
  }

  function validate(): { email: string; password: string } | null {
    const schema = mode.value === 'register' ? registerBodySchema : loginBodySchema;
    const parsed = schema.safeParse({ email: email.value, password: password.value });
    const errors: AuthFieldErrors = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === 'email') {
          errors.email = 'Introduce un email válido.';
        } else if (issue.path[0] === 'password') {
          errors.password = issue.code === 'too_small' ? PASSWORD_TOO_SHORT : 'La contraseña es demasiado larga.';
        }
      }
    }
    if (password.value === '') {
      errors.password = 'Introduce la contraseña.';
    }
    fieldErrors.value = errors;
    return parsed.success && !errors.password ? { email: parsed.data.email, password: parsed.data.password } : null;
  }

  async function submit(): Promise<void> {
    formError.value = '';
    const credentials = validate();
    if (!credentials || submitting.value) {
      return;
    }
    submitting.value = true;
    try {
      if (mode.value === 'register') {
        await account.register(credentials, migrateGuestData.value);
        showToast('Cuenta creada. Has iniciado sesión.');
      } else {
        await account.signIn(credentials);
        showToast('Has iniciado sesión.');
      }
      closeOverlay();
    } catch (error) {
      formError.value = describeFailure(error, mode.value);
    } finally {
      submitting.value = false;
    }
  }

  return { mode, email, password, migrateGuestData, fieldErrors, formError, submitting, passwordHint, switchMode, submit };
}
