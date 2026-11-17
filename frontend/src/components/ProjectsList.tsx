import { useState } from 'react';
import { Search } from 'lucide-react';
import type { ProjectSummary, UserRole } from '../types.ts';

interface ProjectsListProps {
  role: UserRole;
  projects: ProjectSummary[];
  isLoading: boolean;
  error: string | null;
  onSelectProject: (projectId: string) => void;
}

export function ProjectsList({
  role,
  projects,
  isLoading,
  error,
  onSelectProject,
}: ProjectsListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredProjects = normalizedQuery
    ? projects.filter(
        (p) =>
          p.name.toLowerCase().includes(normalizedQuery) ||
          p.clientName.toLowerCase().includes(normalizedQuery) ||
          p.managerName.toLowerCase().includes(normalizedQuery)
      )
    : projects;

  const heading =
    role === 'MANAGER'
      ? 'My Managed Projects'
      : role === 'AGENT'
        ? 'My Projects'
        : 'All Projects';

  const subtitle =
    role === 'MANAGER'
      ? 'Projects assigned to you as Project Manager.'
      : role === 'AGENT'
        ? 'Projects containing tasks assigned to you.'
        : 'All client projects stored in NovaWorks CRM.';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{heading}</h2>
          <p className="mt-0.5 text-sm text-slate-600">{subtitle}</p>
        </div>

        {projects.length > 0 && (
          <div className="relative w-full sm:w-72">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter projects..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
            />
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-40 bg-white border border-slate-200 rounded-xl p-5 animate-pulse"
            >
              <div className="h-4 w-2/3 bg-slate-200 rounded mb-3" />
              <div className="h-3 w-1/2 bg-slate-100 rounded mb-6" />
              <div className="h-3 w-full bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <p className="text-sm font-medium text-slate-900">
            {projects.length === 0 ? 'No visible projects' : 'No matching projects'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {projects.length === 0
              ? 'Projects will appear here once assigned to your role.'
              : 'Try a different search term.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => onSelectProject(project.id)}
              className="text-left bg-white border border-slate-200 hover:border-blue-600 rounded-xl p-5 transition-colors flex flex-col justify-between gap-4 cursor-pointer"
            >
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {project.name}
                </h3>
                <div className="mt-1 text-xs text-slate-500">
                  <span>{project.clientName}</span>
                  <span aria-hidden="true" className="mx-1.5">·</span>
                  <span>Manager: {project.managerName}</span>
                </div>
                {project.description && (
                  <p className="mt-3 text-sm text-slate-600 line-clamp-2">
                    {project.description}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 tabular-nums">
                <span>
                  Due <span className="font-mono font-medium text-slate-900">{project.deadline}</span>
                </span>
                <span className="font-medium text-slate-900">
                  {role === 'AGENT'
                    ? `${project.taskCount} assigned ${project.taskCount === 1 ? 'task' : 'tasks'}`
                    : `${project.taskCount} ${project.taskCount === 1 ? 'task' : 'tasks'}`}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
