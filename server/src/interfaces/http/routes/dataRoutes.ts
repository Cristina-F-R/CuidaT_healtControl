import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  eventRangeQuerySchema,
  eventUpsertSchema,
  itemCreateSchema,
  itemListQuerySchema,
  itemPatchSchema,
  profileCreateSchema,
  profilePatchSchema,
  uuidSchema,
} from '@cuidat/shared';
import type { DataDependencies } from '../../../application/data/dataDependencies.js';
import { addPresetItems, createProfile, deleteProfile, listProfiles, updateProfile } from '../../../application/data/profiles.js';
import {
  archiveItemLineage,
  createItem,
  deleteItemLineage,
  editItemLineage,
  getDeleteImpact,
  listItems,
  restoreItemLineage,
} from '../../../application/data/items.js';
import { deleteEvent, listEvents, upsertEvent } from '../../../application/data/events.js';
import { ValidationError } from '../../../domain/errors.js';
import type { CalendarScope, SessionTokens } from '../../../domain/ports.js';
import { requireSession } from '../middleware/guards.js';

// Data API (Phase 3.2), mounted on /api/profiles. Every route needs a session; ids in the path are validated as UUIDs, so a
// malformed id answers 400 before any query runs.

function userIdOf(res: Response): string {
  return typeof res.locals['userId'] === 'string' ? res.locals['userId'] : '';
}

function idParam(req: Request, name: string): string {
  const parsed = uuidSchema.safeParse(req.params[name]);
  if (!parsed.success) {
    throw new ValidationError('El identificador de la ruta no es válido.');
  }
  return parsed.data;
}

function scopeOf(req: Request, res: Response): CalendarScope {
  return { userId: userIdOf(res), calendarId: idParam(req, 'profileId') };
}

export function dataRouter(deps: DataDependencies, sessions: SessionTokens): Router {
  const router = Router();
  router.use(requireSession(sessions));

  // Profiles (calendars).
  router.get('/', async (_req, res) => {
    res.json({ profiles: await listProfiles(deps, userIdOf(res)) });
  });
  router.post('/', async (req, res) => {
    res.status(201).json({ profile: await createProfile(deps, userIdOf(res), profileCreateSchema.parse(req.body)) });
  });
  router.patch('/:profileId', async (req, res) => {
    res.json({ profile: await updateProfile(deps, userIdOf(res), idParam(req, 'profileId'), profilePatchSchema.parse(req.body)) });
  });
  router.delete('/:profileId', async (req, res) => {
    await deleteProfile(deps, userIdOf(res), idParam(req, 'profileId'));
    res.status(204).end();
  });
  router.post('/:profileId/items/presets', async (req, res) => {
    res.status(201).json({ items: await addPresetItems(deps, userIdOf(res), idParam(req, 'profileId')) });
  });

  // Catalog. `:rootId` is the id of the first version of the lineage.
  router.get('/:profileId/items', async (req, res) => {
    const { status } = itemListQuerySchema.parse(req.query);
    res.json({ items: await listItems(deps, scopeOf(req, res), status) });
  });
  router.post('/:profileId/items', async (req, res) => {
    res.status(201).json({ item: await createItem(deps, scopeOf(req, res), itemCreateSchema.parse(req.body)) });
  });
  router.patch('/:profileId/items/:rootId', async (req, res) => {
    res.json({ items: await editItemLineage(deps, scopeOf(req, res), idParam(req, 'rootId'), itemPatchSchema.parse(req.body)) });
  });
  router.post('/:profileId/items/:rootId/archive', async (req, res) => {
    res.json({ items: await archiveItemLineage(deps, scopeOf(req, res), idParam(req, 'rootId')) });
  });
  router.post('/:profileId/items/:rootId/restore', async (req, res) => {
    res.json({ items: await restoreItemLineage(deps, scopeOf(req, res), idParam(req, 'rootId')) });
  });
  router.get('/:profileId/items/:rootId/impact', async (req, res) => {
    res.json({ logs: await getDeleteImpact(deps, scopeOf(req, res), idParam(req, 'rootId')) });
  });
  router.delete('/:profileId/items/:rootId', async (req, res) => {
    await deleteItemLineage(deps, scopeOf(req, res), idParam(req, 'rootId'));
    res.status(204).end();
  });

  // Events (offline sync target, ADR-007).
  router.get('/:profileId/events', async (req, res) => {
    res.json({ logs: await listEvents(deps, scopeOf(req, res), eventRangeQuerySchema.parse(req.query)) });
  });
  router.put('/:profileId/events/:id', async (req, res) => {
    res.json({ log: await upsertEvent(deps, scopeOf(req, res), idParam(req, 'id'), eventUpsertSchema.parse(req.body)) });
  });
  router.delete('/:profileId/events/:id', async (req, res) => {
    await deleteEvent(deps, scopeOf(req, res), idParam(req, 'id'));
    res.status(204).end();
  });

  return router;
}
