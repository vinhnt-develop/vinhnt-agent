import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import {
  JsonConfigStore,
  type McpServerJsonConfig,
} from '@/infrastructure/config/json-config-store';
import { MCP_SERVERS_CONFIG } from '@/infrastructure/config/config.module';

@Injectable()
export class McpServerRepository {
  constructor(
    @Inject(MCP_SERVERS_CONFIG) private readonly configStore: JsonConfigStore<McpServerJsonConfig>,
  ) {}

  async findById(id: string) {
    return this.configStore.findById(id) || null;
  }

  async findAll() {
    return this.configStore.findAll();
  }

  async findEnabled() {
    return this.configStore.findAll().filter((s) => s.isEnabled);
  }

  async findByName(name: string) {
    return this.configStore.findAll().find((s) => s.name === name) || null;
  }

  async create(data: {
    name: string;
    transport: string;
    command?: string;
    args?: string[];
    url?: string;
    env?: Record<string, string>;
    isEnabled?: boolean;
  }) {
    const now = new Date().toISOString();
    const config: McpServerJsonConfig = {
      id: uuid(),
      name: data.name,
      transport: data.transport,
      command: data.command ?? null,
      args: data.args ?? null,
      url: data.url ?? null,
      env: data.env ?? {},
      isEnabled: data.isEnabled ?? true,
      toolCount: 0,
      lastConnectedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    return this.configStore.create(config);
  }

  async update(id: string, data: {
    name?: string;
    transport?: string;
    command?: string;
    args?: string[];
    url?: string;
    env?: Record<string, string>;
    isEnabled?: boolean;
    toolCount?: number;
    lastConnectedAt?: string;
  }) {
    const updateData: Partial<McpServerJsonConfig> = {
      updatedAt: new Date().toISOString(),
    };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.transport !== undefined) updateData.transport = data.transport;
    if (data.command !== undefined) updateData.command = data.command;
    if (data.args !== undefined) updateData.args = data.args;
    if (data.url !== undefined) updateData.url = data.url;
    if (data.env !== undefined) updateData.env = data.env;
    if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;
    if (data.toolCount !== undefined) updateData.toolCount = data.toolCount;
    if (data.lastConnectedAt !== undefined) updateData.lastConnectedAt = data.lastConnectedAt;
    return this.configStore.update(id, updateData) || null;
  }

  async softDelete(id: string) {
    this.configStore.delete(id);
  }
}
