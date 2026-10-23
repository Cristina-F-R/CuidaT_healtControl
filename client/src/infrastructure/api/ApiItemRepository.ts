import { impactResponseSchema, itemResponseSchema, itemsResponseSchema } from '@cuidat/shared';
import type { HealthItemDefinition, ItemDraft, ItemEditPatch } from '@cuidat/shared';
import type { ItemRepository } from '../../application/ports/repositories';
import { apiRequest, NetworkError } from '../http/apiClient';
import type { OfflineCache } from '../sync/OfflineCache';

/**
 * Catalog of a registered user. The server applies the lifecycle rules (ADR-006); catalog changes
 * need connection in v1 (ADR-007). Reads fall back to the offline cache.
 */
export class ApiItemRepository implements ItemRepository {
  private readonly cache: OfflineCache;

  constructor(cache: OfflineCache) {
    this.cache = cache;
  }

  async list(calendarId: string): Promise<HealthItemDefinition[]> {
    try {
      const { items } = itemsResponseSchema.parse(await apiRequest('GET', `/profiles/${calendarId}/items`));
      await this.cache.putItems(calendarId, items);
      return items;
    } catch (error) {
      const cached = error instanceof NetworkError ? await this.cache.items(calendarId) : null;
      if (cached) {
        return cached;
      }
      throw error;
    }
  }

  async create(calendarId: string, draft: ItemDraft): Promise<HealthItemDefinition> {
    const { item } = itemResponseSchema.parse(await apiRequest('POST', `/profiles/${calendarId}/items`, draft));
    await this.cache.mergeItems(calendarId, [item]);
    return item;
  }

  async addPresets(calendarId: string): Promise<HealthItemDefinition[]> {
    return this.lineageCommand(calendarId, 'POST', `/profiles/${calendarId}/items/presets`);
  }

  async edit(calendarId: string, rootId: string, patch: ItemEditPatch): Promise<HealthItemDefinition[]> {
    return this.lineageCommand(calendarId, 'PATCH', `/profiles/${calendarId}/items/${rootId}`, patch);
  }

  async archive(calendarId: string, rootId: string): Promise<HealthItemDefinition[]> {
    return this.lineageCommand(calendarId, 'POST', `/profiles/${calendarId}/items/${rootId}/archive`);
  }

  async restore(calendarId: string, rootId: string): Promise<HealthItemDefinition[]> {
    return this.lineageCommand(calendarId, 'POST', `/profiles/${calendarId}/items/${rootId}/restore`);
  }

  async deleteImpact(calendarId: string, rootId: string): Promise<number> {
    return impactResponseSchema.parse(await apiRequest('GET', `/profiles/${calendarId}/items/${rootId}/impact`)).logs;
  }

  async removeLineage(calendarId: string, rootId: string): Promise<void> {
    await apiRequest('DELETE', `/profiles/${calendarId}/items/${rootId}`);
    await this.cache.removeLineage(calendarId, rootId);
  }

  private async lineageCommand(calendarId: string, method: 'POST' | 'PATCH', path: string, body?: unknown): Promise<HealthItemDefinition[]> {
    const { items } = itemsResponseSchema.parse(await apiRequest(method, path, body));
    await this.cache.mergeItems(calendarId, items);
    return items;
  }
}
