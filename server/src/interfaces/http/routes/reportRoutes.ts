import { Router } from 'express';
import type { Request, Response } from 'express';
import { reportCreateSchema, uuidSchema } from '@cuidat/shared';
import type { DataDependencies } from '../../../application/data/dataDependencies.js';
import { createReport, deleteReport, getReport, listReports } from '../../../application/data/reports.js';
import { ValidationError } from '../../../domain/errors.js';
import type { SessionTokens } from '../../../domain/ports.js';
import { requireSession } from '../middleware/guards.js';

// Saved reports (TECH_SPEC.md section 9.1), mounted on /api/reports. Registered users only.

function userIdOf(res: Response): string {
  return typeof res.locals['userId'] === 'string' ? res.locals['userId'] : '';
}

function reportIdOf(req: Request): string {
  const parsed = uuidSchema.safeParse(req.params['reportId']);
  if (!parsed.success) {
    throw new ValidationError('El identificador de la ruta no es válido.');
  }
  return parsed.data;
}

export function reportRouter(deps: DataDependencies, sessions: SessionTokens): Router {
  const router = Router();
  router.use(requireSession(sessions));

  router.get('/', async (_req, res) => {
    res.json({ reports: await listReports(deps, userIdOf(res)) });
  });
  router.post('/', async (req, res) => {
    res.status(201).json({ report: await createReport(deps, userIdOf(res), reportCreateSchema.parse(req.body)) });
  });
  router.get('/:reportId', async (req, res) => {
    res.json({ report: await getReport(deps, userIdOf(res), reportIdOf(req)) });
  });
  router.delete('/:reportId', async (req, res) => {
    await deleteReport(deps, userIdOf(res), reportIdOf(req));
    res.status(204).end();
  });

  return router;
}
