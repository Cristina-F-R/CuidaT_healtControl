import type { Repositories } from '../ports/repositories';
import { createRepositories } from '../../infrastructure/repositories/createRepositories';
import { useAuthStore } from './useAuthStore';

/**
 * Repositories of the current session: local for guests, API (with the sync queue) for registered
 * users. Resolved on every call, so signing in or out switches the data source without new stores.
 */
export function currentRepositories(): Repositories {
  const user = useAuthStore().user;
  return createRepositories(user ? { kind: 'api', userId: user.id } : { kind: 'local' });
}
