import { Injectable, NotFoundException } from '@nestjs/common';
import { CustomToolRepository } from '../repositories/custom-tool.repository';

@Injectable()
export class CustomToolService {
  constructor(private readonly customToolRepository: CustomToolRepository) {}

  async findAll() {
    return this.customToolRepository.findAll();
  }

  async findActive() {
    return this.customToolRepository.findActive();
  }

  async findById(id: string) {
    const tool = await this.customToolRepository.findById(id);
    if (!tool) {
      throw new NotFoundException('Custom tool not found');
    }
    return tool;
  }

  async create(data: {
    name: string;
    description?: string;
    inputSchema?: Record<string, any>;
    handlerType?: string;
    handlerConfig?: Record<string, any>;
    timeoutMs?: number;
  }) {
    return this.customToolRepository.create(data);
  }

  async update(id: string, data: {
    name?: string;
    description?: string;
    inputSchema?: Record<string, any>;
    handlerType?: string;
    handlerConfig?: Record<string, any>;
    timeoutMs?: number;
    isActive?: boolean;
  }) {
    await this.findById(id);
    return this.customToolRepository.update(id, data);
  }

  async softDelete(id: string) {
    await this.findById(id);
    await this.customToolRepository.softDelete(id);
  }
}
