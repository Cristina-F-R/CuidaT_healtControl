import jwt from 'jsonwebtoken';
import type { SessionTokens } from '../../domain/ports.js';

interface SessionPayload {
  sub: string;
}

/** Signed with HS256 only: the algorithm is fixed on verification, so `alg: none` is rejected. */
export class JwtSessionTokens implements SessionTokens {
  private readonly secret: string;
  private readonly lifetimeSeconds: number;

  constructor(secret: string, lifetimeSeconds: number) {
    this.secret = secret;
    this.lifetimeSeconds = lifetimeSeconds;
  }

  issue(userId: string): string {
    return jwt.sign({ sub: userId }, this.secret, { algorithm: 'HS256', expiresIn: this.lifetimeSeconds });
  }

  verify(token: string): string | null {
    try {
      const payload: unknown = jwt.verify(token, this.secret, { algorithms: ['HS256'] });
      return isSessionPayload(payload) ? payload.sub : null;
    } catch {
      return null;
    }
  }
}

function isSessionPayload(value: unknown): value is SessionPayload {
  return typeof value === 'object' && value !== null && 'sub' in value && typeof value.sub === 'string';
}
