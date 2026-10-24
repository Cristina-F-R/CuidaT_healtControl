import { profileResponseSchema, profilesResponseSchema } from '@cuidat/shared';
import type { CalendarProfile, ProfileDraft } from '@cuidat/shared';
import type { ProfilePatch, ProfileRepository } from '../../application/ports/repositories';
import { apiRequest, NetworkError } from '../http/apiClient';
import type { OfflineCache } from '../sync/OfflineCache';

/** Calendars of the signed-in user. Reads fall back to the offline cache; changes need connection. */
export class ApiProfileRepository implements ProfileRepository {
  private readonly cache: OfflineCache;

  constructor(cache: OfflineCache) {
    this.cache = cache;
  }

  async list(): Promise<CalendarProfile[]> {
    try {
      const { profiles } = profilesResponseSchema.parse(await apiRequest('GET', '/profiles'));
      await this.cache.putProfiles(profiles);
      return profiles;
    } catch (error) {
      const cached = error instanceof NetworkError ? await this.cache.profiles() : null;
      if (cached) {
        return cached;
      }
      throw error;
    }
  }

  async create(draft: ProfileDraft): Promise<CalendarProfile> {
    const profile = profileResponseSchema.parse(await apiRequest('POST', '/profiles', draft)).profile;
    await this.remember((cached) => [...cached, profile]);
    return profile;
  }

  async update(profileId: string, patch: ProfilePatch): Promise<CalendarProfile> {
    const profile = profileResponseSchema.parse(await apiRequest('PATCH', `/profiles/${profileId}`, patch)).profile;
    await this.remember((cached) => cached.map((candidate) => (candidate.id === profileId ? profile : candidate)));
    return profile;
  }

  async remove(profileId: string): Promise<void> {
    await apiRequest('DELETE', `/profiles/${profileId}`);
    await this.remember((cached) => cached.filter((candidate) => candidate.id !== profileId));
  }

  /** Keeps the offline copy in step with a change, so a reload without connection shows it. */
  private async remember(change: (cached: CalendarProfile[]) => CalendarProfile[]): Promise<void> {
    await this.cache.putProfiles(change((await this.cache.profiles()) ?? []));
  }
}
