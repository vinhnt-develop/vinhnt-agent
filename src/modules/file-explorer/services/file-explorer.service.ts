import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { isPathInside } from '@/shared/path-safety';

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: string;
}

const MAX_ENTRIES = 1000;

@Injectable()
export class FileExplorerService {
  /**
   * Resolve a requested path against the project/workspace root, following
   * symlinks, and refuse anything that escapes the canonical root. Absolute
   * paths are accepted only when they still land inside the root.
   */
  private async resolveInsideRoot(
    rootDir: string,
    requestedPath: string,
  ): Promise<{ root: string; target: string }> {
    let root: string;
    try {
      root = await fs.realpath(path.resolve(rootDir));
    } catch {
      throw new NotFoundException({
        statusCode: 404,
        error: 'ROOT_NOT_FOUND',
        errorCode: 'ROOT_NOT_FOUND',
        message: `Root directory is not available: ${rootDir}`,
      });
    }

    const candidate = path.isAbsolute(requestedPath)
      ? path.normalize(requestedPath)
      : path.resolve(root, requestedPath);

    let target: string;
    try {
      target = await fs.realpath(candidate);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code === 'ENOENT' || code === 'ENOTDIR') {
        throw new NotFoundException({
          statusCode: 404,
          error: 'PATH_NOT_FOUND',
          errorCode: 'PATH_NOT_FOUND',
          message: `Path does not exist: ${requestedPath}`,
        });
      }
      throw new BadRequestException({
        statusCode: 400,
          error: 'PATH_UNREADABLE',
          errorCode: 'PATH_UNREADABLE',
        message: `Cannot resolve path: ${requestedPath}`,
      });
    }

    if (!isPathInside(root, target)) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'PATH_OUTSIDE_ROOT',
        errorCode: 'PATH_OUTSIDE_ROOT',
        message: 'Path is outside the project directory',
      });
    }

    return { root, target };
  }

  private toTreePath(root: string, target: string): string {
    return path.relative(root, target).split(path.sep).join('/');
  }

  async getTree(
    rootDir: string,
    requestedPath: string = '.',
  ): Promise<FileTreeNode[]> {
    const { root, target } = await this.resolveInsideRoot(
      rootDir,
      requestedPath,
    );

    const stat = await fs.stat(target);
    if (!stat.isDirectory()) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'NOT_A_DIRECTORY',
        errorCode: 'NOT_A_DIRECTORY',
        message: 'Path is not a directory',
      });
    }

    const entries = await fs.readdir(target, { withFileTypes: true });
    const nodes: FileTreeNode[] = [];

    for (const entry of entries.slice(0, MAX_ENTRIES)) {
      if (entry.name.startsWith('.')) continue;

      const fullPath = path.join(target, entry.name);
      try {
        const entryStat = await fs.stat(fullPath);
        nodes.push({
          name: entry.name,
          path: this.toTreePath(root, fullPath),
          type: entry.isDirectory() ? 'directory' : 'file',
          size: entry.isDirectory() ? undefined : entryStat.size,
          modifiedAt: entryStat.mtime.toISOString(),
        });
      } catch {
        // Skip entries we can't stat (broken links, permissions).
        continue;
      }
    }

    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return nodes;
  }

  async getFileContent(
    rootDir: string,
    requestedPath: string,
  ): Promise<{ content: string; size: number; mimeType: string }> {
    const { target } = await this.resolveInsideRoot(rootDir, requestedPath);

    const stat = await fs.stat(target);
    if (stat.isDirectory()) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'NOT_A_FILE',
        errorCode: 'NOT_A_FILE',
        message: 'Cannot read directory as file',
      });
    }

    if (stat.size > 1024 * 1024) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'FILE_TOO_LARGE',
        errorCode: 'FILE_TOO_LARGE',
        message: 'File too large (max 1MB)',
      });
    }

    const content = await fs.readFile(target, 'utf-8');
    const ext = path.extname(target).toLowerCase();

    const mimeMap: Record<string, string> = {
      '.ts': 'text/typescript',
      '.tsx': 'text/typescript',
      '.js': 'text/javascript',
      '.jsx': 'text/javascript',
      '.json': 'application/json',
      '.md': 'text/markdown',
      '.css': 'text/css',
      '.html': 'text/html',
      '.py': 'text/x-python',
      '.go': 'text/x-go',
      '.rs': 'text/x-rust',
      '.java': 'text/x-java',
      '.yaml': 'text/yaml',
      '.yml': 'text/yaml',
      '.toml': 'text/toml',
      '.sql': 'text/sql',
      '.sh': 'text/x-shellscript',
      '.bash': 'text/x-shellscript',
      '.env': 'text/plain',
      '.txt': 'text/plain',
      '.xml': 'text/xml',
      '.csv': 'text/csv',
    };

    return {
      content,
      size: stat.size,
      mimeType: mimeMap[ext] || 'text/plain',
    };
  }
}
