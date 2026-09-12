import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import {
  JsonConfigStore,
  type CustomToolJsonConfig,
} from '@/infrastructure/config/json-config-store';
import { CUSTOM_TOOLS_CONFIG } from '@/infrastructure/config/config.module';

@Injectable()
export class CustomToolRepository {
  constructor(
    @Inject(CUSTOM_TOOLS_CONFIG) private readonly configStore: JsonConfigStore<CustomToolJsonConfig>,
  ) {}

  async findById(id: string) {
    return this.configStore.findById(id) || null;
  }

  async findAll() {
    return this.configStore.findAll();
  }

  async findActive() {
    return this.configStore.findAll().filter((t) => t.isActive);
  }

  async create(data: {
    name: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
    handlerType?: string;
    handlerConfig?: Record<string, unknown>;
    timeoutMs?: number;
  }) {
    const now = new Date().toISOString();
    const config: CustomToolJsonConfig = {
      id: uuid(),
      name: data.name,
      description: data.description ?? null,
      inputSchema: data.inputSchema ?? {},
      handlerType: data.handlerType ?? 'webhook',
      handlerConfig: data.handlerConfig ?? {},
      timeoutMs: data.timeoutMs ?? 30000,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    return this.configStore.create(config);
  }

  async update(id: string, data: {
    name?: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
    handlerType?: string;
    handlerConfig?: Record<string, unknown>;
    timeoutMs?: number;
    isActive?: boolean;
  }) {
    const updateData: Partial<CustomToolJsonConfig> = {
      updatedAt: new Date().toISOString(),
    };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.inputSchema !== undefined) updateData.inputSchema = data.inputSchema;
    if (data.handlerType !== undefined) updateData.handlerType = data.handlerType;
    if (data.handlerConfig !== undefined) updateData.handlerConfig = data.handlerConfig;
    if (data.timeoutMs !== undefined) updateData.timeoutMs = data.timeoutMs;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    return this.configStore.update(id, updateData) || null;
  }

  async softDelete(id: string) {
    this.configStore.delete(id);
  }
}
