import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { CredentialRepository } from '../repositories/credential.repository';

@Injectable()
export class CredentialService {
  constructor(private readonly repository: CredentialRepository) {}

  async findAll() {
    return this.repository.findAll();
  }

  async findEnabled() {
    return this.repository.findEnabled();
  }

  async findById(id: string) {
    const credential = await this.repository.findById(id);
    if (!credential) {
      throw new NotFoundException('Credential not found');
    }
    return credential;
  }

  async findByName(name: string) {
    return this.repository.findByName(name);
  }

  async create(data: {
    name: string;
    label?: string;
    type: string;
    value: string;
    metadata?: Record<string, unknown>;
    expiresAt?: string;
  }) {
    const existing = await this.repository.findByName(data.name);
    if (existing) {
      throw new ConflictException('Credential with this name already exists');
    }
    return this.repository.create(data);
  }

  async update(id: string, data: {
    name?: string;
    label?: string;
    type?: string;
    value?: string;
    metadata?: Record<string, unknown>;
    expiresAt?: string;
  }) {
    await this.findById(id);
    if (data.name) {
      const existing = await this.repository.findByName(data.name);
      if (existing && existing.id !== id) {
        throw new ConflictException('Credential with this name already exists');
      }
    }
    return this.repository.update(id, data);
  }

  async softDelete(id: string) {
    await this.findById(id);
    await this.repository.softDelete(id);
  }
}
