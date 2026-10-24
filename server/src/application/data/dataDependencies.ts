import type { EventRepository, ItemRepository, ProfileRepository, ReportRepository } from '../../domain/ports.js';

/** Ports and clock of the data use cases (profiles, catalog, events and saved reports). */
export interface DataDependencies {
  profiles: ProfileRepository;
  items: ItemRepository;
  events: EventRepository;
  reports: ReportRepository;
  clock: () => Date;
  newId: () => string;
}
