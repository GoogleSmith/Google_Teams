import { useCallback, useEffect, useState } from 'react';
import {
  ApiError,
  fetchCurrentUser,
  fetchProjects,
  logout,
} from './api.ts';
import { AdminHome } from './components/AdminHome.tsx';
import { Layout, type NavRoute } from './components/Layout.tsx';
import { LoginPage } from './components/LoginPage.tsx';
import { MyTasks } from './components/MyTasks.tsx';
import { ProjectDetail } from './components/ProjectDetail.tsx';
import { ProjectsList } from './components/ProjectsList.tsx';
import { TeamDirectory } from './components/TeamDirectory.tsx';
import type { ProjectSummary, User } from './types.ts';

function defaultRouteForRole(role: User['role']): NavRoute {
  if (role === 'ADMIN') return 'home';
  if (role === 'MANAGER') return 'projects';
  return 'my-tasks';
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [route, setRoute] = useState<NavRoute>('home');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  const handleUnauthorized = useCallback(() => {
    setUser(null);
    setProjects([]);
    setSelectedProjectId(null);
  }, []);

  const loadProjects = useCallback(async () => {
    setIsLoadingProjects(true);
    setProjectsError(null);
    try {
      const list = await fetchProjects();
      setProjects(list);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        handleUnauthorized();
        return;
      }
      setProjectsError(
        err instanceof Error ? err.message : 'Unable to load projects.'
      );
    } finally {
      setIsLoadingProjects(false);
    }
  }, [handleUnauthorized]);

  useEffect(() => {
    let active = true;
    fetchCurrentUser()
      .then((me) => {
        if (!active) return;
        setUser(me);
        setRoute(defaultRouteForRole(me.role));
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
      })
      .finally(() => {
        if (active) {
          setIsCheckingSession(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (user) {
      void loadProjects();
    }
  }, [user, loadProjects]);

  function handleLoginSuccess(loggedInUser: User) {
    setUser(loggedInUser);
    setSelectedProjectId(null);
    setRoute(defaultRouteForRole(loggedInUser.role));
  }

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // Clear local session state even if network request fails
    }
    handleUnauthorized();
  }

  function handleNavigate(nextRoute: NavRoute) {
    setRoute(nextRoute);
    if (nextRoute !== 'project-detail') {
      setSelectedProjectId(null);
    }
    if (nextRoute === 'home' || nextRoute === 'projects') {
      void loadProjects();
    }
  }

  function handleSelectProject(projectId: string) {
    setSelectedProjectId(projectId);
    setRoute('project-detail');
  }

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm font-medium text-slate-600">
          Loading workspace...
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  function getPageTitle(): string {
    if (route === 'home') return 'Admin Workspace';
    if (route === 'projects') {
      if (user?.role === 'MANAGER') return 'My Projects';
      return 'Projects';
    }
    if (route === 'project-detail') return 'Project Details';
    if (route === 'my-tasks') return 'My Tasks';
    return 'Team Directory';
  }

  return (
    <Layout
      user={user}
      activeRoute={route}
      pageTitle={getPageTitle()}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
    >
      {route === 'home' && user.role === 'ADMIN' && (
        <AdminHome
          projects={projects}
          isLoadingProjects={isLoadingProjects}
          projectsError={projectsError}
          onSelectProject={handleSelectProject}
          onProjectsCreated={loadProjects}
        />
      )}

      {route === 'projects' && (
        <ProjectsList
          role={user.role}
          projects={projects}
          isLoading={isLoadingProjects}
          error={projectsError}
          onSelectProject={handleSelectProject}
        />
      )}

      {route === 'project-detail' && selectedProjectId && (
        <ProjectDetail
          projectId={selectedProjectId}
          role={user.role}
          onBack={() =>
            handleNavigate(user.role === 'ADMIN' ? 'home' : 'projects')
          }
          onUnauthorized={handleUnauthorized}
        />
      )}

      {route === 'my-tasks' && (
        <MyTasks
          onSelectProject={handleSelectProject}
          onUnauthorized={handleUnauthorized}
        />
      )}

      {route === 'team' && (
        <TeamDirectory onUnauthorized={handleUnauthorized} />
      )}
    </Layout>
  );
}
