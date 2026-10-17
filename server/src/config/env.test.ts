import { describe, expect, it } from 'vitest';
import { ConfigurationError } from '../domain/errors.js';
import { loadConfig, parseDurationSeconds } from './env.js';

const BASE = {
  DATABASE_URL: 'postgresql://x',
  DATABASE_URL_DIRECT: 'postgresql://y',
  JWT_SECRET: 'a'.repeat(32),
};

describe('loadConfig', () => {
  it('uses the local client origin in development and 24 hours of session by default', () => {
    const config = loadConfig({ ...BASE });
    expect(config.clientOrigin).toBe('http://localhost:5173');
    expect(config.jwtExpiresInSeconds).toBe(86_400);
    expect(config.authRateLimitMax).toBe(20);
    expect(config.isProduction).toBe(false);
  });

  it('rejects a JWT secret shorter than 32 characters', () => {
    expect(() => loadConfig({ ...BASE, JWT_SECRET: 'corto' })).toThrow(ConfigurationError);
    expect(() => loadConfig({ ...BASE, JWT_SECRET: 'corto' })).toThrow(/JWT_SECRET/);
  });

  it('requires an explicit origin in production and falls back to RENDER_EXTERNAL_URL', () => {
    expect(() => loadConfig({ ...BASE, NODE_ENV: 'production' })).toThrow(/CLIENT_ORIGIN/);
    const config = loadConfig({ ...BASE, NODE_ENV: 'production', RENDER_EXTERNAL_URL: 'https://cuidat.onrender.com/' });
    expect(config.clientOrigin).toBe('https://cuidat.onrender.com');
    expect(config.isProduction).toBe(true);
  });

  it('treats empty variables as unset and rejects unknown duration formats', () => {
    expect(loadConfig({ ...BASE, SENTRY_DSN: '' }).sentryDsn).toBeUndefined();
    expect(() => loadConfig({ ...BASE, JWT_EXPIRES_IN: '1y' })).toThrow(/JWT_EXPIRES_IN/);
  });
});

describe('parseDurationSeconds', () => {
  it('converts seconds, minutes, hours and days', () => {
    expect(parseDurationSeconds('30s')).toBe(30);
    expect(parseDurationSeconds('15m')).toBe(900);
    expect(parseDurationSeconds('7d')).toBe(604_800);
  });
});
