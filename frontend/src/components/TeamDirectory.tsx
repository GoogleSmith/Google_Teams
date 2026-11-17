import { useEffect, useState } from 'react';
import { ApiError, fetchUsers } from '../api.ts';
import type { DirectoryUser, UserRole } from '../types.ts';

interface TeamDirectoryProps {
  onUnauthorized: () => void;
}

type RoleFilter = 'ALL' | UserRole;

function formatRole(role: UserRole): string {
  if (role === 'ADMIN') return 'Admin';
  if (role === 'MANAGER') return 'Manager';
  return 'Agent';
}

export function TeamDirectory({ onUnauthorized }: TeamDirectoryProps) {
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    fetchUsers()
      .then((data) => {
        if (active) {
          setUsers(data);
        }
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 401) {
          onUnauthorized();
          return;
        }
        setError(err instanceof Error ? err.message : 'Unable to load team directory.');
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

  const filteredUsers =
    roleFilter === 'ALL' ? users : users.filter((u) => u.role === roleFilter);

  const filterTabs: Array<{ id: RoleFilter; label: string }> = [
    { id: 'ALL', label: 'All Members' },
    { id: 'ADMIN', label: 'Admin' },
    { id: 'MANAGER', label: 'Managers' },
    { id: 'AGENT', label: 'Agents' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Team Directory</h2>
          <p className="mt-0.5 text-sm text-slate-600">
            Read-only company roster used for project management and task assignments.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start sm:self-auto">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setRoleFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                roleFilter === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3 animate-pulse">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="h-9 bg-slate-100 rounded" />
          ))}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-6">ID</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Specialization</th>
                  <th className="py-3 px-6">Skills</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredUsers.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-6 font-mono text-xs font-medium text-slate-600 whitespace-nowrap">
                      {member.id}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                      {member.name}
                    </td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                      {formatRole(member.role)}
                    </td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                      {member.specialization || '—'}
                    </td>
                    <td className="py-3 px-6 text-slate-600">
                      {member.skills.length > 0 ? member.skills.join(' · ') : '—'}
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
