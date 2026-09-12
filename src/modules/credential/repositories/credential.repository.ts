import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import {
  JsonConfigStore,
  type CredentialJsonConfig,
} from '@/infrastructure/config/json-config-store';
import { CREDENTIALS_CONFIG } from '@/infrastructure/config/config.module';

@Injectable()
export class CredentialRepository {
  constructor(
    @Inject(CREDENTIALS_CONFIG) private readonly configStore: JsonConfigStore<CredentialJsonConfig>,
  ) {}

  async findById(id: string) {
    const item = this.configStore.findById(id);
    if (!item || item.deletedAt) return null;
    return item;
  }

  async findAll() {
    return this.configStore.findAll()
      .filter((c) => !c.deletedAt)
      .map((c) => ({ ...c, value: c.value ? '***' : null }));
  }

  async findEnabled() {
    return this.configStore.findAll().filter((c) => !c.deletedAt);
  }

  async findByName(name: string) {
    const item = this.configStore.findAll().find((c) => c.name === name && !c.deletedAt);
    return item || null;
  }

  async create(data: {
    name: string;
    label?: string;
    type: string;
    value: string;
    metadata?: Record<string, unknown>;
    expiresAt?: string;
  }) {
    const id = uuid();
    const now = new Date().toISOString();

    const config: CredentialJsonConfig = {
      id,
      name: data.name,
      label: data.label ?? null,
      type: data.type,
      value: data.value,
      metadata: data.metadata ?? {},
      expiresAt: data.expiresAt ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    this.configStore.create(config);
    return this.findById(id);
  }

  async update(id: string, data: {
    name?: string;
    label?: string;
    type?: string;
    value?: string;
    metadata?: Record<string, unknown>;
    expiresAt?: string;
  }) {
    const updateData: Partial<CredentialJsonConfig> = { updatedAt: new Date().toISOString() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.label !== undefined) updateData.label = data.label;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.value !== undefined) updateData.value = data.value;
    if (data.metadata !== undefined) updateData.metadata = data.metadata;
    if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt;

    this.configStore.update(id, updateData);
    return this.findById(id);
  }

  async softDelete(id: string) {
    this.configStore.update(id, { deletedAt: new Date().toISOString() });
  }
}
