/**
 * Pure helpers for run tool-selection policy.
 *
 * Policy (webui + agent must agree):
 * - A tool is user-selectable only when it comes from custom or MCP sources.
 * - System tools (built-ins, kernel-only tools like memory_search) are always
 *   active: the agent force-includes them in every run selection whitelist.
 * - A selection without a `tools` array (legacy client) is passed through
 *   untouched — the kernel treats that as "no whitelist" (all tools allowed).
 */

export interface SelectionToolEntry {
  id: string;
  name?: string;
  enabled?: boolean;
}

export interface RunSelection {
  tools?: SelectionToolEntry[];
  knowledge?: Array<{ id: string; key?: string; enabled?: boolean }>;
  plugins?: string[];
}

export function isSelectableToolSource(id: string, source?: string): boolean {
  if (source === 'custom' || source === 'mcp') return true;
  if (source) return false;
  return id.startsWith('custom_') || id.startsWith('mcp__');
}

/** System tool ids from raw toolkit definitions plus kernel-only ids. */
export function resolveSystemToolIds(
  defs: Array<{ id?: string; name?: string; metadata?: { source?: string } }>,
  kernelOnlyIds: string[] = ['memory_search'],
): string[] {
  const ids: string[] = [];
  for (const def of defs) {
    const id = def.id || def.name;
    if (!id) continue;
    if (!isSelectableToolSource(id, def.metadata?.source)) ids.push(id);
  }
  for (const extra of kernelOnlyIds) {
    if (!ids.includes(extra)) ids.push(extra);
  }
  return ids;
}

/**
 * Force-include system tools in a run selection. The kernel treats a non-empty
 * `selection.tools` as a whitelist, so system ids are appended (deduped,
 * always enabled) — they can never be filtered out or disabled.
 * Returns the selection unchanged when `tools` is absent (legacy client).
 */
export function withSystemTools(
  selection: RunSelection | undefined,
  systemToolIds: string[],
): RunSelection | undefined {
  if (!selection || selection.tools === undefined) return selection;
  const systemSet = new Set(systemToolIds);
  const userTools = selection.tools.filter((t) => t && !systemSet.has(t.id));
  const systemTools: SelectionToolEntry[] = systemToolIds.map((id) => ({ id, enabled: true }));
  return { ...selection, tools: [...userTools, ...systemTools] };
}
