import { Router } from 'express';
import { getTeamDirectory } from '../access.ts';
import { requireAuth } from '../middleware/auth.ts';

export const usersRouter = Router();

usersRouter.get('/', requireAuth, (_req, res) => {
  const users = getTeamDirectory();
  res.json({ users });
});
