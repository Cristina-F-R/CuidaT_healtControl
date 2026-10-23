import type { EventRepository, ItemRepository, ProfileRepository } from '../../domain/ports.js';

/** Ports and clock of the data use cases (profiles, catalog and events). */
export interface DataDependencies {
  profiles: ProfileRepository;
  items: ItemRepository;
  events: EventRepository;
  clock: () => Date;
  newId: () => string;
}
