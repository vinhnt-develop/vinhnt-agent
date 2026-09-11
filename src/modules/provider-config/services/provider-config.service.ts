import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { ProviderConfigRepository } from '../repositories/provider-config.repository';

@Injectable()
export class ProviderConfigService {
  constructor(private readonly repository: ProviderConfigRepository) {}

  async findAll() {
    return this.repository.findAll();
  }

  async findEnabled() {
    return this.repository.findEnabled();
  }

  async findDefault() {
    return this.repository.findDefault();
  }

  async findByProvider(provider: string) {
    return this.repository.findByProvider(provider);
  }

  async findById(id: string) {
    const config = await this.repository.findById(id);
    if (!config) {
      throw new NotFoundException('Provider config not found');
    }
    return config;
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
    return this.repository.create(data);
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
    await this.findById(id);
    return this.repository.update(id, data);
  }

  async softDelete(id: string) {
    await this.findById(id);
    await this.repository.softDelete(id);
  }
}
