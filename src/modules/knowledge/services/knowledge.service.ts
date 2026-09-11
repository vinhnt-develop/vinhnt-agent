import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { KnowledgeRepository } from '../repositories/knowledge.repository';

@Injectable()
export class KnowledgeService {
  constructor(private readonly knowledgeRepository: KnowledgeRepository) {}

  async findAll() {
    return this.knowledgeRepository.findAll();
  }

  async findBySource(source: string) {
    return this.knowledgeRepository.findBySource(source);
  }

  async findById(id: string) {
    const entry = await this.knowledgeRepository.findById(id);
    if (!entry) {
      throw new NotFoundException('Knowledge entry not found');
    }
    return entry;
  }

  async search(query: string) {
    return this.knowledgeRepository.search(query);
  }

  async create(data: {
    key: string;
    value: string;
    source: string;
    sourceRef?: string;
    tier?: string;
    tags?: string[];
    isEditable?: boolean;
  }) {
    const existing = await this.knowledgeRepository.findByKeyAndSource(data.key, data.source);
    if (existing) {
      throw new ConflictException('Knowledge entry with this key and source already exists');
    }
    return this.knowledgeRepository.create(data);
  }

  async update(id: string, data: {
    key?: string;
    value?: string;
    source?: string;
    sourceRef?: string;
    tier?: string;
    tags?: string[];
    isEditable?: boolean;
  }) {
    await this.findById(id);
    if (data.key && data.source) {
      const existing = await this.knowledgeRepository.findByKeyAndSource(data.key, data.source);
      if (existing && existing.id !== id) {
        throw new ConflictException('Knowledge entry with this key and source already exists');
      }
    }
    return this.knowledgeRepository.update(id, data);
  }

  async softDelete(id: string) {
    await this.findById(id);
    await this.knowledgeRepository.softDelete(id);
  }
}
