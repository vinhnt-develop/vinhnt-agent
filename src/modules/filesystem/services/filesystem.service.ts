import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import type { Dirent } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { KernelSettingsStore } from '@/shared/kernel-settings.store';
import { isPathInside, isSamePath, pathKey } from '@/shared/path-safety';

const MAX_ENTRIES = 500;

export interface BrowseRoot {
  path: string;
  name: string;
  kind: 'home' | 'workspace' | 'custom';
}

interface AllowedTarget {
  root: BrowseRoot;
  /** Canonical (realpath) target. For missing paths, the nearest real ancestor. */
  canonical: string;
  /** Canonical path of the requested target, even when it does not exist yet. */
  resolved: string;
}

function browseError(
  status: number,
  errorCode: string,
  message: string,
): Record<string, unknown> {
  return { statusCode: status, error: errorCode, errorCode, message };
}

async function isDirectory(target: string): Promise<boolean> {
  try {
    return (await fs.stat(target)).isDirectory();
  } catch {
    return false;
  }
}

async function isReadable(target: string): Promise<boolean> {
  try {
    await fs.access(target, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function isWritable(target: string): Promise<boolean> {
  try {
    await fs.access(target, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

async function canonicalDirectory(target: string): Promise<string | null> {
  try {
    const real = await fs.realpath(target);
    return (await fs.stat(real)).isDirectory() ? real : null;
  } catch {
    return null;
  }
}

@Injectable()
export class FilesystemService {
  constructor(private readonly settingsStore: KernelSettingsStore) {}

  private workspaceRoot(): string {
    return path.resolve(this.settingsStore.getWorkspaceRoot() || '.');
  }

  /**
   * Directories the browser may traverse: the user's home, the configured
   * workspace root, and any extra roots from AGENT_BROWSE_ROOTS
   * (path-delimiter or comma separated). Non-directories are dropped.
   */
  async getRoots(): Promise<BrowseRoot[]> {
    const extra = (process.env.AGENT_BROWSE_ROOTS ?? '')
      .split(path.delimiter)
      .flatMap((part) => part.split(','))
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) =>
        path.isAbsolute(part) ? part : path.resolve(this.workspaceRoot(), part),
      );

    const candidates: Array<{ path: string; kind: BrowseRoot['kind'] }> = [
      { path: process.env.AGENT_BROWSE_HOME || os.homedir(), kind: 'home' },
      { path: this.workspaceRoot(), kind: 'workspace' },
      ...extra.map((entry) => ({ path: entry, kind: 'custom' as const })),
    ];

    const seen = new Set<string>();
    const roots: BrowseRoot[] = [];
    for (const candidate of candidates) {
      const canonical = await canonicalDirectory(candidate.path);
      if (!canonical) continue;
      const key = pathKey(canonical);
      if (seen.has(key)) continue;
      seen.add(key);
      roots.push({
        path: canonical,
        name: path.basename(canonical) || canonical,
        kind: candidate.kind,
      });
    }

    if (roots.length === 0) {
      throw new NotFoundException(
        browseError(
          404,
          'NO_BROWSE_ROOTS',
          'No browsable directories are available on this agent.',
        ),
      );
    }
    return roots;
  }

  private async resolveRequested(input?: string): Promise<string> {
    const raw = (input ?? '').trim();
    if (!raw) return this.workspaceRoot();
    return path.isAbsolute(raw)
      ? path.normalize(raw)
      : path.resolve(this.workspaceRoot(), raw);
  }

  /**
   * Resolve the request to a canonical path and verify it stays inside one of
   * the allowed roots. Symlinks are followed first, so a link inside a root
   * that points outside is rejected.
   */
  private async resolveAllowed(input?: string): Promise<AllowedTarget> {
    const requested = await this.resolveRequested(input);

    let canonical: string;
    try {
      canonical = await fs.realpath(requested);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code !== 'ENOENT' && code !== 'ENOTDIR') {
        throw new ForbiddenException(
          browseError(403, 'PATH_NOT_ALLOWED', `Cannot resolve path: ${requested}`),
        );
      }

      // Missing target: validate through the nearest existing ancestor.
      let probe = requested;
      for (;;) {
        try {
          await fs.stat(probe);
          break;
        } catch {
          const parent = path.dirname(probe);
          if (parent === probe) break;
          probe = parent;
        }
      }
      let realProbe: string;
      try {
        realProbe = await fs.realpath(probe);
      } catch {
        throw new ForbiddenException(
          browseError(403, 'PATH_NOT_ALLOWED', `Cannot resolve path: ${requested}`),
        );
      }
      const remainder = path.relative(probe, requested);
      const resolved = remainder ? path.join(realProbe, remainder) : realProbe;
      const roots = await this.getRoots();
      const root = roots.find((entry) => isPathInside(entry.path, realProbe));
      if (!root || !isPathInside(root.path, resolved)) {
        throw new ForbiddenException(
          browseError(
            403,
            'PATH_NOT_ALLOWED',
            `Path is outside the allowed roots: ${requested}`,
          ),
        );
      }
      return { root, canonical: realProbe, resolved };
    }

    const roots = await this.getRoots();
    const root = roots.find((entry) => isPathInside(entry.path, canonical));
    if (!root) {
      throw new ForbiddenException(
        browseError(
          403,
          'PATH_NOT_ALLOWED',
          `Path is outside the allowed roots: ${requested}`,
        ),
      );
    }
    return { root, canonical, resolved: canonical };
  }

  async listDirectories(input?: string) {
    const requested = await this.resolveRequested(input);
    const { root, canonical } = await this.resolveAllowed(input);

    let entries: Dirent[];
    try {
      if (!(await isDirectory(canonical))) {
        throw new BadRequestException(
          browseError(400, 'NOT_A_DIRECTORY', `${requested} is not a directory`),
        );
      }
      entries = await fs.readdir(canonical, { withFileTypes: true });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new ForbiddenException(
        browseError(403, 'DIRECTORY_UNREADABLE', `Cannot read ${requested}`),
      );
    }

    const directoryEntries = entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .slice(0, MAX_ENTRIES)
      .map((entry) => ({
        name: entry.name,
        path: path.join(canonical, entry.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const isRoot = isSamePath(canonical, root.path);
    let parent: string | undefined;
    if (!isRoot) {
      const candidate = path.dirname(canonical);
      const roots = await this.getRoots();
      if (roots.some((entry) => isPathInside(entry.path, candidate))) {
        parent = candidate;
      }
    }

    return {
      path: canonical,
      parent,
      isRoot,
      canCreate: await isWritable(canonical),
      entries: directoryEntries,
    };
  }

  async validateDirectory(input: string) {
    const requested = await this.resolveRequested(input);
    const { resolved } = await this.resolveAllowed(input);

    let stat: Awaited<ReturnType<typeof fs.stat>>;
    try {
      stat = await fs.stat(resolved);
    } catch {
      return {
        path: requested,
        exists: false,
        isDirectory: false,
        readable: false,
        writable: false,
      };
    }

    const isDir = stat.isDirectory();
    return {
      path: resolved,
      exists: true,
      isDirectory: isDir,
      readable: isDir ? await isReadable(resolved) : true,
      writable: isDir ? await isWritable(resolved) : false,
    };
  }

  async createFolder(parent: string, name: string) {
    const trimmed = name.trim();
    if (
      !trimmed ||
      trimmed === '.' ||
      trimmed === '..' ||
      /[\\/:*?"<>|]/.test(trimmed)
    ) {
      throw new BadRequestException(
        browseError(400, 'INVALID_FOLDER_NAME', 'Folder name is not valid'),
      );
    }

    const { canonical } = await this.resolveAllowed(parent);
    if (!(await isDirectory(canonical))) {
      throw new BadRequestException(
        browseError(400, 'NOT_A_DIRECTORY', `${parent} is not a directory`),
      );
    }

    const target = path.join(canonical, trimmed);
    try {
      await fs.mkdir(target);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code === 'EEXIST') {
        throw new ConflictException(
          browseError(409, 'FOLDER_EXISTS', `Folder already exists: ${target}`),
        );
      }
      throw new BadRequestException(
        browseError(400, 'FOLDER_CREATE_FAILED', `Cannot create folder: ${target}`),
      );
    }

    return { path: target };
  }
}
