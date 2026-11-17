import type {
  AgentTaskItem,
  DirectoryUser,
  ProjectDetail,
  ProjectSummary,
  TranscriptResult,
  UnresolvedField,
  User,
} from './types.ts';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '';
const SESSION_TOKEN_KEY = 'novaworks_session_token';

function getStoredSessionToken(): string | null {
  try {
    return window.sessionStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

function setStoredSessionToken(token: string | null): void {
  try {
    if (token) {
      window.sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch {
    // Ignore storage access errors in restricted contexts
  }
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly unresolvedFields?: UnresolvedField[];

  constructor(message: string, status: number, unresolvedFields?: UnresolvedField[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.unresolvedFields = unresolvedFields;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getStoredSessionToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers['X-Session-Token'] = token;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  });

  let payload: Record<string, unknown> = {};
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    payload = {};
  }

  if (response.status === 401) {
    setStoredSessionToken(null);
  }

  if (!response.ok) {
    const message =
      typeof payload.error === 'string'
        ? payload.error
        : `Request failed with status ${response.status}`;
    const unresolvedFields = Array.isArray(payload.unresolvedFields)
      ? (payload.unresolvedFields as UnresolvedField[])
      : undefined;
    throw new ApiError(message, response.status, unresolvedFields);
  }

  return payload as T;
}

export async function fetchCurrentUser(): Promise<User> {
  const data = await request<{ user: User }>('/api/auth/me');
  return data.user;
}

export async function login(email: string, password: string): Promise<User> {
  const data = await request<{ user: User; sessionToken?: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (data.sessionToken) {
    setStoredSessionToken(data.sessionToken);
  }
  return data.user;
}

export async function logout(): Promise<void> {
  try {
    await request<{ ok: boolean }>('/api/auth/logout', {
      method: 'POST',
    });
  } finally {
    setStoredSessionToken(null);
  }
}

export async function fetchUsers(): Promise<DirectoryUser[]> {
  const data = await request<{ users: DirectoryUser[] }>('/api/users');
  return data.users;
}

export async function fetchProjects(): Promise<ProjectSummary[]> {
  const data = await request<{ projects: ProjectSummary[] }>('/api/projects');
  return data.projects;
}

export async function fetchProjectById(id: string): Promise<ProjectDetail> {
  const data = await request<{ project: ProjectDetail }>(`/api/projects/${encodeURIComponent(id)}`);
  return data.project;
}

export async function fetchMyTasks(): Promise<AgentTaskItem[]> {
  const data = await request<{ tasks: AgentTaskItem[] }>('/api/my-tasks');
  return data.tasks;
}

export async function createFromTranscript(transcript: string): Promise<TranscriptResult> {
  return request<TranscriptResult>('/api/transcripts/create-from-transcript', {
    method: 'POST',
    body: JSON.stringify({ transcript }),
  });
}
