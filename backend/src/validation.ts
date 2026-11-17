import { z } from 'zod';
import { db } from './db.ts';
import type { UserRole } from './types.ts';

export const loginSchema = z.object({
  email: z.string().trim().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

export const createTranscriptSchema = z.object({
  transcript: z.string().trim().min(1, 'Transcript cannot be empty'),
});

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_REGEX.test(value)) {
    return false;
  }
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

const rawTaskShape = z.object({
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  estimatedHours: z.union([z.number(), z.string()]).nullable().optional(),
});

const rawProjectShape = z.object({
  name: z.string().nullable().optional(),
  clientName: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  managerId: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  tasks: z.array(rawTaskShape).nullable().optional(),
});

const rawDraftShape = z.object({
  projects: z.array(rawProjectShape),
});

export interface ValidatedTaskDraft {
  title: string;
  description: string;
  assigneeId: string;
  deadline: string;
  estimatedHours: number;
}

export interface ValidatedProjectDraft {
  name: string;
  clientName: string;
  description: string;
  managerId: string;
  deadline: string;
  tasks: ValidatedTaskDraft[];
}

export interface UnresolvedField {
  path: string;
  message: string;
}

export function validateTranscriptDraft(raw: unknown):
  | { valid: true; projects: ValidatedProjectDraft[] }
  | { valid: false; unresolvedFields: UnresolvedField[] } {
  const shapeCheck = rawDraftShape.safeParse(raw);
  if (!shapeCheck.success) {
    return {
      valid: false,
      unresolvedFields: [
        {
          path: 'projects',
          message: 'AI response must contain a "projects" array.',
        },
      ],
    };
  }

  const rawProjects = shapeCheck.data.projects;
  if (rawProjects.length === 0) {
    return {
      valid: false,
      unresolvedFields: [
        {
          path: 'projects',
          message: 'No projects could be extracted from the transcript.',
        },
      ],
    };
  }

  const users = db
    .prepare('SELECT id, role FROM users')
    .all() as Array<{ id: string; role: UserRole }>;
  const userRoleMap = new Map<string, UserRole>(users.map((u) => [u.id, u.role]));

  const unresolvedFields: UnresolvedField[] = [];
  const validatedProjects: ValidatedProjectDraft[] = [];

  for (let pIdx = 0; pIdx < rawProjects.length; pIdx++) {
    const p = rawProjects[pIdx];
    const pName = typeof p.name === 'string' ? p.name.trim() : '';
    const pLabel = pName ? `Project "${pName}"` : `Project #${pIdx + 1}`;

    if (!pName) {
      unresolvedFields.push({
        path: `projects[${pIdx}].name`,
        message: `${pLabel}: missing project name.`,
      });
    }

    const clientName = typeof p.clientName === 'string' ? p.clientName.trim() : '';
    if (!clientName) {
      unresolvedFields.push({
        path: `projects[${pIdx}].clientName`,
        message: `${pLabel}: missing client name.`,
      });
    }

    const rawManagerId = typeof p.managerId === 'string' ? p.managerId.trim() : '';
    const managerId = rawManagerId.toUpperCase();
    const managerRole = managerId ? userRoleMap.get(managerId) : undefined;
    if (!managerId || managerRole !== 'MANAGER') {
      unresolvedFields.push({
        path: `projects[${pIdx}].managerId`,
        message: `${pLabel}: managerId "${rawManagerId || 'null'}" must reference an existing MANAGER in the team directory.`,
      });
    }

    const projectDeadline = typeof p.deadline === 'string' ? p.deadline.trim() : '';
    const projectDeadlineValid = isValidIsoDate(projectDeadline);
    if (!projectDeadlineValid) {
      unresolvedFields.push({
        path: `projects[${pIdx}].deadline`,
        message: `${pLabel}: invalid or missing deadline "${projectDeadline || 'null'}" (expected YYYY-MM-DD).`,
      });
    }

    const rawTasks = Array.isArray(p.tasks) ? p.tasks : [];
    if (rawTasks.length === 0) {
      unresolvedFields.push({
        path: `projects[${pIdx}].tasks`,
        message: `${pLabel}: must contain at least one task.`,
      });
    }

    const validatedTasks: ValidatedTaskDraft[] = [];
    for (let tIdx = 0; tIdx < rawTasks.length; tIdx++) {
      const t = rawTasks[tIdx];
      const tTitle = typeof t.title === 'string' ? t.title.trim() : '';
      const tLabel = `${pLabel} → ${tTitle ? `Task "${tTitle}"` : `Task #${tIdx + 1}`}`;

      if (!tTitle) {
        unresolvedFields.push({
          path: `projects[${pIdx}].tasks[${tIdx}].title`,
          message: `${tLabel}: missing task title.`,
        });
      }

      const rawAssigneeId = typeof t.assigneeId === 'string' ? t.assigneeId.trim() : '';
      const assigneeId = rawAssigneeId.toUpperCase();
      const assigneeRole = assigneeId ? userRoleMap.get(assigneeId) : undefined;
      if (!assigneeId || assigneeRole !== 'AGENT') {
        unresolvedFields.push({
          path: `projects[${pIdx}].tasks[${tIdx}].assigneeId`,
          message: `${tLabel}: assigneeId "${rawAssigneeId || 'null'}" must reference an existing AGENT in the team directory.`,
        });
      }

      const taskDeadline = typeof t.deadline === 'string' ? t.deadline.trim() : '';
      const taskDeadlineValid = isValidIsoDate(taskDeadline);
      if (!taskDeadlineValid) {
        unresolvedFields.push({
          path: `projects[${pIdx}].tasks[${tIdx}].deadline`,
          message: `${tLabel}: invalid or missing deadline "${taskDeadline || 'null'}" (expected YYYY-MM-DD).`,
        });
      } else if (projectDeadlineValid && taskDeadline > projectDeadline) {
        unresolvedFields.push({
          path: `projects[${pIdx}].tasks[${tIdx}].deadline`,
          message: `${tLabel}: task deadline (${taskDeadline}) cannot be after project deadline (${projectDeadline}).`,
        });
      }

      const parsedHours =
        typeof t.estimatedHours === 'number'
          ? t.estimatedHours
          : typeof t.estimatedHours === 'string' && t.estimatedHours.trim() !== ''
            ? Number(t.estimatedHours)
            : NaN;

      if (!Number.isFinite(parsedHours) || parsedHours <= 0) {
        unresolvedFields.push({
          path: `projects[${pIdx}].tasks[${tIdx}].estimatedHours`,
          message: `${tLabel}: estimatedHours must be a positive number.`,
        });
      }

      validatedTasks.push({
        title: tTitle,
        description: typeof t.description === 'string' ? t.description.trim() : '',
        assigneeId,
        deadline: taskDeadline,
        estimatedHours: parsedHours,
      });
    }

    validatedProjects.push({
      name: pName,
      clientName,
      description: typeof p.description === 'string' ? p.description.trim() : '',
      managerId,
      deadline: projectDeadline,
      tasks: validatedTasks,
    });
  }

  if (unresolvedFields.length > 0) {
    return { valid: false, unresolvedFields };
  }

  return { valid: true, projects: validatedProjects };
}
