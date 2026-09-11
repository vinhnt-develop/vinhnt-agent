import { Inject, Injectable } from '@nestjs/common';
import { DATABASE_CONNECTION } from '@/infrastructure/database/database-connection';
import { providerConfigs } from '@/modules/agent/schemas/agent.schema';
import { eq, sql, desc, and } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

@Injectable()
export class ProviderConfigRepository {
  private readonly encryptionKey: Buffer;

  constructor(@Inject(DATABASE_CONNECTION) private readonly db: any) {
    const keyStr = process.env.ENCRYPTION_KEY || 'default-dev-key-change-in-production-32b!';
    this.encryptionKey = createHash('sha256').update(keyStr).digest();
  }

  private encrypt(text: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
  }

  private decrypt(encryptedText: string): string {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) return encryptedText;
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const decipher = createDecipheriv(ALGORITHM, this.encryptionKey, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  async findById(id: string) {
    const row = this.db.select().from(providerConfigs).where(eq(providerConfigs.id, id)).get();
    if (row && row.apiKey) {
      return { ...row, apiKey: this.decrypt(row.apiKey) };
    }
    return row;
  }

  async findAll() {
    const rows = this.db
      .select()
      .from(providerConfigs)
      .where(sql`${providerConfigs.deletedAt} IS NULL`)
      .orderBy(desc(providerConfigs.createdAt))
      .all();
    return rows.map((row: any) => ({
      ...row,
      apiKey: row.apiKey ? this.encrypt(this.decrypt(row.apiKey)) : row.apiKey,
    }));
  }

  async findEnabled() {
    const rows = this.db
      .select()
      .from(providerConfigs)
      .where(and(eq(providerConfigs.isActive, true), sql`${providerConfigs.deletedAt} IS NULL`))
      .orderBy(desc(providerConfigs.createdAt))
      .all();
    return rows.map((row: any) => ({
      ...row,
      apiKey: row.apiKey ? this.decrypt(row.apiKey) : row.apiKey,
    }));
  }

  async findDefault() {
    const row = this.db
      .select()
      .from(providerConfigs)
      .where(and(eq(providerConfigs.isDefault, true), eq(providerConfigs.isActive, true), sql`${providerConfigs.deletedAt} IS NULL`))
      .limit(1)
      .get();
    if (row && row.apiKey) {
      return { ...row, apiKey: this.decrypt(row.apiKey) };
    }
    return row;
  }

  async findByProvider(provider: string) {
    const rows = this.db
      .select()
      .from(providerConfigs)
      .where(and(eq(providerConfigs.provider, provider), sql`${providerConfigs.deletedAt} IS NULL`))
      .all();
    return rows.map((row: any) => ({
      ...row,
      apiKey: row.apiKey ? this.decrypt(row.apiKey) : row.apiKey,
    }));
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
    const encryptedApiKey = data.apiKey ? this.encrypt(data.apiKey) : null;

    if (data.isDefault) {
      this.db.update(providerConfigs)
        .set({ isDefault: false })
        .where(eq(providerConfigs.isDefault, true))
        .run();
    }

    this.db.insert(providerConfigs).values({
      id,
      provider: data.provider,
      name: data.name,
      apiKey: encryptedApiKey,
      baseUrl: data.baseUrl,
      defaultModel: data.defaultModel,
      configs: data.configs ?? {},
      pricing: data.pricing ?? {},
      isActive: true,
      isDefault: data.isDefault ?? false,
      createdAt: now,
      updatedAt: now,
    }).run();

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
    const updateData: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.apiKey !== undefined) updateData.apiKey = this.encrypt(data.apiKey);
    if (data.baseUrl !== undefined) updateData.baseUrl = data.baseUrl;
    if (data.defaultModel !== undefined) updateData.defaultModel = data.defaultModel;
    if (data.configs !== undefined) updateData.configs = data.configs;
    if (data.pricing !== undefined) updateData.pricing = data.pricing;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.isDefault !== undefined) {
      updateData.isDefault = data.isDefault;
      if (data.isDefault) {
        this.db.update(providerConfigs)
          .set({ isDefault: false })
          .where(eq(providerConfigs.isDefault, true))
          .run();
      }
    }

    this.db.update(providerConfigs).set(updateData).where(eq(providerConfigs.id, id)).run();
    return this.findById(id);
  }

  async softDelete(id: string) {
    this.db.update(providerConfigs).set({ deletedAt: new Date().toISOString() }).where(eq(providerConfigs.id, id)).run();
  }
}
