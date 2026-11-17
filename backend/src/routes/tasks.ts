import { Router } from 'express';
import { getMyTasks } from '../access.ts';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.ts';

export const tasksRouter = Router();

tasksRouter.get('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const tasks = getMyTasks(req.user!);
  res.json({ tasks });
});
