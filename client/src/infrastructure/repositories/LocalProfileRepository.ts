import { createCalendarProfile } from '@cuidat/shared';
import type { CalendarProfile, ProfileDraft } from '@cuidat/shared';
import { DomainRuleError } from '@cuidat/shared';
import type { ProfilePatch, ProfileRepository } from '../../application/ports/repositories';
import type { GuestStorage } from './guestStorage';

export class LocalProfileRepository implements ProfileRepository {
  private readonly guest: GuestStorage;

  constructor(guest: GuestStorage) {
    this.guest = guest;
  }

  async list(): Promise<CalendarProfile[]> {
    return this.guest.read().profiles;
  }

  async create(draft: ProfileDraft): Promise<CalendarProfile> {
    const profile = createCalendarProfile(draft, crypto.randomUUID(), new Date().toISOString());
    const document = this.guest.read();
    document.profiles = [...document.profiles, profile];
    this.guest.write(document);
    return profile;
  }

  async update(profileId: string, patch: ProfilePatch): Promise<CalendarProfile> {
    const document = this.guest.read();
    const current = document.profiles.find((profile) => profile.id === profileId);
    if (!current) {
      throw new DomainRuleError('PROFILE_NOT_FOUND', 'El calendario no existe.');
    }
    // Same validation as a new profile; undefined fields keep their value.
    const defined = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
    const updated = createCalendarProfile({ ...current, ...defined }, current.id, current.createdAt);
    document.profiles = document.profiles.map((profile) => (profile.id === profileId ? updated : profile));
    this.guest.write(document);
    return updated;
  }

  async remove(profileId: string): Promise<void> {
    // Local equivalent of ON DELETE CASCADE (TECH_SPEC.md section 5).
    const document = this.guest.read();
    document.profiles = document.profiles.filter((profile) => profile.id !== profileId);
    document.items = document.items.filter((item) => item.calendarId !== profileId);
    document.logs = document.logs.filter((log) => log.calendarId !== profileId);
    this.guest.write(document);
  }
}
