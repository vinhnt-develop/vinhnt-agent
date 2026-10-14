import type { ContextSourceKey, ContextSourceValue } from '@vinhnt-sdk/core';
import type { MemoryEntry } from '@vinhnt-sdk/schema';

/**
 * Render memory entries as a system-context block (P3.4 — memory as a
 * first-class system-context source instead of a dead helper).
 */
function renderMemoryBlock(entries: MemoryEntry[]): string {
  if (entries.length === 0) return '';
  const lines = entries.map((e) => {
    const value =
      e.value.length > e.charLimit ? `${e.value.slice(0, e.charLimit)}…` : e.value;
    const singleLine = value.replace(/\s+/g, ' ').trim();
    return `- [${e.tier}] ${e.key}: ${singleLine}`;
  });
  return ['## Memory', ...lines].join('\n');
}

/**
 * Create a system-context source backed by `AgentKnowledgeService.buildMemoryBlock`
 * (session/working tiers + knowledge-base entries). Renders nothing when empty.
 */
export function createMemorySource(
  load: () => Promise<MemoryEntry[]>,
): ContextSourceValue<MemoryEntry[]> {
  return {
    key: 'agent.memory' as ContextSourceKey,
    priority: 45,
    async load(): Promise<MemoryEntry[]> {
      try {
        return await load();
      } catch {
        return [];
      }
    },
    renderBaseline: renderMemoryBlock,
    renderUpdate(current, previous) {
      return JSON.stringify(current) === JSON.stringify(previous)
        ? null
        : renderMemoryBlock(current);
    },
    renderRemoval: () => '',
  };
}
