import { describe, expect, it } from 'vitest';
import { ConfigurationError } from '../domain/errors.js';
import { testConfig } from '../../test/support/testDatabase.js';
import { assertResetAllowed, describeTarget } from './reset.js';

describe('db:reset safeguards', () => {
  it('refuses to run unless ALLOW_DB_RESET=true', () => {
    expect(() => assertResetAllowed(testConfig(), ['--yes'])).toThrow(ConfigurationError);
  });

  it('refuses to run without --yes', () => {
    expect(() => assertResetAllowed(testConfig({ ALLOW_DB_RESET: 'true' }), [])).toThrow(/--yes/);
  });

  it('runs only with both safeguards', () => {
    expect(() => assertResetAllowed(testConfig({ ALLOW_DB_RESET: 'true' }), ['--yes'])).not.toThrow();
  });

  it('shows the host and database but never the credentials', () => {
    expect(describeTarget('postgresql://user:secret@ep-x.eu-central-1.aws.neon.tech/neondb?sslmode=require')).toBe(
      'ep-x.eu-central-1.aws.neon.tech/neondb',
    );
  });
});
