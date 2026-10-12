import type { CorrelationWindowHours } from './types.js';

export const CORRELATION_WINDOWS: readonly CorrelationWindowHours[] = [2, 6, 12, 24, 36, 48];
export const DEFAULT_CORRELATION_WINDOW_HOURS: CorrelationWindowHours = 48;

export const PATTERN_WATCH_MIN_OCCURRENCES = 3;
export const PATTERN_DETECTED_MIN_OCCURRENCES = 7;

export const NOTES_MAX_LENGTH = 300;

export const GUEST_STORAGE_KEY = '@cuidat_guest_v1';
export const SYNC_QUEUE_STORAGE_KEY = '@cuidat_sync_queue_v1';

export const GUEST_MAX_PROFILES = 1;
export const GUEST_MAX_SYMPTOMS = 3;
/** Triggers and medication share this limit. */
export const GUEST_MAX_TRIGGERS = 3;

export const DELETION_CONFIRM_KEYWORD = 'ELIMINAR';

/** Clock-skew tolerance for the server-side future-date rule. */
export const FUTURE_TOLERANCE_MINUTES = 5;

export const FUTURE_DATE_WARNING = 'No se pueden registrar métricas en fechas futuras.';
export const GUEST_LOCKED_WARNING = 'Opción no disponible sin iniciar sesión.';
