import { defineConfig, devices } from '@playwright/test';

// E2E against the Neon `test` branch (TECH_SPEC.md ADR-008, ADR-010). Locally the API reads
// server/.env.test; in CI the same variables come from secrets (dotenv never overrides them).
// Own ports, and never an already running server: a dev API on :3000 points at the `dev` branch.
const API_PORT = 3100;
const CLIENT_PORT = 5180;
const CLIENT_ORIGIN = `http://localhost:${CLIENT_PORT}`;

export default defineConfig({
  testDir: 'tests/e2e',
  // One shared database and a per-IP limit on register/login: run the suites one at a time.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: CLIENT_ORIGIN,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npx tsx src/main.ts',
      cwd: 'server',
      // /me answers 401 without a session, which Playwright accepts as "ready".
      url: `http://localhost:${API_PORT}/api/auth/me`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        DOTENV_CONFIG_PATH: '.env.test',
        NODE_ENV: 'test',
        PORT: String(API_PORT),
        CLIENT_ORIGIN,
        SERVE_CLIENT: 'false',
      },
    },
    {
      command: `npm run dev -- --port ${CLIENT_PORT} --strictPort`,
      cwd: 'client',
      url: CLIENT_ORIGIN,
      reuseExistingServer: false,
      timeout: 120_000,
      // Same origin through the Vite proxy, as in production.
      env: { CUIDAT_API_PROXY: `http://localhost:${API_PORT}`, VITE_API_URL: '' },
    },
  ],
});
