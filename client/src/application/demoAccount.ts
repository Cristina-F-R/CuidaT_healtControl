import type { LoginBody } from '@cuidat/shared';

/**
 * Test account for the teaching staff of the Máster en Desarrollo en IA, so the app can be
 * reviewed without registering. The credentials are public on purpose: never store real data in it.
 */
export const DEMO_ACCOUNT: Readonly<LoginBody> = {
  email: 'profesorado@cuidat.test',
  password: 'MasterIA-Correccion-2026',
};

export const DEMO_ACCOUNT_NOTE = 'Usuario de prueba para corrección profesorado Master en Desarrollo en IA';
