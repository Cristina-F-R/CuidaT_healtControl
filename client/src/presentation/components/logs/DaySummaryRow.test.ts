import { mount } from '@vue/test-utils';
import type { HealthEventLog, HealthItemDefinition } from '@cuidat/shared';
import { describe, expect, it } from 'vitest';
import DaySummaryRow from './DaySummaryRow.vue';

const item: HealthItemDefinition = {
  id: 'vomit',
  calendarId: 'cal-1',
  rootId: 'vomit',
  parentId: null,
  name: 'Vómito',
  emoji: '🤢',
  category: 'symptom',
  trackIntensity: true,
  trackDuration: false,
  status: 'active',
  createdAt: '2026-04-20T10:00:00.000Z',
};

const log: HealthEventLog = {
  id: 'log-1',
  calendarId: 'cal-1',
  itemDefinitionId: 'vomit',
  loggedAt: '2026-04-20T09:00:00.000Z',
  intensity: 2,
  durationMinutes: null,
  notes: 'Tras comer',
  createdAt: '2026-04-20T09:00:00.000Z',
  updatedAt: '2026-04-20T09:00:00.000Z',
};

describe('DaySummaryRow deletion', () => {
  it('asks for a second click before emitting delete', async () => {
    const wrapper = mount(DaySummaryRow, { props: { log, item, readOnly: false } });

    await wrapper.get('button[aria-label^="Eliminar"]').trigger('click');
    expect(wrapper.emitted('delete')).toBeUndefined();

    await wrapper.findAll('button').find((button) => button.text() === 'Sí, eliminar')!.trigger('click');
    expect(wrapper.emitted('delete')).toEqual([['log-1']]);
  });

  it('cancels the deletion and hides the edit actions in consultation mode', async () => {
    const wrapper = mount(DaySummaryRow, { props: { log, item, readOnly: false } });
    await wrapper.get('button[aria-label^="Eliminar"]').trigger('click');
    await wrapper.findAll('button').find((button) => button.text() === 'No')!.trigger('click');
    expect(wrapper.find('button[aria-label^="Eliminar"]').exists()).toBe(true);

    const readOnly = mount(DaySummaryRow, { props: { log, item, readOnly: true } });
    expect(readOnly.findAll('button')).toHaveLength(0);
  });
});
