import { describe, expect, it } from 'vitest';
import { typeSuggestions, useProfileForm } from './useProfileForm';

describe('profile form', () => {
  it('suggests the three defaults first and then the types already created, without repeats', () => {
    expect(typeSuggestions([])).toEqual(['Mascota', 'Niño/a', 'Adulto']);
    expect(typeSuggestions(['Adulto', 'Abuela', 'Abuela'])).toEqual(['Mascota', 'Niño/a', 'Adulto', 'Abuela']);
  });

  it('validates with the domain rules and builds the draft', () => {
    const form = useProfileForm();
    expect(form.validate()).toBeNull();
    expect(form.error.value).toMatch(/nombre/i);

    form.name.value = 'Luna';
    form.profileType.value = ' ';
    expect(form.validate()).toBeNull();
    expect(form.error.value).toMatch(/tipo/i);

    form.profileType.value = 'Gata';
    form.correlationWindowHours.value = 12;
    expect(form.validate()).toEqual({ name: 'Luna', profileType: 'Gata', avatarIcon: '👤', colorTheme: 'slate', correlationWindowHours: 12 });
    expect(form.error.value).toBe('');
  });
});
