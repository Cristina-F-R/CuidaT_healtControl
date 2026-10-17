import type { AuthUser, GuestData, LoginBody } from '@cuidat/shared';

export interface RegisterRequest extends LoginBody {
  /** Guest calendar imported in the same transaction as the account (TECH_SPEC.md use case 6). */
  guestData: GuestData | null;
}

/** Session endpoints of the API. The session itself lives in the `httpOnly` cookie, never in JS. */
export interface AuthGateway {
  /** The signed-in user, or `null` when there is no valid session. */
  currentUser(): Promise<AuthUser | null>;
  login(credentials: LoginBody): Promise<AuthUser>;
  register(request: RegisterRequest): Promise<AuthUser>;
  logout(): Promise<void>;
  /** GDPR Art. 17: deletes the account and all its data on the server and clears the session. */
  deleteAccount(): Promise<void>;
}
