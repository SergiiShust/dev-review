import type { Container } from '../../platform/container.js';
import { WorkspaceRepository } from './repository.js';

/**
 * F1 — workspace service. Where clones live + a summary of cloned repos.
 * Cleanup/re-pull of individual repos is owned by the repos module; this
 * surface only gives the UI an overview.
 */

export interface WorkspaceSummary {
  workspaceId: string;
  cloneDir: string;
  repos: {
    id: string;
    full_name: string;
    clone_path: string | null;
    last_polled_at: string | null;
    cloned: boolean;
  }[];
}

export class WorkspaceService {
  private repos: WorkspaceRepository;

  constructor(private container: Container) {
    this.repos = new WorkspaceRepository(container.db);
  }

  async summary(workspaceId: string): Promise<WorkspaceSummary> {
    const rows = await this.repos.listRepos(workspaceId);
    return {
      workspaceId,
      cloneDir: this.container.config.cloneDir,
      repos: rows.map((r) => ({
        id: r.id,
        full_name: r.fullName,
        clone_path: r.clonePath,
        last_polled_at: r.lastPolledAt?.toISOString() ?? null,
        cloned: Boolean(r.clonePath),
      })),
    };
  }
}
