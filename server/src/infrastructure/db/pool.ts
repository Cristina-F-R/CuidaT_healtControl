import { Pool } from 'pg';

/** Small pool: Neon's pooled endpoint multiplexes connections, so the API does not need many. */
export function createPool(connectionString: string): Pool {
  return new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
}
