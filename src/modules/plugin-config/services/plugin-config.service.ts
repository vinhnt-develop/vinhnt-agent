import { Injectable, NotFoundException } from '@nestjs/common';
import { PluginConfigRepository } from '../repositories/plugin-config.repository';

@Injectable()
export class PluginConfigService {
  constructor(private readonly pluginConfigRepository: PluginConfigRepository) {}

  async findAll() {
    return this.pluginConfigRepository.findAll();
  }

  async findBySource(source: string) {
    return this.pluginConfigRepository.findBySource(source);
  }

  async findById(id: string) {
    const config = await this.pluginConfigRepository.findById(id);
    if (!config) {
      throw new NotFoundException('Plugin config not found');
    }
    return config;
  }

  async findByPluginId(pluginId: string) {
    return this.pluginConfigRepository.findByPluginId(pluginId);
  }

  async findEnabled() {
    return this.pluginConfigRepository.findEnabled();
  }

  async create(data: {
    pluginId: string;
    source: string;
    version?: string;
    config?: Record<string, any>;
    isEnabled?: boolean;
    author?: string;
    repository?: string;
    description?: string;
    dependencies?: string[];
    localPath?: string;
  }) {
    return this.pluginConfigRepository.create(data);
  }

  async update(id: string, data: {
    version?: string;
    config?: Record<string, any>;
    isEnabled?: boolean;
    latestVersion?: string;
  }) {
    await this.findById(id);
    return this.pluginConfigRepository.update(id, data);
  }

  async activate(id: string) {
    return this.update(id, { isEnabled: true });
  }

  async deactivate(id: string) {
    return this.update(id, { isEnabled: false });
  }

  async softDelete(id: string) {
    await this.findById(id);
    await this.pluginConfigRepository.softDelete(id);
  }
}
