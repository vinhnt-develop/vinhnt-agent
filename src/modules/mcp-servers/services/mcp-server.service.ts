import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { McpServerRepository } from '../repositories/mcp-server.repository';

@Injectable()
export class McpServerService {
  constructor(private readonly mcpServerRepository: McpServerRepository) {}

  async findAll() {
    return this.mcpServerRepository.findAll();
  }

  async findEnabled() {
    return this.mcpServerRepository.findEnabled();
  }

  async findById(id: string) {
    const server = await this.mcpServerRepository.findById(id);
    if (!server) {
      throw new NotFoundException('MCP server not found');
    }
    return server;
  }

  async findByName(name: string) {
    return this.mcpServerRepository.findByName(name);
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
    const existing = await this.mcpServerRepository.findByName(data.name);
    if (existing) {
      throw new ConflictException('MCP server with this name already exists');
    }
    return this.mcpServerRepository.create(data);
  }

  async update(id: string, data: {
    name?: string;
    transport?: string;
    command?: string;
    args?: string[];
    url?: string;
    env?: Record<string, string>;
    isEnabled?: boolean;
  }) {
    await this.findById(id);
    if (data.name) {
      const existing = await this.mcpServerRepository.findByName(data.name);
      if (existing && existing.id !== id) {
        throw new ConflictException('MCP server with this name already exists');
      }
    }
    return this.mcpServerRepository.update(id, data);
  }

  async updateConnectionStatus(id: string, toolCount: number) {
    await this.findById(id);
    return this.mcpServerRepository.update(id, {
      toolCount,
      lastConnectedAt: new Date().toISOString(),
    });
  }

  async softDelete(id: string) {
    await this.findById(id);
    await this.mcpServerRepository.softDelete(id);
  }
}
