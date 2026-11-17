import { Router } from 'express';
import { getProjectById, getProjects } from '../access.ts';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.ts';

export const projectsRouter = Router();

projectsRouter.get('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const projects = getProjects(req.user!);
  res.json({ projects });
});

projectsRouter.get('/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const projectId = String(req.params.id);
  const project = getProjectById(req.user!, projectId);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  res.json({ project });
});
