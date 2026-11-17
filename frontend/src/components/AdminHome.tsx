import { useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileText,
  Loader2,
  Search,
} from 'lucide-react';
import { ApiError, createFromTranscript } from '../api.ts';
import { SAMPLE_MEETING_TRANSCRIPT } from '../sampleTranscript.ts';
import type { ProjectSummary, TranscriptResult, UnresolvedField } from '../types.ts';

interface AdminHomeProps {
  projects: ProjectSummary[];
  isLoadingProjects: boolean;
  projectsError: string | null;
  onSelectProject: (projectId: string) => void;
  onProjectsCreated: () => Promise<void>;
}

export function AdminHome({
  projects,
  isLoadingProjects,
  projectsError,
  onSelectProject,
  onProjectsCreated,
}: AdminHomeProps) {
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [unresolvedFields, setUnresolvedFields] = useState<UnresolvedField[]>([]);
  const [successResult, setSuccessResult] = useState<TranscriptResult | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isProcessing) return;

    const trimmed = transcript.trim();
    if (!trimmed) {
      setErrorMessage('Please paste a meeting transcript before creating projects.');
      setUnresolvedFields([]);
      setSuccessResult(null);
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setUnresolvedFields([]);
    setSuccessResult(null);

    try {
      const result = await createFromTranscript(trimmed);
      setSuccessResult(result);
      await onProjectsCreated();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
        setUnresolvedFields(err.unresolvedFields ?? []);
      } else {
        setErrorMessage('An unexpected error occurred while processing the transcript.');
        setUnresolvedFields([]);
      }
    } finally {
      setIsProcessing(false);
    }
  }

  function handleLoadSample() {
    setTranscript(SAMPLE_MEETING_TRANSCRIPT);
    setErrorMessage(null);
    setUnresolvedFields([]);
  }

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredProjects = normalizedQuery
    ? projects.filter(
        (p) =>
          p.name.toLowerCase().includes(normalizedQuery) ||
          p.clientName.toLowerCase().includes(normalizedQuery) ||
          p.managerName.toLowerCase().includes(normalizedQuery)
      )
    : projects;

  return (
    <div className="space-y-8">
      {/* Create from Transcript Panel */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Create from Transcript
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">
              Paste a planning meeting transcript. AI extracts projects, tasks, assignees, deadlines, and effort hours using the company directory.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLoadSample}
            disabled={isProcessing}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
          >
            <FileText className="h-3.5 w-3.5 text-slate-600" />
            <span>Load sample transcript</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="transcript-input" className="sr-only">
              Meeting Transcript
            </label>
            <textarea
              id="transcript-input"
              rows={9}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              disabled={isProcessing}
              placeholder="Paste the full meeting transcript here..."
              className="w-full p-3.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700 disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                <div className="space-y-2">
                  <p className="font-medium">{errorMessage}</p>
                  {unresolvedFields.length > 0 && (
                    <ul className="list-disc pl-5 space-y-1 text-xs text-red-800">
                      {unresolvedFields.map((item, idx) => (
                        <li key={`${item.path}-${idx}`}>
                          <span className="font-mono font-medium">{item.path}:</span>{' '}
                          {item.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {successResult && (
            <div
              role="status"
              className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
            >
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                <div className="space-y-2">
                  <p className="font-semibold">{successResult.message}</p>
                  <div className="flex flex-wrap gap-3 text-xs">
                    {successResult.projects.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onSelectProject(p.id)}
                        className="inline-flex items-center gap-1 font-medium text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
                      >
                        <span>
                          {p.name} ({p.taskCount} tasks)
                        </span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isProcessing || !transcript.trim()}
              className="min-h-[42px] inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
            >
              {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>
                {isProcessing
                  ? 'Creating projects and tasks...'
                  : 'Create from Transcript'}
              </span>
            </button>

            {transcript.length > 0 && !isProcessing && (
              <button
                type="button"
                onClick={() => {
                  setTranscript('');
                  setErrorMessage(null);
                  setUnresolvedFields([]);
                }}
                className="min-h-[42px] px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer whitespace-nowrap"
              >
                Clear
              </button>
            )}
          </div>
        </form>
      </section>

      {/* All Projects Grid */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              All Projects
            </h2>
            <p className="text-xs text-slate-500 tabular-nums">
              {projects.length} {projects.length === 1 ? 'project' : 'projects'} saved in workspace
            </p>
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

        {projectsError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {projectsError}
          </div>
        )}

        {isLoadingProjects ? (
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
              {projects.length === 0
                ? 'No projects yet'
                : 'No matching projects found'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {projects.length === 0
                ? 'Paste a meeting transcript above and click Create from Transcript to generate projects and tasks.'
                : 'Try adjusting your search filter.'}
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
                    {project.taskCount} {project.taskCount === 1 ? 'task' : 'tasks'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
