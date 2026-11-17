import crypto from 'crypto';
import { Router } from 'express';
import { getTeamDirectory } from '../access.ts';
import { AiServiceError, extractProjectsFromTranscript } from '../ai.ts';
import { db } from '../db.ts';
import { requireAdmin, requireAuth, type AuthenticatedRequest } from '../middleware/auth.ts';
import type { ProjectSummary } from '../types.ts';
import { createTranscriptSchema, validateTranscriptDraft } from '../validation.ts';

export const transcriptsRouter = Router();

const activeTranscriptSessions = new Set<string>();

transcriptsRouter.post(
  '/create-from-transcript',
  requireAuth,
  requireAdmin,
  async (req: AuthenticatedRequest, res) => {
    const lockKey = req.sessionID || req.user!.id;

    if (activeTranscriptSessions.has(lockKey)) {
      res.status(409).json({
        error: 'A transcript conversion is already in progress for this session. Please wait for it to finish.',
      });
      return;
    }

    const parsedBody = createTranscriptSchema.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({
        error: parsedBody.error.issues[0]?.message || 'Transcript cannot be empty',
      });
      return;
    }

    activeTranscriptSessions.add(lockKey);

    try {
      const directory = getTeamDirectory();
      const rawDraft = await extractProjectsFromTranscript(
        parsedBody.data.transcript,
        directory
      );

      const validation = validateTranscriptDraft(rawDraft);
      if (!validation.valid) {
        res.status(422).json({
          error:
            'Some required details could not be resolved or failed validation. Nothing was saved. Please correct the transcript and try again.',
          unresolvedFields: validation.unresolvedFields,
        });
        return;
      }

      const managerNameMap = new Map(
        directory.map((u) => [u.id, u.name])
      );

      const insertProject = db.prepare(`
        INSERT INTO projects (id, name, client_name, description, manager_id, deadline, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const insertTask = db.prepare(`
        INSERT INTO tasks (id, project_id, title, description, assignee_id, deadline, estimated_hours)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const createdAt = new Date().toISOString();
      const createdProjects: ProjectSummary[] = [];
      let totalTasksCreated = 0;

      const saveAll = db.transaction(() => {
        for (const proj of validation.projects) {
          const projectId = crypto.randomUUID();
          insertProject.run(
            projectId,
            proj.name,
            proj.clientName,
            proj.description,
            proj.managerId,
            proj.deadline,
            createdAt
          );

          for (const task of proj.tasks) {
            const taskId = crypto.randomUUID();
            insertTask.run(
              taskId,
              projectId,
              task.title,
              task.description,
              task.assigneeId,
              task.deadline,
              task.estimatedHours
            );
            totalTasksCreated += 1;
          }

          createdProjects.push({
            id: projectId,
            name: proj.name,
            clientName: proj.clientName,
            description: proj.description,
            managerId: proj.managerId,
            managerName: managerNameMap.get(proj.managerId) ?? proj.managerId,
            deadline: proj.deadline,
            createdAt,
            taskCount: proj.tasks.length,
          });
        }
      });

      saveAll();

      const projectWord = createdProjects.length === 1 ? 'project' : 'projects';
      const taskWord = totalTasksCreated === 1 ? 'task' : 'tasks';

      res.status(201).json({
        message: `${createdProjects.length} ${projectWord} and ${totalTasksCreated} ${taskWord} created.`,
        createdProjectsCount: createdProjects.length,
        createdTasksCount: totalTasksCreated,
        projects: createdProjects,
      });
    } catch (err) {
      if (err instanceof AiServiceError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      console.error('Transcript creation failed:', err);
      res.status(500).json({
        error: 'Failed to save projects and tasks. No partial data was saved.',
      });
    } finally {
      activeTranscriptSessions.delete(lockKey);
    }
  }
);
