import { Injectable } from '@nestjs/common';

/**
 * Cross-module snapshot of saved kernel settings (SC3 design point).
 *
 * ProjectPathService lives in shared/ and must read the SAVED workspaceRoot
 * (kernel-settings.json > env seed > '.') without importing modules/agent —
 * AgentModule already imports ProjectPathModule, so a reverse import would
 * create a module cycle.
 *
 * Single writer: AgentSettingsService syncs after every load/save.
 * Modules under modules/agent (AgentService, AgentToolkit) inject
 * AgentSettingsService directly instead of going through this store.
 */
@Injectable()
export class KernelSettingsStore {
  private workspaceRoot = '.';
  private browseRoots: string[] = [];
  private browseHome = '';

  /** Saved workspaceRoot — valid for file/git explorers + project path fallback. */
  getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }

  setWorkspaceRoot(root: string): void {
    this.workspaceRoot = root && root.trim() ? root : '.';
  }

  /** Saved extra browse roots (empty = only home/workspace). */
  getBrowseRoots(): readonly string[] {
    return this.browseRoots;
  }

  setBrowseRoots(roots: readonly string[]): void {
    this.browseRoots = roots.map((root) => root.trim()).filter(Boolean);
  }

  /** Saved home shortcut ('' = OS home). */
  getBrowseHome(): string {
    return this.browseHome;
  }

  setBrowseHome(home: string): void {
    this.browseHome = home?.trim() ?? '';
  }
}
