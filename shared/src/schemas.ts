import { z } from 'zod';
import { ITEM_EMOJI_MAX_LENGTH, ITEM_NAME_MAX_LENGTH } from './catalog.js';
import { CORRELATION_WINDOWS, GUEST_MAX_PROFILES, NOTES_MAX_LENGTH } from './constants.js';
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
  colorTheme: trimmedText(50),
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
