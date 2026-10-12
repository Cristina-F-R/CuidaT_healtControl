import { describe, expect, it } from 'vitest';
import { DomainRuleError } from './errors.js';
import {
  archiveItem,
  countLineageLogs,
  createItemDefinition,
  editItem,
  getLineage,
  getLiveVersion,
  removeLineage,
  restoreItem,
} from './catalog.js';
import type { HealthEventLog, HealthItemDefinition } from './types.js';

const NOW = '2026-04-20T10:00:00.000Z';
const LATER = '2026-04-21T10:00:00.000Z';

/** Code of the DomainRuleError thrown by `action`, or `'none'` when it does not throw. */
function ruleCodeOf(action: () => unknown): string {
  try {
    action();
    return 'none';
  } catch (error) {
    return error instanceof DomainRuleError ? error.code : 'unexpected';
  }
}

function item(overrides: Partial<HealthItemDefinition> & Pick<HealthItemDefinition, 'id'>): HealthItemDefinition {
  return {
    calendarId: 'cal-1',
    rootId: overrides.id,
    parentId: null,
    name: 'Vómito',
    emoji: '🤢',
    category: 'symptom',
    trackIntensity: true,
    trackDuration: false,
    status: 'active',
    createdAt: NOW,
    ...overrides,
  };
}

function log(id: string, itemDefinitionId: string): HealthEventLog {
  return {
    id,
    calendarId: 'cal-1',
    itemDefinitionId,
    loggedAt: NOW,
    intensity: 1,
    durationMinutes: null,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

const DRAFT = {
  name: 'Vómito',
  emoji: '🤢',
  category: 'symptom' as const,
  trackIntensity: true,
  trackDuration: false,
};

/** A lineage with one superseded version (v1), its live replacement (v2) and an untouched neighbour. */
function versionedCatalog(): HealthItemDefinition[] {
  return [
    item({ id: 'v1', status: 'superseded' }),
    item({ id: 'v2', rootId: 'v1', parentId: 'v1', trackDuration: true }),
    item({ id: 'other', name: 'Heces blandas', emoji: '💩' }),
  ];
}

describe('createItemDefinition', () => {
  it('creates an active original with trimmed texts', () => {
    const created = createItemDefinition('cal-1', { ...DRAFT, name: '  Vómito  ' }, 'new-id', NOW);
    expect(created).toEqual({
      id: 'new-id',
      calendarId: 'cal-1',
      rootId: 'new-id',
      parentId: null,
      name: 'Vómito',
      emoji: '🤢',
      category: 'symptom',
      trackIntensity: true,
      trackDuration: false,
      status: 'active',
      createdAt: NOW,
    });
  });

  it('rejects empty and overlong names and emojis', () => {
    expect(ruleCodeOf(() => createItemDefinition('cal-1', { ...DRAFT, name: '   ' }, 'id', NOW))).toBe('INVALID_INPUT');
    expect(ruleCodeOf(() => createItemDefinition('cal-1', { ...DRAFT, name: 'a'.repeat(101) }, 'id', NOW))).toBe(
      'INVALID_INPUT',
    );
    expect(ruleCodeOf(() => createItemDefinition('cal-1', { ...DRAFT, emoji: '' }, 'id', NOW))).toBe('INVALID_INPUT');
  });
});

describe('lineage lookups', () => {
  it('returns every version of a lineage', () => {
    expect(getLineage(versionedCatalog(), 'v1').map((row) => row.id)).toEqual(['v1', 'v2']);
  });

  it('returns the version that is not superseded', () => {
    expect(getLiveVersion(versionedCatalog(), 'v1').id).toBe('v2');
  });

  it('fails when the lineage does not exist', () => {
    expect(ruleCodeOf(() => getLiveVersion(versionedCatalog(), 'missing'))).toBe('ITEM_NOT_FOUND');
  });
});

describe('editItem', () => {
  const options = { newId: 'v3', now: LATER };

  it('rejects an unknown lineage', () => {
    expect(ruleCodeOf(() => editItem(versionedCatalog(), 'missing', { name: 'X' }, options))).toBe('ITEM_NOT_FOUND');
  });

  it('rejects edits of archived items', () => {
    const catalog = [item({ id: 'a', status: 'archived' })];
    expect(ruleCodeOf(() => editItem(catalog, 'a', { name: 'X' }, options))).toBe('ITEM_ARCHIVED');
  });

  it('locks the category and accepts the same category', () => {
    expect(ruleCodeOf(() => editItem(versionedCatalog(), 'v1', { category: 'trigger' }, options))).toBe(
      'CATEGORY_LOCKED',
    );
    expect(editItem(versionedCatalog(), 'v1', { category: 'symptom' }, options)).toEqual(versionedCatalog());
  });

  it('returns an equal copy when nothing changes', () => {
    const catalog = versionedCatalog();
    const result = editItem(catalog, 'v1', { name: 'Vómito', trackIntensity: true, trackDuration: true }, options);
    expect(result).toEqual(catalog);
    expect(result).not.toBe(catalog);
  });

  it('renames every version of the lineage in place and keeps the rest untouched', () => {
    const catalog = versionedCatalog();
    const result = editItem(catalog, 'v1', { name: 'Vómito agudo', emoji: '🤮' }, options);

    expect(result).toHaveLength(3);
    expect(result.find((row) => row.id === 'v1')).toMatchObject({ name: 'Vómito agudo', emoji: '🤮' });
    expect(result.find((row) => row.id === 'v2')).toMatchObject({ name: 'Vómito agudo', emoji: '🤮' });
    expect(result[2]).toBe(catalog[2]);
  });

  it('renames only the emoji when the name is not provided', () => {
    const result = editItem(versionedCatalog(), 'v1', { emoji: '🤮' }, options);
    expect(getLiveVersion(result, 'v1')).toMatchObject({ name: 'Vómito', emoji: '🤮' });
  });

  it('renames only the name when the emoji is not provided', () => {
    const result = editItem(versionedCatalog(), 'v1', { name: 'Náusea' }, options);
    expect(getLiveVersion(result, 'v1')).toMatchObject({ name: 'Náusea', emoji: '🤢' });
  });

  it('rejects an empty name or emoji', () => {
    expect(ruleCodeOf(() => editItem(versionedCatalog(), 'v1', { name: ' ' }, options))).toBe('INVALID_INPUT');
    expect(ruleCodeOf(() => editItem(versionedCatalog(), 'v1', { emoji: '' }, options))).toBe('INVALID_INPUT');
  });

  it('creates a new version when the tracking shape changes', () => {
    const result = editItem([item({ id: 'a' })], 'a', { trackDuration: true }, options);

    expect(result).toEqual([
      item({ id: 'a', status: 'superseded' }),
      item({ id: 'v3', rootId: 'a', parentId: 'a', trackDuration: true, status: 'active', createdAt: LATER }),
    ]);
  });

  it('keeps the untouched tracking flag when only one flag changes', () => {
    const result = editItem([item({ id: 'a' })], 'a', { trackIntensity: false }, options);
    expect(getLiveVersion(result, 'a')).toMatchObject({ trackIntensity: false, trackDuration: false });
  });

  it('applies name, emoji and shape changes together to the new version', () => {
    const result = editItem([item({ id: 'a' })], 'a', { name: 'Náusea', emoji: '🤮', trackDuration: true }, options);
    expect(result.find((row) => row.id === 'a')).toMatchObject({ name: 'Náusea', emoji: '🤮', status: 'superseded' });
    expect(getLiveVersion(result, 'a')).toMatchObject({ id: 'v3', name: 'Náusea', emoji: '🤮', trackDuration: true });
  });

  it('keeps one live version per lineage after several edits', () => {
    const first = editItem([item({ id: 'a' })], 'a', { trackDuration: true }, { newId: 'b', now: LATER });
    const second = editItem(first, 'a', { trackIntensity: false }, { newId: 'c', now: LATER });
    const live = getLineage(second, 'a').filter((row) => row.status !== 'superseded');
    expect(live.map((row) => row.id)).toEqual(['c']);
    expect(getLineage(second, 'a').map((row) => [row.id, row.parentId])).toEqual([
      ['a', null],
      ['b', 'a'],
      ['c', 'b'],
    ]);
  });
});

describe('archiveItem and restoreItem', () => {
  it('archives the live active version and restores it', () => {
    const archived = archiveItem(versionedCatalog(), 'v1');
    expect(getLiveVersion(archived, 'v1').status).toBe('archived');
    expect(getLiveVersion(restoreItem(archived, 'v1'), 'v1').status).toBe('active');
  });

  it('refuses to archive an item that is not active', () => {
    const archived = archiveItem(versionedCatalog(), 'v1');
    expect(ruleCodeOf(() => archiveItem(archived, 'v1'))).toBe('ITEM_NOT_ACTIVE');
  });

  it('refuses to restore an item that is not archived', () => {
    expect(ruleCodeOf(() => restoreItem(versionedCatalog(), 'v1'))).toBe('ITEM_NOT_ARCHIVED');
  });
});

describe('permanent deletion', () => {
  const logs = [log('l1', 'v1'), log('l2', 'v2'), log('l3', 'other')];

  it('counts the logs of every version of the lineage', () => {
    expect(countLineageLogs(versionedCatalog(), logs, 'v1')).toBe(2);
    expect(countLineageLogs(versionedCatalog(), logs, 'other')).toBe(1);
    expect(countLineageLogs(versionedCatalog(), logs, 'missing')).toBe(0);
  });

  it('removes every version and their logs, leaving other items untouched', () => {
    const result = removeLineage(versionedCatalog(), logs, 'v1');
    expect(result.items.map((row) => row.id)).toEqual(['other']);
    expect(result.logs.map((row) => row.id)).toEqual(['l3']);
  });
});
