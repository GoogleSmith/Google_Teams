import { useEffect, useState } from 'react';
import { ApiError, fetchMyTasks } from '../api.ts';
import type { AgentTaskItem } from '../types.ts';

interface MyTasksProps {
  onSelectProject: (projectId: string) => void;
  onUnauthorized: () => void;
}

export function MyTasks({ onSelectProject, onUnauthorized }: MyTasksProps) {
  const [tasks, setTasks] = useState<AgentTaskItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    fetchMyTasks()
      .then((data) => {
        if (active) {
          setTasks(data);
        }
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 401) {
          onUnauthorized();
          return;
        }
        setError(err instanceof Error ? err.message : 'Unable to load your tasks.');
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [onUnauthorized]);

  const totalHours = tasks.reduce((sum, t) => sum + Number(t.estimatedHours || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">My Tasks</h2>
          <p className="mt-0.5 text-sm text-slate-600">
            All tasks assigned to you across active client projects.
          </p>
        </div>

        {!isLoading && tasks.length > 0 && (
          <div className="text-xs text-slate-600 tabular-nums">
            <span className="font-medium text-slate-900">{tasks.length}</span>{' '}
            {tasks.length === 1 ? 'task' : 'tasks'}
            <span aria-hidden="true" className="mx-1.5">·</span>
            <span className="font-mono font-medium text-slate-900">{totalHours}h</span> total estimate
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3 animate-pulse">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-10 bg-slate-100 rounded" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <p className="text-sm font-medium text-slate-900">No assigned tasks yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Tasks assigned to you from meeting transcripts will appear here.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-6">Task</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Manager</th>
                  <th className="py-3 px-4 text-right">Deadline</th>
                  <th className="py-3 px-6 text-right">Est. Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-6 font-medium text-slate-900 whitespace-nowrap">
                      {task.title}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 max-w-md">
                      {task.description || '—'}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onSelectProject(task.projectId)}
                        className="font-medium text-blue-700 hover:text-blue-900 hover:underline cursor-pointer text-left"
                      >
                        {task.projectName}
                      </button>
                      <div className="text-xs text-slate-500">{task.clientName}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                      {task.managerName}
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
        </div>
      )}
    </div>
  );
}
