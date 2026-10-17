import type { LoginBody, RegisterBody } from '@cuidat/shared';
import { UnauthorizedError } from '../../domain/errors.js';
import type { AccountRepository, AccountSummary, PasswordHasher } from '../../domain/ports.js';
import { planGuestImport } from '../guest/planGuestImport.js';

/**
 * bcrypt hash of a random string (cost 12). Login compares against it when the email is unknown,
 * so both paths take the same time and the response does not reveal which emails exist (OWASP A07).
 */
const UNKNOWN_EMAIL_HASH = '$2b$12$yS6PCsuha0jyVaDXEXXcgOSAQSmkT.AJLNMTNN9rEtSmQxPqMSrRS';

export interface AccountDependencies {
  accounts: AccountRepository;
  hasher: PasswordHasher;
  clock: () => Date;
  newId: () => string;
}

/** Creates the account and, when guest data is sent, imports it in the same transaction. */
export async function registerAccount(deps: AccountDependencies, body: RegisterBody): Promise<AccountSummary> {
  const guest = body.guestData ? planGuestImport(body.guestData, deps.clock(), deps.newId) : null;
  const passwordHash = await deps.hasher.hash(body.password);
  return deps.accounts.createAccount({ email: body.email, passwordHash, guest });
}

/** Checks the credentials. Unknown emails and wrong passwords get the same error. */
export async function loginAccount(deps: AccountDependencies, body: LoginBody): Promise<AccountSummary> {
  const account = await deps.accounts.findByEmail(body.email);
  const matches = await deps.hasher.verify(body.password, account?.passwordHash ?? UNKNOWN_EMAIL_HASH);
  if (!account || !matches) {
    throw new UnauthorizedError('Email o contraseña incorrectos.');
  }
  return { id: account.id, email: account.email };
}

export async function getAccount(deps: AccountDependencies, userId: string): Promise<AccountSummary> {
  const account = await deps.accounts.findById(userId);
  if (!account) {
    throw new UnauthorizedError();
  }
  return account;
}
