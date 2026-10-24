import { z } from 'zod';
import { ITEM_EMOJI_MAX_LENGTH, ITEM_NAME_MAX_LENGTH } from './catalog.js';
import {
  CORRELATION_WINDOWS,
  GUEST_MAX_PROFILES,
  NOTES_MAX_LENGTH,
  PROFILE_COLOR_THEMES,
  REPORT_MAX_MONTHS,
  REPORT_SCHEMA_VERSION,
  REPORT_TITLE_MAX_LENGTH,
} from './constants.js';
import { isValidTimeZone, monthsBetween } from './time.js';
import { PROFILE_NAME_MAX_LENGTH, PROFILE_TYPE_MAX_LENGTH } from './profiles.js';
import type { CorrelationWindowHours } from './types.js';

// Zod schemas shared by the client and the API (TECH_SPEC.md section 3). Unknown keys are stripped,
// so a payload cannot set fields that the schema does not declare.

/** bcrypt only uses the first 72 bytes of a password, so longer passwords are rejected. */
export const BCRYPT_MAX_BYTES = 72;
export const PASSWORD_MIN_LENGTH = 12;

/** UTF-8 byte length, computed by hand because this package has no DOM or Node typings. */
function utf8Length(text: string): number {
  let bytes = 0;
  for (const char of text) {
    const codePoint = char.codePointAt(0)!;
    bytes += codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4;
  }
  return bytes;
}

const uuid = z.uuid();
const isoInstant = z.iso.datetime();
const trimmedText = (max: number): z.ZodString => z.string().trim().min(1).max(max);

const correlationWindow = z
  .number()
  .int()
  .refine((hours): hours is CorrelationWindowHours => (CORRELATION_WINDOWS as readonly number[]).includes(hours), {
    message: 'La ventana de correlación no es válida.',
  });

const colorTheme = z.enum(PROFILE_COLOR_THEMES, { message: 'El color del calendario no es válido.' });

export const emailSchema = z.string().trim().toLowerCase().max(255).pipe(z.email());

export const passwordSchema = z
  .string()
  .max(BCRYPT_MAX_BYTES)
  .refine((password) => utf8Length(password) <= BCRYPT_MAX_BYTES, {
    message: 'La contraseña es demasiado larga.',
  });

export const newPasswordSchema = passwordSchema.min(PASSWORD_MIN_LENGTH, {
  message: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
});

export const guestProfileSchema = z.object({
  id: uuid,
  name: trimmedText(PROFILE_NAME_MAX_LENGTH),
  profileType: trimmedText(PROFILE_TYPE_MAX_LENGTH),
  avatarIcon: trimmedText(50),
  colorTheme,
  correlationWindowHours: correlationWindow,
  createdAt: isoInstant,
});

export const guestItemSchema = z.object({
  id: uuid,
  calendarId: uuid,
  rootId: uuid,
  parentId: uuid.nullable(),
  name: trimmedText(ITEM_NAME_MAX_LENGTH),
  emoji: trimmedText(ITEM_EMOJI_MAX_LENGTH),
  category: z.enum(['symptom', 'trigger', 'medication']),
  trackIntensity: z.boolean(),
  trackDuration: z.boolean(),
  status: z.enum(['active', 'archived', 'superseded']),
  createdAt: isoInstant,
});

export const guestLogSchema = z.object({
  id: uuid,
  calendarId: uuid,
  itemDefinitionId: uuid,
  loggedAt: isoInstant,
  intensity: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
  durationMinutes: z.number().int().min(1).max(1440).nullable(),
  notes: z.string().trim().max(NOTES_MAX_LENGTH).nullable(),
  createdAt: isoInstant,
  updatedAt: isoInstant,
});

/** The guest document of `@cuidat_guest_v1` (client/src/infrastructure/repositories/guestStorage.ts). */
export const guestDataSchema = z.object({
  version: z.literal(1),
  profiles: z.array(guestProfileSchema).max(GUEST_MAX_PROFILES),
  items: z.array(guestItemSchema).max(200),
  logs: z.array(guestLogSchema).max(5000),
});

export const registerBodySchema = z.object({
  email: emailSchema,
  password: newPasswordSchema,
  guestData: guestDataSchema.nullish(),
});

export const loginBodySchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type GuestData = z.infer<typeof guestDataSchema>;

/** Body of `POST /api/auth/register`, `POST /api/auth/login` and `GET /api/auth/me`. */
export const authResponseSchema = z.object({
  user: z.object({ id: uuid, email: z.string() }),
});

/** Every error the API answers on purpose (server error mapper). */
export const apiErrorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    fields: z.array(z.string()).optional(),
  }),
});

export type AuthUser = z.infer<typeof authResponseSchema>['user'];

// ---------------------------------------------------------------------------------------------
// Data API (Phase 3.2). Bodies of the profile, item and event routes, and the query strings.
// ---------------------------------------------------------------------------------------------

export const uuidSchema = uuid;
const itemCategory = z.enum(['symptom', 'trigger', 'medication']);
const intensity = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const profileCreateSchema = z.object({
  name: trimmedText(PROFILE_NAME_MAX_LENGTH),
  profileType: trimmedText(PROFILE_TYPE_MAX_LENGTH),
  avatarIcon: trimmedText(50).optional(),
  colorTheme: colorTheme.optional(),
  correlationWindowHours: correlationWindow.optional(),
});

export const profilePatchSchema = profileCreateSchema
  .partial()
  .refine((patch) => Object.values(patch).some((value) => value !== undefined), { message: 'No hay cambios.' });

export const itemCreateSchema = z.object({
  name: trimmedText(ITEM_NAME_MAX_LENGTH),
  emoji: trimmedText(ITEM_EMOJI_MAX_LENGTH),
  category: itemCategory,
  trackIntensity: z.boolean(),
  trackDuration: z.boolean(),
});

export const itemPatchSchema = z.object({
  name: trimmedText(ITEM_NAME_MAX_LENGTH).optional(),
  emoji: trimmedText(ITEM_EMOJI_MAX_LENGTH).optional(),
  /** Accepted only when it equals the current category (ADR-006). */
  category: itemCategory.optional(),
  trackIntensity: z.boolean().optional(),
  trackDuration: z.boolean().optional(),
});

export const itemListQuerySchema = z.object({
  status: z.enum(['active', 'archived', 'superseded']).optional(),
});

/** Body of `PUT /api/profiles/:profileId/events/:id` (idempotent upsert, ADR-007). */
export const eventUpsertSchema = z.object({
  itemDefinitionId: uuid,
  loggedAt: isoInstant,
  intensity: intensity.nullable(),
  durationMinutes: z.number().int().min(1).max(1440).nullable(),
  notes: z.string().trim().max(NOTES_MAX_LENGTH).nullable(),
  createdAt: isoInstant,
  /** Instant of the mutation on the client; the server clamps it to now() + 5 min. */
  updatedAt: isoInstant,
  /**
   * True when the log was recorded earlier and is synced later (offline, retries). Such logs are
   * accepted even if their item has been archived or superseded meanwhile (ADR-007).
   */
  deferred: z.boolean().default(false),
});

export const eventRangeQuerySchema = z.object({
  from: isoInstant.optional(),
  to: isoInstant.optional(),
});

export type ProfileCreateBody = z.infer<typeof profileCreateSchema>;
export type ProfilePatchBody = z.infer<typeof profilePatchSchema>;
export type ItemCreateBody = z.infer<typeof itemCreateSchema>;
export type ItemPatchBody = z.infer<typeof itemPatchSchema>;
export type EventUpsertBody = z.infer<typeof eventUpsertSchema>;
export type EventUpsertInput = z.input<typeof eventUpsertSchema>;

/** Entity shapes returned by the API: the same as the guest document rows. */
export const calendarProfileSchema = guestProfileSchema;
export const itemDefinitionSchema = guestItemSchema;
export const eventLogSchema = guestLogSchema;

export const profileResponseSchema = z.object({ profile: calendarProfileSchema });
export const profilesResponseSchema = z.object({ profiles: z.array(calendarProfileSchema) });
export const itemResponseSchema = z.object({ item: itemDefinitionSchema });
export const itemsResponseSchema = z.object({ items: z.array(itemDefinitionSchema) });
export const logsResponseSchema = z.object({ logs: z.array(eventLogSchema) });
export const impactResponseSchema = z.object({ logs: z.number().int().min(0) });

// Saved reports (TECH_SPEC.md section 9.1). The client sends only parameters; the server builds the snapshot.

const isoDate = z.iso.date();

/** Body of `POST /api/reports`. */
export const reportCreateSchema = z
  .object({
    calendarId: uuid,
    from: isoDate,
    to: isoDate,
    timeZone: z.string().max(64).refine(isValidTimeZone, { message: 'La zona horaria no es válida.' }),
    symptomRootIds: z.array(uuid).max(500),
    triggerRootIds: z.array(uuid).max(500),
    title: trimmedText(REPORT_TITLE_MAX_LENGTH).optional(),
  })
  .refine((body) => body.from <= body.to, { message: 'El inicio no puede ser posterior al final.', path: ['to'] })
  .refine((body) => body.from > body.to || monthsBetween(body.from, body.to).length <= REPORT_MAX_MONTHS, {
    message: `El periodo no puede superar ${REPORT_MAX_MONTHS} meses.`,
    path: ['from'],
  })
  .refine((body) => body.symptomRootIds.length + body.triggerRootIds.length > 0, {
    message: 'Elige al menos un síntoma o un trigger.',
    path: ['symptomRootIds'],
  });

const reportItemSchema = z.object({
  rootId: uuid,
  name: z.string(),
  emoji: z.string(),
  category: itemCategory,
  archived: z.boolean(),
});

const reportPatternSchema = z.object({
  triggerRootId: uuid,
  symptomRootId: uuid,
  occurrences: z.number().int().min(1),
  category: z.enum(['Vigilar posible patrón', 'Patrón detectado']),
});

const reportItemStatsSchema = z.object({
  rootId: uuid,
  logCount: z.number().int().min(0),
  /** Logs with intensity 1, 2 and 3; `null` when none of them recorded it. */
  intensityCounts: z.tuple([z.number().int(), z.number().int(), z.number().int()]).nullable(),
  intensityMean: z.number().nullable(),
  durationTotalMinutes: z.number().int().nullable(),
  durationMeanMinutes: z.number().nullable(),
});

const reportLogSchema = z.object({
  time: z.string().regex(/^\d{2}:\d{2}$/),
  rootId: uuid,
  intensity: intensity.nullable(),
  durationMinutes: z.number().int().nullable(),
  notes: z.string().nullable(),
});

const reportDaySchema = z.object({
  date: isoDate,
  mark: z.enum(['watch', 'detected']).nullable(),
  logs: z.array(reportLogSchema),
});

/** Immutable content of a report: names and values as they were when it was generated. */
export const reportSnapshotSchema = z.object({
  schemaVersion: z.literal(REPORT_SCHEMA_VERSION),
  generatedAt: isoInstant,
  timeZone: z.string(),
  calendar: z.object({
    name: z.string(),
    profileType: z.string(),
    avatarIcon: z.string(),
    colorTheme,
    correlationWindowHours: correlationWindow,
  }),
  period: z.object({ from: isoDate, to: isoDate }),
  /** Selected lineages, symptoms first. */
  items: z.array(reportItemSchema),
  /** Detected first, then by occurrences. */
  patterns: z.array(reportPatternSchema),
  itemStats: z.array(reportItemStatsSchema),
  /** Only the days with logs of the selected items. */
  days: z.array(reportDaySchema),
  months: z.array(z.string().regex(/^\d{4}-\d{2}$/)),
});

export const reportSummarySchema = z.object({
  id: uuid,
  calendarId: uuid,
  calendarName: z.string(),
  title: z.string(),
  periodFrom: isoDate,
  periodTo: isoDate,
  createdAt: isoInstant,
});

export const savedReportSchema = reportSummarySchema.extend({ snapshot: reportSnapshotSchema });

export const reportsResponseSchema = z.object({ reports: z.array(reportSummarySchema) });
export const reportSummaryResponseSchema = z.object({ report: reportSummarySchema });
export const savedReportResponseSchema = z.object({ report: savedReportSchema });

export type ReportCreateBody = z.infer<typeof reportCreateSchema>;
export type ReportSnapshot = z.infer<typeof reportSnapshotSchema>;
export type ReportItem = z.infer<typeof reportItemSchema>;
export type ReportPattern = z.infer<typeof reportPatternSchema>;
export type ReportItemStats = z.infer<typeof reportItemStatsSchema>;
export type ReportDay = z.infer<typeof reportDaySchema>;
export type ReportLog = z.infer<typeof reportLogSchema>;
export type ReportSummary = z.infer<typeof reportSummarySchema>;
export type SavedReport = z.infer<typeof savedReportSchema>;
