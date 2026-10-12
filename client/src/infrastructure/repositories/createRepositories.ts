import type { AuthMode } from '@cuidat/shared';
import type { EventRepository, ItemRepository, ProfileRepository } from '../../application/ports/repositories';
import { GuestStorage } from './guestStorage';
import { LocalEventRepository } from './LocalEventRepository';
import { LocalItemRepository } from './LocalItemRepository';
import { LocalProfileRepository } from './LocalProfileRepository';

export interface Repositories {
  profiles: ProfileRepository;
  items: ItemRepository;
  events: EventRepository;
}

/** The store picks the implementation by `authMode` (TECH_SPEC.md section 3.1). */
export function createRepositories(authMode: AuthMode): Repositories {
  if (authMode === 'authenticated') {
    // The API repositories (Phase 3.2) are not available yet.
    throw new Error('Los repositorios de API llegan en la Fase 3.2.');
  }
  const guest = new GuestStorage();
  return {
    profiles: new LocalProfileRepository(guest),
    items: new LocalItemRepository(guest),
    events: new LocalEventRepository(guest),
  };
}
