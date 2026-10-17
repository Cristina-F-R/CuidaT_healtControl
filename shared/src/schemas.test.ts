import { describe, expect, it } from 'vitest';
import { loginBodySchema, newPasswordSchema, registerBodySchema } from './schemas.js';

describe('password limits (bcrypt, 72 bytes)', () => {
  it('counts UTF-8 bytes, not characters', () => {
    // 22 characters of 3 bytes each (euro sign) = 66 bytes: allowed.
    expect(newPasswordSchema.safeParse('€'.repeat(22)).success).toBe(true);
    // 19 emoji of 4 bytes each = 76 bytes: rejected even though it has fewer characters.
    expect(newPasswordSchema.safeParse('🔐'.repeat(19)).success).toBe(false);
    // 18 letters with an accent (2 bytes) plus 12 ASCII characters = 48 bytes: allowed.
    expect(newPasswordSchema.safeParse('ñ'.repeat(18) + 'a'.repeat(12)).success).toBe(true);
  });

  it('requires 12 characters for a new password but only the byte limit for login', () => {
    expect(newPasswordSchema.safeParse('corta').success).toBe(false);
    expect(loginBodySchema.safeParse({ email: 'a@b.test', password: 'corta' }).success).toBe(true);
  });

  it('strips unknown fields from the register body', () => {
    const parsed = registerBodySchema.parse({ email: 'a@b.test', password: 'contraseña-larga-2026', role: 'admin' });
    expect(parsed).not.toHaveProperty('role');
  });
});
