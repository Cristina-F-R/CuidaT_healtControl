import { z } from 'zod';
import { ConfigurationError } from '../domain/errors.js';

const DURATION_PATTERN = /^(\d+)(s|m|h|d)$/;
const DURATION_UNITS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86_400 };

const flag = z.enum(['true', 'false']).default('false').transform((value) => value === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CLIENT_ORIGIN: z.url().optional(),
  RENDER_EXTERNAL_URL: z.url().optional(),
  SERVE_CLIENT: flag,
  DATABASE_URL: z.string().min(1),
  DATABASE_URL_DIRECT: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres.'),
  JWT_EXPIRES_IN: z.string().regex(DURATION_PATTERN, 'JWT_EXPIRES_IN debe tener el formato 30m, 24h o 7d.').default('24h'),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  SENTRY_DSN: z.string().optional(),
  ALLOW_DB_RESET: flag,
});

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  isProduction: boolean;
  port: number;
  /** Origin of the web client: CORS, the CSRF check and the cookie policy all use it. */
  clientOrigin: string;
  serveClient: boolean;
  databaseUrl: string;
  databaseUrlDirect: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtExpiresInSeconds: number;
  authRateLimitMax: number;
  sentryDsn: string | undefined;
  allowDbReset: boolean;
}

export function parseDurationSeconds(value: string): number {
  const match = DURATION_PATTERN.exec(value);
  if (!match) {
    throw new ConfigurationError(`Duración no válida: ${value}`);
  }
  return Number(match[1]) * (DURATION_UNITS[match[2] ?? 's'] ?? 1);
}

/** Empty variables count as unset (`SENTRY_DSN=` in the .env file). */
function withoutEmptyValues(env: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(Object.entries(env).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== ''));
}

/** Validates the environment once at startup. Invalid settings stop the process. */
export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const parsed = envSchema.safeParse(withoutEmptyValues(env));
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new ConfigurationError(`Configuración no válida. ${problems}`);
  }
  const values = parsed.data;
  const isProduction = values.NODE_ENV === 'production';
  const origin = values.CLIENT_ORIGIN ?? values.RENDER_EXTERNAL_URL ?? (isProduction ? undefined : 'http://localhost:5173');
  if (!origin) {
    throw new ConfigurationError('Define CLIENT_ORIGIN (o RENDER_EXTERNAL_URL en Render).');
  }

  return {
    nodeEnv: values.NODE_ENV,
    isProduction,
    port: values.PORT,
    clientOrigin: new URL(origin).origin,
    serveClient: values.SERVE_CLIENT,
    databaseUrl: values.DATABASE_URL,
    databaseUrlDirect: values.DATABASE_URL_DIRECT,
    jwtSecret: values.JWT_SECRET,
    jwtExpiresIn: values.JWT_EXPIRES_IN,
    jwtExpiresInSeconds: parseDurationSeconds(values.JWT_EXPIRES_IN),
    authRateLimitMax: values.AUTH_RATE_LIMIT_MAX,
    sentryDsn: values.SENTRY_DSN,
    allowDbReset: values.ALLOW_DB_RESET,
  };
}
