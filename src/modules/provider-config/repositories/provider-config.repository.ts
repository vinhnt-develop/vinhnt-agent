import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import {
  JsonConfigStore,
  type ProviderJsonConfig,
} from '@/infrastructure/config/json-config-store';
import { PROVIDERS_CONFIG } from '@/infrastructure/config/config.module';

@Injectable()
export class ProviderConfigRepository {
  constructor(
    @Inject(PROVIDERS_CONFIG) private readonly configStore: JsonConfigStore<ProviderJsonConfig>,
  ) {}

  async findById(id: string) {
    return this.configStore.findById(id) || null;
  }

  async findAll() {
    return this.configStore.findAll();
  }

  async findEnabled() {
    return this.configStore.findAll().filter((c) => c.isActive);
  }

  async findDefault() {
    return this.configStore.findAll().find((c) => c.isDefault && c.isActive) || null;
  }

  async findByProvider(provider: string) {
    return this.configStore.findAll().filter((c) => c.provider === provider);
  }

  async create(data: {
    provider: string;
    name: string;
    apiKey?: string;
    baseUrl?: string;
    defaultModel?: string;
    configs?: Record<string, unknown>;
    pricing?: Record<string, unknown>;
    isDefault?: boolean;
  }) {
    const id = uuid();
    const now = new Date().toISOString();

    if (data.isDefault) {
      const all = this.configStore.findAll();
      for (const c of all) {
        if (c.isDefault) this.configStore.update(c.id, { isDefault: false });
      }
    }

    const config: ProviderJsonConfig = {
      id,
      provider: data.provider,
      name: data.name,
      apiKey: data.apiKey ?? null,
      baseUrl: data.baseUrl ?? null,
      defaultModel: data.defaultModel ?? null,
      configs: data.configs ?? {},
      pricing: data.pricing ?? {},
      isActive: true,
      isDefault: data.isDefault ?? false,
      createdAt: now,
      updatedAt: now,
    };

    this.configStore.create(config);
    return this.findById(id);
  }

  async update(id: string, data: {
    name?: string;
    apiKey?: string;
    baseUrl?: string;
    defaultModel?: string;
    configs?: Record<string, unknown>;
    pricing?: Record<string, unknown>;
    isActive?: boolean;
    isDefault?: boolean;
  }) {
    const now = new Date().toISOString();
    const updateData: Partial<ProviderJsonConfig> = { updatedAt: now };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.apiKey !== undefined) updateData.apiKey = data.apiKey;
    if (data.baseUrl !== undefined) updateData.baseUrl = data.baseUrl;
    if (data.defaultModel !== undefined) updateData.defaultModel = data.defaultModel;
    if (data.configs !== undefined) updateData.configs = data.configs;
    if (data.pricing !== undefined) updateData.pricing = data.pricing;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    if (data.isDefault !== undefined) {
      updateData.isDefault = data.isDefault;
      if (data.isDefault) {
        const all = this.configStore.findAll();
        for (const c of all) {
          if (c.isDefault && c.id !== id) this.configStore.update(c.id, { isDefault: false });
        }
      }
    }

    this.configStore.update(id, updateData);
    return this.findById(id);
  }

  async softDelete(id: string) {
    this.configStore.delete(id);
  }
}
