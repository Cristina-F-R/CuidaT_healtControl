import { GUEST_STORAGE_KEY } from '@cuidat/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyGuestDocument, GUEST_BACKUP_KEY, GuestStorage } from './guestStorage';

describe('GuestStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reads an empty document when nothing is stored', () => {
    expect(new GuestStorage().read()).toEqual(createEmptyGuestDocument());
  });

  it('keeps an unreadable document under the backup key before replacing it', () => {
    localStorage.setItem(GUEST_STORAGE_KEY, '{"version":1,"profiles":[');
    const storage = new GuestStorage();

    expect(storage.read()).toEqual(createEmptyGuestDocument());
    storage.write(createEmptyGuestDocument());

    expect(localStorage.getItem(GUEST_BACKUP_KEY)).toBe('{"version":1,"profiles":[');
    expect(new GuestStorage().read()).toEqual(createEmptyGuestDocument());
  });

  it('does not replace the first backup with a later unreadable copy', () => {
    localStorage.setItem(GUEST_STORAGE_KEY, 'primera copia ilegible');
    new GuestStorage().write(createEmptyGuestDocument());
    localStorage.setItem(GUEST_STORAGE_KEY, 'segunda copia ilegible');
    new GuestStorage().write(createEmptyGuestDocument());

    expect(localStorage.getItem(GUEST_BACKUP_KEY)).toBe('primera copia ilegible');
  });

  it('does not create a backup for valid documents', () => {
    new GuestStorage().write(createEmptyGuestDocument());
    new GuestStorage().write(createEmptyGuestDocument());
    expect(localStorage.getItem(GUEST_BACKUP_KEY)).toBeNull();
  });
});
