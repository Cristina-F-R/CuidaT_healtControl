import { beforeEach, describe, expect, it } from 'vitest';
import { useInteraction } from './useInteraction';
import { resetViewMode, useViewMode } from './useViewMode';

describe('useViewMode (ADR-021)', () => {
  beforeEach(() => {
    resetViewMode();
    useInteraction().clearSelection();
  });

  it('starts off and is shared by every caller', () => {
    expect(useViewMode().consultationMode.value).toBe(false);
    useViewMode().setConsultationMode(true);
    expect(useViewMode().consultationMode.value).toBe(true);
  });

  it('drops the selected dock item when it turns on, so nothing can be placed', () => {
    const interaction = useInteraction();
    interaction.toggleSelection('item-1');
    useViewMode().setConsultationMode(true);
    expect(interaction.selectedItemId.value).toBeNull();
  });

  it('goes back to normal mode on a workspace reload', () => {
    useViewMode().setConsultationMode(true);
    resetViewMode();
    expect(useViewMode().consultationMode.value).toBe(false);
  });
});
