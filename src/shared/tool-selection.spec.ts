import {
  isSelectableToolSource,
  resolveSystemToolIds,
  withSystemTools,
} from './tool-selection';

describe('isSelectableToolSource', () => {
  it('selects custom and mcp sources', () => {
    expect(isSelectableToolSource('custom_deploy', 'custom')).toBe(true);
    expect(isSelectableToolSource('mcp__slack', 'mcp')).toBe(true);
  });

  it('rejects system and other sources', () => {
    expect(isSelectableToolSource('read_file', 'system')).toBe(false);
    expect(isSelectableToolSource('memory_search', 'knowledge')).toBe(false);
  });

  it('falls back to id prefixes when source is missing', () => {
    expect(isSelectableToolSource('custom_deploy')).toBe(true);
    expect(isSelectableToolSource('mcp__slack')).toBe(true);
    expect(isSelectableToolSource('read_file')).toBe(false);
  });
});

describe('resolveSystemToolIds', () => {
  it('collects non-selectable defs and appends kernel-only ids', () => {
    const ids = resolveSystemToolIds([
      { id: 'read_file', metadata: { source: 'system' } },
      { name: 'write_file' },
      { id: 'custom_deploy', metadata: { source: 'custom' } },
      { id: 'mcp__slack', metadata: { source: 'mcp' } },
    ]);
    expect(ids).toEqual(['read_file', 'write_file', 'memory_search']);
  });

  it('does not duplicate memory_search when already in defs', () => {
    const ids = resolveSystemToolIds([{ id: 'memory_search' }]);
    expect(ids.filter((id) => id === 'memory_search')).toHaveLength(1);
  });
});

describe('withSystemTools', () => {
  const systemIds = ['read_file', 'shell', 'memory_search'];

  it('passes through undefined selection', () => {
    expect(withSystemTools(undefined, systemIds)).toBeUndefined();
  });

  it('passes through legacy selections without a tools array', () => {
    const selection = { knowledge: [{ id: 'k1' }] };
    expect(withSystemTools(selection, systemIds)).toBe(selection);
  });

  it('expands an empty tools array to system-only whitelist', () => {
    const result = withSystemTools({ tools: [] }, systemIds);
    expect(result?.tools).toEqual([
      { id: 'read_file', enabled: true },
      { id: 'shell', enabled: true },
      { id: 'memory_search', enabled: true },
    ]);
  });

  it('keeps user custom tools and appends system tools', () => {
    const result = withSystemTools(
      { tools: [{ id: 'custom_deploy', name: 'deploy', enabled: true }] },
      systemIds,
    );
    expect(result?.tools).toEqual([
      { id: 'custom_deploy', name: 'deploy', enabled: true },
      { id: 'read_file', enabled: true },
      { id: 'shell', enabled: true },
      { id: 'memory_search', enabled: true },
    ]);
  });

  it('overrides client attempts to disable system tools', () => {
    const result = withSystemTools(
      { tools: [{ id: 'read_file', enabled: false }] },
      systemIds,
    );
    expect(result?.tools).toContainEqual({ id: 'read_file', enabled: true });
    expect(result?.tools).toHaveLength(3);
  });
});
