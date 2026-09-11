import { Inject, Injectable } from '@nestjs/common';
import { DATABASE_CONNECTION } from '@/infrastructure/database/database-connection';
import { credentials } from '@/modules/agent/schemas/agent.schema';
import { eq, sql, desc, and } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

@Injectable()
export class CredentialRepository {
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
    const row = this.db.select().from(credentials).where(eq(credentials.id, id)).get();
    if (row && row.valueEncrypted) {
      return { ...row, value: this.decrypt(row.valueEncrypted) };
    }
    return row;
  }

  async findAll() {
    const rows = this.db
      .select()
      .from(credentials)
      .where(sql`${credentials.deletedAt} IS NULL`)
      .orderBy(desc(credentials.createdAt))
      .all();
    return rows.map((row: any) => ({
      ...row,
      value: row.valueEncrypted ? '***' : null,
    }));
  }

  async findEnabled() {
    const rows = this.db
      .select()
      .from(credentials)
      .where(sql`${credentials.deletedAt} IS NULL`)
      .orderBy(desc(credentials.createdAt))
      .all();
    return rows.map((row: any) => ({
      ...row,
      value: row.valueEncrypted ? this.decrypt(row.valueEncrypted) : null,
    }));
  }

  async findByName(name: string) {
    const row = this.db
      .select()
      .from(credentials)
      .where(eq(credentials.name, name))
      .get();
    if (row && row.valueEncrypted) {
      return { ...row, value: this.decrypt(row.valueEncrypted) };
    }
    return row;
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
    const valueEncrypted = this.encrypt(data.value);

    this.db.insert(credentials).values({
      id,
      name: data.name,
      label: data.label,
      type: data.type,
      valueEncrypted,
      metadata: data.metadata ?? {},
      expiresAt: data.expiresAt,
      createdAt: now,
      updatedAt: now,
    }).run();

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
    const updateData: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.label !== undefined) updateData.label = data.label;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.value !== undefined) updateData.valueEncrypted = this.encrypt(data.value);
    if (data.metadata !== undefined) updateData.metadata = data.metadata;
    if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt;

    this.db.update(credentials).set(updateData).where(eq(credentials.id, id)).run();
    return this.findById(id);
  }

  async softDelete(id: string) {
    this.db.update(credentials).set({ deletedAt: new Date().toISOString() }).where(eq(credentials.id, id)).run();
  }
}
