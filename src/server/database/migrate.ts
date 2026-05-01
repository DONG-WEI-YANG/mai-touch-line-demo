/**
 * Database Migration Tool
 * 支持多種數據庫的遷移工具
 */

import fs from 'fs';
import path from 'path';
import { sql } from 'drizzle-orm';
import { dbManager, DatabaseType } from './adapter';

export interface MigrationFile {
  version: string;
  filename: string;
  sql: string;
}

/**
 * 讀取遷移文件
 */
export function readMigrationFiles(dbType: DatabaseType): MigrationFile[] {
  const migrationsDir = path.join(process.cwd(), 'migrations', dbType);
  
  if (!fs.existsSync(migrationsDir)) {
    console.warn(`[Migration] No migrations directory found for ${dbType}`);
    return [];
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  return files.map(filename => {
    const filePath = path.join(migrationsDir, filename);
    const sql = fs.readFileSync(filePath, 'utf-8');
    const version = filename.split('_')[0];

    return { version, filename, sql };
  });
}

/**
 * 創建遷移記錄表
 */
async function createMigrationsTable(db: any, dbType: DatabaseType): Promise<void> {
  const createTableSql = dbType === 'sqlite'
    ? `CREATE TABLE IF NOT EXISTS _migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version TEXT NOT NULL UNIQUE,
        filename TEXT NOT NULL,
        appliedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    : dbType === 'postgres'
    ? `CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        version VARCHAR(255) NOT NULL UNIQUE,
        filename VARCHAR(255) NOT NULL,
        appliedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    : `CREATE TABLE IF NOT EXISTS _migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        version VARCHAR(255) NOT NULL UNIQUE,
        filename VARCHAR(255) NOT NULL,
        appliedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`;

  try {
    await db.run(sql.raw(createTableSql));
  } catch (error) {
    // Table might already exist
    console.log('[Migration] Migrations table already exists or error:', error);
  }
}

/**
 * 獲取已應用的遷移
 */
async function getAppliedMigrations(db: any): Promise<string[]> {
  try {
    const result = await db.all(sql.raw('SELECT version FROM _migrations ORDER BY version'));
    return result?.map((r: any) => r.version) || [];
  } catch (error) {
    return [];
  }
}

/**
 * 記錄遷移
 */
async function recordMigration(db: any, migration: MigrationFile): Promise<void> {
  await db.run(
    sql`INSERT INTO _migrations (version, filename) VALUES (${migration.version}, ${migration.filename})`
  );
}

/**
 * 執行遷移
 */
export async function runMigrations(): Promise<void> {
  console.log('[Migration] Starting database migration...');

  try {
    // 連接數據庫
    const adapter = await dbManager.connect();
    const db = adapter.db;
    const dbType = adapter.type;

    console.log(`[Migration] Database type: ${dbType}`);

    // 創建遷移記錄表
    await createMigrationsTable(db, dbType);

    // 讀取遷移文件
    const migrations = readMigrationFiles(dbType);
    console.log(`[Migration] Found ${migrations.length} migration files`);

    if (migrations.length === 0) {
      console.log('[Migration] No migrations to apply');
      return;
    }

    // 獲取已應用的遷移
    const appliedMigrations = await getAppliedMigrations(db);
    console.log(`[Migration] ${appliedMigrations.length} migrations already applied`);

    // 過濾出未應用的遷移
    const pendingMigrations = migrations.filter(
      m => !appliedMigrations.includes(m.version)
    );

    if (pendingMigrations.length === 0) {
      console.log('[Migration] Database is up to date');
      return;
    }

    console.log(`[Migration] Applying ${pendingMigrations.length} pending migrations...`);

    // 應用遷移
    for (const migration of pendingMigrations) {
      console.log(`[Migration] Applying ${migration.filename}...`);

      try {
        if (dbType === 'sqlite') {
          const Database = require('better-sqlite3');
          const dbConfig = require('./adapter').parseDatabaseConfig();
          const sqliteDb = new Database(dbConfig.filename || './data/mai-touch.db');
          sqliteDb.exec(migration.sql);
          sqliteDb.close();
        } else {
          // 移除單行註解並分割 SQL 語句
          const cleanSql = migration.sql.replace(/--.*$/gm, '');
          const statements = cleanSql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);
  
          // 執行每個語句
          for (const statement of statements) {
            await db.run(sql.raw(statement));
          }
        }

        // 記錄遷移
        await recordMigration(db, migration);
        console.log(`[Migration] ✓ Applied ${migration.filename}`);
      } catch (error) {
        console.error(`[Migration] ✗ Failed to apply ${migration.filename}:`, error);
        throw error;
      }
    }

    console.log('[Migration] All migrations applied successfully');
  } catch (error) {
    console.error('[Migration] Migration failed:', error);
    throw error;
  }
}

/**
 * 回滾最後一次遷移（僅用於開發）
 */
export async function rollbackLastMigration(): Promise<void> {
  console.log('[Migration] Rolling back last migration...');
  console.warn('[Migration] WARNING: Rollback is not fully implemented. Manual intervention may be required.');
  
  // TODO: 實現回滾邏輯
  // 這需要為每個遷移創建對應的回滾 SQL
}

/**
 * 重置數據庫（僅用於開發）
 */
export async function resetDatabase(): Promise<void> {
  console.log('[Migration] Resetting database...');
  console.warn('[Migration] WARNING: This will delete all data!');

  const adapter = await dbManager.connect();
  const db = adapter.db;
  void adapter.type; // Reserved for future dialect-specific reset logic

  // 刪除所有表
  const tables = [
    'sessions',
    'chat_messages',
    'work_orders',
    'bookings',
    'amenities',
    'users',
    '_migrations'
  ];

  for (const table of tables) {
    try {
      await db.run(sql.raw(`DROP TABLE IF EXISTS ${table}`));
      console.log(`[Migration] Dropped table: ${table}`);
    } catch (error) {
      console.warn(`[Migration] Failed to drop table ${table}:`, error);
    }
  }

  console.log('[Migration] Database reset complete');
}

// CLI 支持
if (require.main === module) {
  const command = process.argv[2];

  (async () => {
    try {
      switch (command) {
        case 'up':
        case 'migrate':
          await runMigrations();
          break;
        case 'rollback':
          await rollbackLastMigration();
          break;
        case 'reset':
          await resetDatabase();
          break;
        default:
          console.log('Usage: ts-node migrate.ts [up|rollback|reset]');
          console.log('  up/migrate - Apply pending migrations');
          console.log('  rollback   - Rollback last migration');
          console.log('  reset      - Reset database (WARNING: deletes all data)');
      }
      process.exit(0);
    } catch (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }
  })();
}