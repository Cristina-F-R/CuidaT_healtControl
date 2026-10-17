import { describe, expect, it } from 'vitest';
import { syncBadge } from './useSyncStatus';

describe('syncBadge', () => {
  it('shows «Modo Local» while the data lives in the browser, online or not', () => {
    expect(syncBadge(true, true, 0).label).toBe('Modo Local');
    expect(syncBadge(true, false, 3).label).toBe('Modo Local');
  });

  it('shows «Sin conexión» with the neutral style when offline', () => {
    const badge = syncBadge(false, false, 2);
    expect(badge.label).toBe('Sin conexión');
    expect(badge.classes).toBe(syncBadge(true, true, 0).classes);
  });

  it('counts pending operations, and is «Sincronizado» with none', () => {
    expect(syncBadge(false, true, 4)).toMatchObject({ label: 'Pendiente (4)', classes: expect.stringContaining('bg-peach/40') });
    expect(syncBadge(false, true, 0)).toMatchObject({ label: 'Sincronizado', classes: expect.stringContaining('bg-mint/40') });
  });
});
