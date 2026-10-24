import { AgentKnowledgeService } from './agent-knowledge.service';

interface StoredItem {
  key: string;
  value: string;
  sessionId: string;
  tier: string;
  tags: string[];
  scope?: string;
  userId?: string;
  appId?: string;
}

class FakeMemoryStore {
  readonly items: StoredItem[] = [];

  async set(item: StoredItem): Promise<StoredItem> {
    this.items.push(item);
    return item;
  }
  async get(): Promise<undefined> {
    return undefined;
  }
  async list(): Promise<StoredItem[]> {
    return this.items;
  }
  async count(): Promise<number> {
    return this.items.length;
  }
  async search(): Promise<StoredItem[]> {
    return [];
  }
  async listByTier(): Promise<StoredItem[]> {
    return [];
  }
  async delete(): Promise<void> {}
  async deleteAll(): Promise<void> {}
}

function createService(store: FakeMemoryStore) {
  return new AgentKnowledgeService(store as never, { findAll: async () => [] } as never);
}

describe('AgentKnowledgeService memory scope', () => {
  it('writes learned facts with the caller user scope', async () => {
    const store = new FakeMemoryStore();
    const service = createService(store);

    await service.setWorkingFact('session-1', 'name', 'Alice', { userId: 'user-1' });

    expect(store.items).toHaveLength(1);
    expect(store.items[0]).toMatchObject({ scope: 'user', userId: 'user-1' });
  });

  it('isolates two users sharing a session id', async () => {
    const store = new FakeMemoryStore();
    const service = createService(store);

    await service.setWorkingFact('session-1', 'name', 'Alice', { userId: 'user-1' });
    await service.setWorkingFact('session-1', 'name', 'Bob', { userId: 'user-2' });
    service.clearWorking('session-1', { userId: 'user-1' });

    const alice = await service.buildMemoryBlock('session-1', undefined, { userId: 'user-1' });
    const bob = await service.buildMemoryBlock('session-1', undefined, { userId: 'user-2' });
    const aliceWorking = alice.find((entry) => entry.key === '_working')?.value ?? '';
    const bobWorking = bob.find((entry) => entry.key === '_working')?.value ?? '';

    expect(aliceWorking).toBe('');
    expect(bobWorking).toContain('Bob');
    expect(store.items.map((item) => item.userId)).toEqual(['user-1', 'user-2']);
  });

  it('keeps the legacy session scope when no owner is supplied', async () => {
    const store = new FakeMemoryStore();
    const service = createService(store);

    await service.setWorkingFact('session-1', 'name', 'Alice');

    expect(store.items[0]).toMatchObject({ sessionId: '_global' });
    expect(store.items[0].scope).toBeUndefined();
  });

  it('disposes every scoped engine of a session', async () => {
    const store = new FakeMemoryStore();
    const service = createService(store);

    await service.setWorkingFact('session-1', 'name', 'Alice', { userId: 'user-1' });
    service.dispose('session-1');

    const block = await service.buildMemoryBlock('session-1', undefined, { userId: 'user-1' });
    expect(block.find((entry) => entry.key === '_working')?.value ?? '').toBe('');
  });
});
