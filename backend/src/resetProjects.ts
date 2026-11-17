import path from 'path';
import { fileURLToPath } from 'url';
import { db, initSchema } from './db.ts';

export function resetProjectsAndTasks(): { deletedTasks: number; deletedProjects: number } {
  initSchema();
  const clear = db.transaction(() => {
    const taskRes = db.prepare('DELETE FROM tasks').run();
    const projRes = db.prepare('DELETE FROM projects').run();
    return {
      deletedTasks: taskRes.changes,
      deletedProjects: projRes.changes,
    };
  });

  return clear();
}

const isDirectRun =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const result = resetProjectsAndTasks();
  console.log(
    `Reset complete: deleted ${result.deletedProjects} project(s) and ${result.deletedTasks} task(s). Seeded users preserved.`
  );
}
