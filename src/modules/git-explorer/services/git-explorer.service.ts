import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface GitStatusFile {
  path: string;
  status: string;
  indexStatus: string;
  workTreeStatus: string;
}

export interface GitLogEntry {
  hash: string;
  message: string;
  author: string;
  date: string;
}

@Injectable()
export class GitExplorerService {
  private readonly logger = new Logger(GitExplorerService.name);

  private async runGit(repoDir: string, args: string[]): Promise<string> {
    try {
      const { stdout } = await execFileAsync('git', args, {
        cwd: repoDir,
        timeout: 10000,
        maxBuffer: 1024 * 1024,
      });
      return stdout.trim();
    } catch (error) {
      this.logger.error(`Git command failed: git ${args.join(' ')}`, error);
      throw new Error(`Git command failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private sanitizePath(filePath: string): string {
    return filePath.replace(/[;&|`$(){}[\]!<>]/g, '');
  }

  async getStatus(repoDir: string): Promise<GitStatusFile[]> {
    const output = await this.runGit(repoDir, ['status', '--porcelain']);

    if (!output) return [];

    return output.split('\n').filter(Boolean).map((line) => {
      const indexStatus = line[0] || ' ';
      const workTreeStatus = line[1] || ' ';
      const filePath = line.substring(3);

      let status = 'M';
      if (indexStatus === '?' && workTreeStatus === '?') status = '?';
      else if (indexStatus === 'A' || workTreeStatus === 'A') status = 'A';
      else if (indexStatus === 'D' || workTreeStatus === 'D') status = 'D';
      else if (indexStatus === 'R' || workTreeStatus === 'R') status = 'R';

      return {
        path: filePath,
        status,
        indexStatus: indexStatus.trim(),
        workTreeStatus: workTreeStatus.trim(),
      };
    });
  }

  async getDiff(repoDir: string, filePath?: string): Promise<string> {
    const args = ['diff'];
    if (filePath) {
      args.push('--', this.sanitizePath(filePath));
    }
    return this.runGit(repoDir, args);
  }

  async getDiffStaged(repoDir: string, filePath?: string): Promise<string> {
    const args = ['diff', '--cached'];
    if (filePath) {
      args.push('--', this.sanitizePath(filePath));
    }
    return this.runGit(repoDir, args);
  }

  async getLog(repoDir: string, limit: number = 20): Promise<GitLogEntry[]> {
    const output = await this.runGit(repoDir, [
      'log',
      `--oneline`,
      `-${limit}`,
      '--format=%H|%s|%an|%ai',
    ]);

    if (!output) return [];

    return output.split('\n').filter(Boolean).map((line) => {
      const [hash, message, author, date] = line.split('|');
      return { hash, message, author, date };
    });
  }
}
