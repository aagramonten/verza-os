import type { Page, ProjectDto } from './dto.js';
import type {
  Actor,
  AuditRecorder,
  CreateProjectInput,
  ListOptions,
  ProjectRepository,
  UpdateProjectInput,
} from './ports.js';
import { ResourceNotFoundError } from './errors.js';

export interface ProjectServiceDeps {
  projects: ProjectRepository;
  audit: AuditRecorder;
}

/** Project CRUD. Tenant scope comes from the actor (verified token) only. */
export class ProjectService {
  constructor(private readonly deps: ProjectServiceDeps) {}

  async create(actor: Actor, input: CreateProjectInput): Promise<ProjectDto> {
    const project = await this.deps.projects.create(actor.companyId, input);
    await this.audit(actor, 'financials.project.created', project.id);
    return project;
  }

  async list(actor: Actor, options: ListOptions): Promise<Page<ProjectDto>> {
    return this.deps.projects.list(actor.companyId, options);
  }

  async get(actor: Actor, id: string): Promise<ProjectDto> {
    const project = await this.deps.projects.findById(actor.companyId, id);
    if (!project) {
      throw new ResourceNotFoundError('Project');
    }
    return project;
  }

  async update(actor: Actor, id: string, input: UpdateProjectInput): Promise<ProjectDto> {
    const updated = await this.deps.projects.update(actor.companyId, id, input);
    if (!updated) {
      throw new ResourceNotFoundError('Project');
    }
    await this.audit(actor, 'financials.project.updated', id, { fields: Object.keys(input) });
    return updated;
  }

  private audit(
    actor: Actor,
    action: string,
    entityId: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    return this.deps.audit.record({
      actorType: 'ADMIN',
      actorId: actor.userId,
      action,
      entity: 'project',
      entityId,
      ...(data ? { data } : {}),
    });
  }
}
