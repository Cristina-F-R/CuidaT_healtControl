/** Security events (OWASP A09). Only the user id is written: no email, no IP, no health data. */
export type SecurityEvent = 'account_registered' | 'login_succeeded' | 'login_failed' | 'logged_out';

export interface Logger {
  security(event: SecurityEvent, fields?: { userId?: string }): void;
  /** Unexpected failures: the error class and SQLSTATE only, because driver messages can carry row data. */
  unexpected(error: unknown): void;
}

export const consoleLogger: Logger = {
  security(event, fields = {}): void {
    console.info(JSON.stringify({ time: new Date().toISOString(), level: 'security', event, ...fields }));
  },
  unexpected(error): void {
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : undefined;
    const name = error instanceof Error ? error.name : 'UnknownError';
    console.error(JSON.stringify({ time: new Date().toISOString(), level: 'error', name, code }));
  },
};
