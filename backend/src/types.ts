export type UserRole = 'ADMIN' | 'MANAGER' | 'AGENT';

export interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  specialization: string | null;
  skills: string;
}

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  specialization: string;
  skills: string[];
}

export interface DirectoryUser {
  id: string;
  name: string;
  role: UserRole;
  specialization: string;
  skills: string[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  clientName: string;
  description: string;
  managerId: string;
  managerName: string;
  deadline: string;
  createdAt: string;
  taskCount: number;
}

export interface TaskItem {
  id: string;
  projectId: string;
  title: string;
  description: string;
  assigneeId: string;
  assigneeName: string;
  assigneeSpecialization: string;
  deadline: string;
  estimatedHours: number;
}

export interface ProjectDetail extends ProjectSummary {
  tasks: TaskItem[];
}

export interface AgentTaskItem extends TaskItem {
  projectName: string;
  clientName: string;
  projectDeadline: string;
  managerId: string;
  managerName: string;
}
