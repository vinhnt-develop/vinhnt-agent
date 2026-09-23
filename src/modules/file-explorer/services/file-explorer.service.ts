import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: string;
}

@Injectable()
export class FileExplorerService {
  private readonly logger = new Logger(FileExplorerService.name);

  private resolveSafePath(rootDir: string, requestedPath: string): string {
    const resolvedRoot = path.resolve(rootDir);
    const resolved = path.resolve(resolvedRoot, requestedPath);
    if (!resolved.startsWith(resolvedRoot)) {
      throw new Error('Path traversal detected');
    }
    return resolved;
  }

  async getTree(
    rootDir: string,
    requestedPath: string = '.',
  ): Promise<FileTreeNode[]> {
    // Support absolute paths directly (for folder picker)
    const safePath = path.isAbsolute(requestedPath)
      ? requestedPath
      : this.resolveSafePath(rootDir, requestedPath);

    const stat = await fs.stat(safePath);
    if (!stat.isDirectory()) {
      throw new Error('Path is not a directory');
    }

    const entries = await fs.readdir(safePath, { withFileTypes: true });

    const nodes: FileTreeNode[] = [];

    for (const entry of entries) {
      // Skip hidden files/dirs
      if (entry.name.startsWith('.')) continue;

      const fullPath = path.join(safePath, entry.name);
      const relativePath = path.isAbsolute(requestedPath)
        ? fullPath
        : path.relative(rootDir, fullPath);

      try {
        const entryStat = await fs.stat(fullPath);
        nodes.push({
          name: entry.name,
          path: relativePath,
          type: entry.isDirectory() ? 'directory' : 'file',
          size: entry.isDirectory() ? undefined : entryStat.size,
          modifiedAt: entryStat.mtime.toISOString(),
        });
      } catch {
        // Skip files we can't stat
        continue;
      }
    }

    // Sort: directories first, then by name
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
    const safePath = this.resolveSafePath(rootDir, requestedPath);

    const stat = await fs.stat(safePath);
    if (stat.isDirectory()) {
      throw new Error('Cannot read directory as file');
    }

    // Limit to 1MB
    if (stat.size > 1024 * 1024) {
      throw new Error('File too large (max 1MB)');
    }

    const content = await fs.readFile(safePath, 'utf-8');
    const ext = path.extname(safePath).toLowerCase();

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
