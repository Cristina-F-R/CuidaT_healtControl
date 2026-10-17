import { authResponseSchema } from '@cuidat/shared';
import type { AuthUser, LoginBody } from '@cuidat/shared';
import type { AuthGateway, RegisterRequest } from '../../application/ports/auth';
import { ApiError, apiRequest } from '../http/apiClient';

function toUser(payload: unknown): AuthUser {
  return authResponseSchema.parse(payload).user;
}

export class ApiAuthGateway implements AuthGateway {
  async currentUser(): Promise<AuthUser | null> {
    try {
      return toUser(await apiRequest('GET', '/auth/me'));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        return null;
      }
      throw error;
    }
  }

  async login(credentials: LoginBody): Promise<AuthUser> {
    return toUser(await apiRequest('POST', '/auth/login', credentials));
  }

  async register(request: RegisterRequest): Promise<AuthUser> {
    return toUser(await apiRequest('POST', '/auth/register', request));
  }

  async logout(): Promise<void> {
    await apiRequest('POST', '/auth/logout');
  }

  async deleteAccount(): Promise<void> {
    await apiRequest('DELETE', '/auth/account');
  }
}
