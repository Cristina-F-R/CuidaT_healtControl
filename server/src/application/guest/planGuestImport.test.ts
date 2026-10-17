import { createPresetItems, DomainRuleError, type GuestData } from '@cuidat/shared';
import { describe, expect, it } from 'vitest';
import { planGuestImport } from './planGuestImport.js';

const NOW = new Date('2026-04-20T12:00:00.000Z');
const CREATED = '2026-04-10T10:00:00.000Z';
const CALENDAR = '00000000-0000-4000-8000-000000000001';

/** Fresh random ids for the server side, so they can never collide with the fixture ids. */
const newId = (): string => crypto.randomUUID();

/** A guest with the 6 presets, one edited lineage (v1 superseded, v2 live) and two logs. */
function guestDocument(): GuestData {
  const items = createPresetItems(CALENDAR, () => crypto.randomUUID(), new Date(CREATED)).map((item) => ({ ...item, createdAt: CREATED }));
  const vomit = items.find((item) => item.name === 'Vómito')!;
  const version = {
    ...vomit,
    id: '00000000-0000-4000-8000-000000001000',
    parentId: vomit.id,
    trackDuration: true,
    status: 'active' as const,
  };
  const superseded = { ...vomit, status: 'superseded' as const };
  const allItems = items.map((item) => (item.id === vomit.id ? superseded : item)).concat(version);
  const logs = [
    { id: '00000000-0000-4000-8000-000000002000', calendarId: CALENDAR, itemDefinitionId: vomit.id, loggedAt: '2026-04-20T09:00:00.000Z', intensity: 2 as const, durationMinutes: null, notes: 'Tras comer', createdAt: CREATED, updatedAt: CREATED },
    { id: '00000000-0000-4000-8000-000000002001', calendarId: CALENDAR, itemDefinitionId: version.id, loggedAt: '2026-04-20T10:00:00.000Z', intensity: null, durationMinutes: 30, notes: null, createdAt: CREATED, updatedAt: CREATED },
  ];
  return {
    version: 1,
    profiles: [{ id: CALENDAR, name: 'Moby', profileType: 'Mascota', avatarIcon: '🐶', colorTheme: 'slate', correlationWindowHours: 48, createdAt: CREATED }],
    items: allItems,
    logs,
  };
}

function ruleCodeOf(action: () => unknown): string {
  try {
    action();
    return 'none';
  } catch (error) {
    return error instanceof DomainRuleError ? error.code : 'unexpected';
  }
}

describe('planGuestImport', () => {
  it('returns null when the guest has no calendar', () => {
    expect(planGuestImport({ version: 1, profiles: [], items: [], logs: [] }, NOW, newId)).toBeNull();
  });

  it('gives every row a new id and keeps the lineage and the log links', () => {
    const data = guestDocument();
    const plan = planGuestImport(data, NOW, newId);
    expect(plan).not.toBeNull();
    const oldIds = new Set([...data.items.map((item) => item.id), ...data.logs.map((log) => log.id), CALENDAR]);
    const newIds = [plan!.profile.id, ...plan!.items.map((item) => item.id), ...plan!.logs.map((log) => log.id)];
    expect(newIds.some((id) => oldIds.has(id))).toBe(false);

    const version = plan!.items.find((item) => item.parentId !== null)!;
    const original = plan!.items.find((item) => item.id === version.parentId)!;
    expect(original.parentId).toBeNull();
    expect(version.rootId).toBe(original.id);
    expect(plan!.logs.every((log) => log.calendarId === plan!.profile.id)).toBe(true);
    expect(plan!.logs.map((log) => log.itemDefinitionId)).toContain(version.id);
    expect(plan!.logs[0]?.notes).toBe('Tras comer');
  });

  it('refuses more than 3 symptoms or 3 triggers/medication', () => {
    const data = guestDocument();
    const extra = { ...data.items[0]!, id: '00000000-0000-4000-8000-000000003000', rootId: '00000000-0000-4000-8000-000000003000', parentId: null, status: 'active' as const, name: 'Tos', category: 'trigger' as const };
    expect(ruleCodeOf(() => planGuestImport({ ...data, items: [...data.items, extra] }, NOW, newId))).toBe('GUEST_LIMIT');
  });

  it('refuses future logs, which are checked with the normal domain rules', () => {
    const data = guestDocument();
    const future = { ...data.logs[0]!, id: '00000000-0000-4000-8000-000000004000', loggedAt: '2026-05-01T09:00:00.000Z' };
    expect(ruleCodeOf(() => planGuestImport({ ...data, logs: [future] }, NOW, newId))).toBe('FUTURE_DATE');
  });

  it('refuses a lineage without exactly one live version', () => {
    const data = guestDocument();
    const withoutLive = { ...data, items: data.items.map((item) => (item.status === 'active' && item.name === 'Vómito' && item.parentId ? { ...item, status: 'superseded' as const } : item)) };
    expect(() => planGuestImport(withoutLive, NOW, newId)).toThrow(/versión vigente/);
  });

  it('refuses logs that point at no item of the guest', () => {
    const data = guestDocument();
    const orphan = { ...data.logs[0]!, itemDefinitionId: '00000000-0000-4000-8000-000000009999' };
    expect(() => planGuestImport({ ...data, logs: [orphan] }, NOW, newId)).toThrow(/ningún ítem/);
  });
});
