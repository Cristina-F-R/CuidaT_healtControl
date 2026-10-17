import bcrypt from 'bcrypt';
import type { PasswordHasher } from '../../domain/ports.js';

/** OWASP A02: bcrypt with a cost factor of 12. */
const COST_FACTOR = 12;

export class BcryptPasswordHasher implements PasswordHasher {
  async hash(plainText: string): Promise<string> {
    return bcrypt.hash(plainText, COST_FACTOR);
  }

  async verify(plainText: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plainText, hash);
  }
}
