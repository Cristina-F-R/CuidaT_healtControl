import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import PatternSection from './PatternSection.vue';

describe('PatternSection', () => {
  it('keeps the color of its threshold when there is no pattern', () => {
    for (const [tone, surface] of [['detected', 'bg-peach'], ['watch', 'bg-sun']] as const) {
      const section = mount(PatternSection, {
        props: { headingId: `h-${tone}`, tone, threshold: 'x', emptyText: 'Ningún patrón detectado con este filtro.', patterns: [] },
      });
      const empty = section.find('p.rounded-xl');
      expect(empty.text()).toBe('Ningún patrón detectado con este filtro.');
      expect(empty.classes()).toContain(surface);
      expect(empty.classes()).not.toContain('bg-tint');
    }
  });
});
