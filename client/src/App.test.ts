import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App.vue';

// Smoke test of the guest workflow through the real components and local repositories.
describe('App (guest workflow)', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('renders the seeded calendar, opens the day summary and the catalog manager', async () => {
    const wrapper = mount(App, { attachTo: document.body });
    await flushPromises();

    expect(wrapper.text()).toContain('Historial de Moby');
    expect(wrapper.text()).toContain('Vómito');

    const manage = wrapper.findAll('button').find((button) => button.text() === 'Gestionar ítems');
    expect(manage).toBeDefined();
    await manage!.trigger('click');
    await flushPromises();
    expect(document.body.textContent).toContain('Gestionar ítems');
    expect(document.body.textContent).toContain('Triggers / Medicación');

    await wrapper.unmount();
  });

  it('opens the event log modal for a selected item and saves a log', async () => {
    const wrapper = mount(App, { attachTo: document.body });
    await flushPromises();

    const vomit = wrapper.findAll('button').find((button) => button.attributes('aria-pressed') !== undefined && button.text().includes('Vómito'));
    expect(vomit).toBeDefined();
    await vomit!.trigger('click');

    // Day buttons are labelled "<date>, <n> registros"; the first day of the month is never in the future.
    const dayButtons = wrapper
      .findAll('button')
      .filter((button) => (button.attributes('aria-label') ?? '').includes(' registro') && !button.attributes('aria-disabled'));
    expect(dayButtons.length).toBeGreaterThan(0);
    await dayButtons[0]!.trigger('click');
    await flushPromises();

    expect(document.body.textContent).toContain('Nuevo registro');
    expect(document.body.textContent).toContain('Vómito');

    const save = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.trim() === 'Guardar');
    expect(save).toBeDefined();
    save!.click();
    await flushPromises();

    expect(document.body.textContent).not.toContain('Nuevo registro');
    await wrapper.unmount();
  });
});
