import { createCalendarProfile, createPresetItems, DomainRuleError } from '@cuidat/shared';
import type { CalendarProfile, HealthItemDefinition, ProfileCreateBody, ProfilePatchBody } from '@cuidat/shared';
import { NotFoundError } from '../../domain/errors.js';
import type { DataDependencies } from './dataDependencies.js';

const PROFILE_NOT_FOUND = 'El calendario no existe.';

export async function listProfiles(deps: DataDependencies, userId: string): Promise<CalendarProfile[]> {
  return deps.profiles.list(userId);
}

/** Creates an empty calendar (TECH_SPEC.md use case 6); the sample items are a separate action. */
export async function createProfile(deps: DataDependencies, userId: string, body: ProfileCreateBody): Promise<CalendarProfile> {
  const profile = createCalendarProfile(body, deps.newId(), deps.clock().toISOString());
  await deps.profiles.create(userId, profile);
  return profile;
}

export async function updateProfile(deps: DataDependencies, userId: string, profileId: string, body: ProfilePatchBody): Promise<CalendarProfile> {
  const updated = await deps.profiles.update(userId, profileId, body);
  if (!updated) {
    throw new NotFoundError(PROFILE_NOT_FOUND);
  }
  return updated;
}

/** The last calendar of a user cannot be deleted (ADR-003). */
export async function deleteProfile(deps: DataDependencies, userId: string, profileId: string): Promise<void> {
  const outcome = await deps.profiles.removeUnlessLast(userId, profileId);
  if (outcome === 'not_found') {
    throw new NotFoundError(PROFILE_NOT_FOUND);
  }
  if (outcome === 'last') {
    throw new DomainRuleError('PROFILE_LAST', 'No se puede eliminar el último calendario.');
  }
}

/** «Añadir ítems de ejemplo»: the six PRESET_ITEMS in one transaction. */
export async function addPresetItems(deps: DataDependencies, userId: string, profileId: string): Promise<HealthItemDefinition[]> {
  const items = createPresetItems(profileId, deps.newId, deps.clock());
  if (!(await deps.items.insert({ userId, calendarId: profileId }, items))) {
    throw new NotFoundError(PROFILE_NOT_FOUND);
  }
  return items;
}
