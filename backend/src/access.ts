import { db } from './db.ts';
import type {
  AgentTaskItem,
  DirectoryUser,
  ProjectDetail,
  ProjectSummary,
  SafeUser,
  TaskItem,
  UserRole,
  UserRow,
} from './types.ts';

function parseSkills(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function toSafeUser(row: UserRow): SafeUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    specialization: row.specialization ?? '',
    skills: parseSkills(row.skills),
  };
}

export function getTeamDirectory(): DirectoryUser[] {
  const rows = db
    .prepare(
      `SELECT id, name, role, specialization, skills
       FROM users
       ORDER BY CASE role WHEN 'ADMIN' THEN 0 WHEN 'MANAGER' THEN 1 ELSE 2 END, id ASC`
    )
    .all() as Array<{
    id: string;
    name: string;
    role: UserRole;
    specialization: string | null;
    skills: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    role: r.role,
    specialization: r.specialization ?? '',
    skills: parseSkills(r.skills),
  }));
}

interface ProjectQueryRow {
  id: string;
  name: string;
  client_name: string;
  description: string | null;
  manager_id: string;
  manager_name: string;
  deadline: string;
  created_at: string;
  task_count: number;
}

function mapProjectSummary(row: ProjectQueryRow): ProjectSummary {
  return {
    id: row.id,
    name: row.name,
    clientName: row.client_name,
    description: row.description ?? '',
    managerId: row.manager_id,
    managerName: row.manager_name,
    deadline: row.deadline,
    createdAt: row.created_at,
    taskCount: Number(row.task_count),
  };
}

export function getProjects(user: SafeUser): ProjectSummary[] {
  if (user.role === 'ADMIN') {
    const rows = db
      .prepare(
        `SELECT p.id, p.name, p.client_name, p.description, p.manager_id,
                m.name AS manager_name, p.deadline, p.created_at,
                COUNT(t.id) AS task_count
         FROM projects p
         JOIN users m ON m.id = p.manager_id
         LEFT JOIN tasks t ON t.project_id = p.id
         GROUP BY p.id
         ORDER BY p.created_at DESC, p.deadline ASC, p.name ASC`
      )
      .all() as ProjectQueryRow[];
    return rows.map(mapProjectSummary);
  }

  if (user.role === 'MANAGER') {
    const rows = db
      .prepare(
        `SELECT p.id, p.name, p.client_name, p.description, p.manager_id,
                m.name AS manager_name, p.deadline, p.created_at,
                COUNT(t.id) AS task_count
         FROM projects p
         JOIN users m ON m.id = p.manager_id
         LEFT JOIN tasks t ON t.project_id = p.id
         WHERE p.manager_id = ?
         GROUP BY p.id
         ORDER BY p.created_at DESC, p.deadline ASC, p.name ASC`
      )
      .all(user.id) as ProjectQueryRow[];
    return rows.map(mapProjectSummary);
  }

  // AGENT: distinct projects that contain at least one task assigned to them.
  // task_count only counts the agent's own visible tasks so other agents' tasks are not leaked.
  const rows = db
    .prepare(
      `SELECT p.id, p.name, p.client_name, p.description, p.manager_id,
              m.name AS manager_name, p.deadline, p.created_at,
              COUNT(t.id) AS task_count
       FROM projects p
       JOIN users m ON m.id = p.manager_id
       JOIN tasks t ON t.project_id = p.id AND t.assignee_id = ?
       GROUP BY p.id
       ORDER BY p.created_at DESC, p.deadline ASC, p.name ASC`
    )
    .all(user.id) as ProjectQueryRow[];

  return rows.map(mapProjectSummary);
}

interface TaskQueryRow {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  assignee_id: string;
  assignee_name: string;
  assignee_specialization: string | null;
  deadline: string;
  estimated_hours: number;
}

function mapTaskItem(row: TaskQueryRow): TaskItem {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description ?? '',
    assigneeId: row.assignee_id,
    assigneeName: row.assignee_name,
    assigneeSpecialization: row.assignee_specialization ?? '',
    deadline: row.deadline,
    estimatedHours: Number(row.estimated_hours),
  };
}

export function getTasks(user: SafeUser, projectId: string): TaskItem[] {
  if (user.role === 'ADMIN') {
    const rows = db
      .prepare(
        `SELECT t.id, t.project_id, t.title, t.description, t.assignee_id,
                u.name AS assignee_name, u.specialization AS assignee_specialization,
                t.deadline, t.estimated_hours
         FROM tasks t
         JOIN users u ON u.id = t.assignee_id
         WHERE t.project_id = ?
         ORDER BY t.deadline ASC, t.title ASC`
      )
      .all(projectId) as TaskQueryRow[];
    return rows.map(mapTaskItem);
  }

  if (user.role === 'MANAGER') {
    const rows = db
      .prepare(
        `SELECT t.id, t.project_id, t.title, t.description, t.assignee_id,
                u.name AS assignee_name, u.specialization AS assignee_specialization,
                t.deadline, t.estimated_hours
         FROM tasks t
         JOIN projects p ON p.id = t.project_id
         JOIN users u ON u.id = t.assignee_id
         WHERE t.project_id = ? AND p.manager_id = ?
         ORDER BY t.deadline ASC, t.title ASC`
      )
      .all(projectId, user.id) as TaskQueryRow[];
    return rows.map(mapTaskItem);
  }

  const rows = db
    .prepare(
      `SELECT t.id, t.project_id, t.title, t.description, t.assignee_id,
              u.name AS assignee_name, u.specialization AS assignee_specialization,
              t.deadline, t.estimated_hours
       FROM tasks t
       JOIN users u ON u.id = t.assignee_id
       WHERE t.project_id = ? AND t.assignee_id = ?
       ORDER BY t.deadline ASC, t.title ASC`
    )
    .all(projectId, user.id) as TaskQueryRow[];
  return rows.map(mapTaskItem);
}

export function getProjectById(user: SafeUser, projectId: string): ProjectDetail | null {
  const visibleProjects = getProjects(user);
  const project = visibleProjects.find((p) => p.id === projectId);
  if (!project) {
    return null;
  }

  const tasks = getTasks(user, projectId);
  return {
    ...project,
    tasks,
  };
}

export function getMyTasks(user: SafeUser): AgentTaskItem[] {
  const rows = db
    .prepare(
      `SELECT t.id, t.project_id, t.title, t.description, t.assignee_id,
              u.name AS assignee_name, u.specialization AS assignee_specialization,
              t.deadline, t.estimated_hours,
              p.name AS project_name, p.client_name, p.deadline AS project_deadline,
              p.manager_id, m.name AS manager_name
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       JOIN users u ON u.id = t.assignee_id
       JOIN users m ON m.id = p.manager_id
       WHERE t.assignee_id = ?
       ORDER BY t.deadline ASC, p.name ASC, t.title ASC`
    )
    .all(user.id) as Array<
    TaskQueryRow & {
      project_name: string;
      client_name: string;
      project_deadline: string;
      manager_id: string;
      manager_name: string;
    }
  >;

  return rows.map((r) => ({
    ...mapTaskItem(r),
    projectName: r.project_name,
    clientName: r.client_name,
    projectDeadline: r.project_deadline,
    managerId: r.manager_id,
    managerName: r.manager_name,
  }));
}
