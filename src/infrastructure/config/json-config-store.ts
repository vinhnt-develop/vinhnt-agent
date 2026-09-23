import * as fs from 'node:fs';
import * as path from 'node:path';
import { Logger } from '@nestjs/common';

export interface ProviderJsonConfig {
  id: string;
  provider: string;
  name: string;
  apiKey: string | null;
  baseUrl: string | null;
  configs: Record<string, unknown>;
  pricing: Record<string, unknown>;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface McpServerJsonConfig {
  id: string;
  name: string;
  transport: string;
  command: string | null;
  args: string[] | null;
  url: string | null;
  env: Record<string, string>;
  isEnabled: boolean;
  toolCount: number;
  lastConnectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomToolJsonConfig {
  id: string;
  name: string;
  description: string | null;
  inputSchema: Record<string, unknown>;
  handlerType: string;
  handlerConfig: Record<string, unknown>;
  timeoutMs: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CredentialJsonConfig {
  id: string;
  name: string;
  label: string | null;
  type: string;
  value: string;
  metadata: Record<string, unknown>;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/**
 * Generic JSON config store.
 * Reads/writes a JSON array to a file. Each item must have an `id` field.
 */
export class JsonConfigStore<T extends { id: string }> {
  private readonly logger = new Logger(JsonConfigStore.name);
  private readonly filePath: string;
  private cache: T[] | null = null;

  constructor(configDir: string, filename: string) {
    this.filePath = path.join(configDir, filename);
    this.ensureFile();
  }

  private ensureFile(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, '[]', 'utf-8');
    }
  }

  private read(): T[] {
    if (this.cache) return this.cache;
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      this.cache = JSON.parse(raw) as T[];
      return this.cache;
    } catch (error) {
      this.logger.warn(`Failed to read ${this.filePath}, using empty array`);
      this.cache = [];
      return this.cache;
    }
  }

  private write(data: T[]): void {
    this.cache = data;
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  findAll(): T[] {
    return this.read();
  }

  findById(id: string): T | undefined {
    return this.read().find((item) => item.id === id);
  }

  create(item: T): T {
    const items = this.read();
    items.push(item);
    this.write(items);
    return item;
  }

  update(id: string, data: Partial<T>): T | undefined {
    const items = this.read();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return undefined;
    items[index] = { ...items[index], ...data, id } as T;
    this.write(items);
    return items[index];
  }

  delete(id: string): boolean {
    const items = this.read();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return false;
    items.splice(index, 1);
    this.write(items);
    return true;
  }

  /** Force reload from disk (e.g., after external edit) */
  reload(): void {
    this.cache = null;
  }
}

/**
 * Resolve `apiKey` that may be an `env:VAR_NAME` reference.
 * Returns the raw value when not an env ref, or null when env is missing.
 */
export function resolveApiKeyRef(apiKey: string | null | undefined): string | null {
  if (!apiKey) return null;
  if (apiKey.startsWith('env:')) {
    const varName = apiKey.slice(4).trim();
    const value = process.env[varName];
    if (!value) {
      return null;
    }
    return value;
  }
  return apiKey;
}
