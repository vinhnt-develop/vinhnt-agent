import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  ProjectPathService,
  projectDirectoryError,
} from './project-path.service';

describe('ProjectPathService', () => {
  let tmp: string;
  let missing: string;
  let sessionRepository: { findById: jest.Mock };
  let projectRepository: { findById: jest.Mock };
  let service: ProjectPathService;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vinhnt-project-'));
    missing = path.join(tmp, 'deleted-project');
    sessionRepository = { findById: jest.fn() };
    projectRepository = { findById: jest.fn() };
    service = new ProjectPathService(
      sessionRepository as never,
      projectRepository as never,
      { getWorkspaceRoot: () => tmp } as never,
    );
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('resolves an existing project directory', async () => {
    sessionRepository.findById.mockResolvedValue({ projectId: 'p1' });
    projectRepository.findById.mockResolvedValue({ directory: tmp });

    await expect(service.resolveDetails('s1')).resolves.toMatchObject({
      path: path.normalize(tmp),
      source: 'project',
      status: 'ok',
    });
  });

  it('reports a configured but missing project directory', async () => {
    sessionRepository.findById.mockResolvedValue({ projectId: 'p1' });
    projectRepository.findById.mockResolvedValue({ directory: missing });

    await expect(service.resolveDetails('s1')).resolves.toMatchObject({
      path: path.normalize(missing),
      source: 'project',
      status: 'missing',
    });
  });

  it('falls back to the workspace root when the project has no directory', async () => {
    sessionRepository.findById.mockResolvedValue({ projectId: 'p1' });
    projectRepository.findById.mockResolvedValue({ directory: null });

    await expect(service.resolveDetails('s1')).resolves.toMatchObject({
      source: 'workspace',
      status: 'ok',
    });
  });

  it('throws 409 instead of silently using the workspace root for a missing project directory', async () => {
    sessionRepository.findById.mockResolvedValue({ projectId: 'p1' });
    projectRepository.findById.mockResolvedValue({ directory: missing });

    await expect(service.resolveOrFallback('s1')).rejects.toMatchObject({
      response: {
        errorCode: 'PROJECT_DIRECTORY_MISSING',
        details: { status: 'missing' },
      },
    });
  });

  it('builds an actionable error payload', () => {
    expect(
      projectDirectoryError({
        path: missing,
        source: 'project',
        status: 'missing',
        directory: missing,
      }),
    ).toMatchObject({
      errorCode: 'PROJECT_DIRECTORY_MISSING',
      details: { path: missing, status: 'missing' },
    });
  });
});
