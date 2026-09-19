import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

export type DatabaseConnection = ReturnType<typeof drizzle<typeof schema>>;
