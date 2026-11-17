import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { ApiError, fetchProjectById } from '../api.ts';
import type { ProjectDetail as ProjectDetailType, UserRole } from '../types.ts';

interface ProjectDetailProps {
  projectId: string;
  role: UserRole;
  onBack: () => void;
  onUnauthorized: () => void;
}

export function ProjectDetail({
  projectId,
  role,
  onBack,
  onUnauthorized,
}: ProjectDetailProps) {
  const [project, setProject] = useState<ProjectDetailType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    fetchProjectById(projectId)
      .then((data) => {
        if (active) {
          setProject(data);
        }
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 401) {
          onUnauthorized();
          return;
        }
        setError(err instanceof Error ? err.message : 'Unable to load project.');
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [projectId, onUnauthorized]);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-5 w-32 bg-slate-200 rounded" />
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <div className="h-6 w-1/3 bg-slate-200 rounded" />
          <div className="h-4 w-1/2 bg-slate-100 rounded" />
          <div className="h-12 w-full bg-slate-100 rounded" />
        </div>
        <div className="h-64 bg-white border border-slate-200 rounded-xl" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to projects</span>
        </button>

        <div className="bg-white border border-red-200 rounded-xl p-6 text-sm text-red-800">
          {error || 'Project not found.'}
        </div>
      </div>
    );
  }

  const totalVisibleHours = project.tasks.reduce(
    (sum, t) => sum + Number(t.estimatedHours || 0),
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to projects</span>
        </button>
      </div>

      {/* Project Summary Header */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              {project.name}
            </h2>
            {project.description && (
              <p className="text-sm text-slate-600 leading-relaxed">
                {project.description}
              </p>
            )}
          </div>

          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 lg:gap-6 pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-100 shrink-0">
            <div>
              <dt className="text-xs text-slate-500">Client</dt>
              <dd className="mt-0.5 text-sm font-semibold text-slate-900">
                {project.clientName}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Manager</dt>
              <dd className="mt-0.5 text-sm font-semibold text-slate-900">
                {project.managerName}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Deadline</dt>
              <dd className="mt-0.5 text-sm font-mono font-semibold text-slate-900 tabular-nums">
                {project.deadline}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">
                {role === 'AGENT' ? 'Your Est. Hours' : 'Total Est. Hours'}
              </dt>
              <dd className="mt-0.5 text-sm font-mono font-semibold text-slate-900 tabular-nums">
                {totalVisibleHours}h
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Tasks Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              {role === 'AGENT' ? 'Your Assigned Tasks' : 'Project Tasks'}
            </h3>
            {role === 'AGENT' && (
              <p className="text-xs text-slate-500 mt-0.5">
                Showing only tasks assigned to you in this project.
              </p>
            )}
          </div>
          <span className="text-xs font-medium text-slate-600 tabular-nums">
            {project.tasks.length} {project.tasks.length === 1 ? 'task' : 'tasks'}
          </span>
        </div>

        {project.tasks.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No tasks found for this project.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-6">Title</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Assignee</th>
                  <th className="py-3 px-4 text-right">Deadline</th>
                  <th className="py-3 px-6 text-right">Est. Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {project.tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-6 font-medium text-slate-900 whitespace-nowrap">
                      {task.title}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 max-w-md">
                      {task.description || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-900 whitespace-nowrap">
                      <div>{task.assigneeName}</div>
                      {task.assigneeSpecialization && (
                        <div className="text-xs text-slate-500">
                          {task.assigneeSpecialization}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-xs font-medium text-slate-800 tabular-nums whitespace-nowrap">
                      {task.deadline}
                    </td>
                    <td className="py-3.5 px-6 text-right font-mono text-sm font-medium text-slate-900 tabular-nums whitespace-nowrap">
                      {task.estimatedHours}h
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
