/**
 * Simple Database Migration System
 * 使用原始 better-sqlite3 API
 */

import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';

interface MigrationFile {
  version: string;
  filename: string;
  sql: string;
}

/**
 * 獲取原始 SQLite 連接
 */
function getRawSqliteDb(dbPath: string): Database.Database {
  // 確保目錄存在
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  return new Database(dbPath);
}

/**
 * 創建遷移表
 */
function createMigrationsTable(db: Database.Database): void {
  const createTableSql = `
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version VARCHAR(255) NOT NULL UNIQUE,
      filename VARCHAR(255) NOT NULL,
      appliedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
  
  db.prepare(createTableSql).run();
  console.log('[Migration] Migrations table created/verified');
}

/**
 * 獲取已應用的遷移
 */
function getAppliedMigrations(db: Database.Database): string[] {
  try {
    const stmt = db.prepare('SELECT version FROM _migrations ORDER BY version');
    const rows = stmt.all() as Array<{ version: string }>;
    return rows.map(r => r.version);
  } catch (error) {
    return [];
  }
}

/**
 * 記錄遷移
 */
function recordMigration(db: Database.Database, migration: MigrationFile): void {
  const stmt = db.prepare('INSERT INTO _migrations (version, filename) VALUES (?, ?)');
  stmt.run(migration.version, migration.filename);
}

/**
 * 讀取遷移文件
 */
function readMigrationFiles(migrationsDir: string): MigrationFile[] {
  if (!fs.existsSync(migrationsDir)) {
    console.log(`[Migration] Migrations directory not found: ${migrationsDir}`);
    return [];
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  return files.map(filename => {
    const filePath = path.join(migrationsDir, filename);
    const sql = fs.readFileSync(filePath, 'utf-8');
    // Use the numeric prefix as the version to stay consistent with migrate.ts
    // (the canonical runner used at boot + db:init). Recording the full filename
    // here would make the two runners disagree and double-apply every migration.
    const version = filename.split('_')[0];

    return { version, filename, sql };
  });
}

/**
 * 執行遷移
 */
export async function runSimpleMigrations(dbPath: string): Promise<void> {
  console.log('[Migration] Starting simple database migration...');
  console.log('[Migration] Database path:', dbPath);

  const db = getRawSqliteDb(dbPath);

  try {
    // 創建遷移表
    createMigrationsTable(db);

    // 讀取遷移文件
    const migrationsDir = path.join(process.cwd(), 'migrations', 'sqlite');
    const migrations = readMigrationFiles(migrationsDir);
    console.log(`[Migration] Found ${migrations.length} migration files`);

    if (migrations.length === 0) {
      console.log('[Migration] No migration files found');
      return;
    }

    // 獲取已應用的遷移
    const appliedMigrations = getAppliedMigrations(db);
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
        // 使用 exec 執行整個 SQL 文件（支持多語句）
        db.exec(migration.sql);

        // 記錄遷移
        recordMigration(db, migration);

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
  } finally {
    db.close();
  }
}

/**
 * 初始化示例數據
 */
export async function seedDatabase(dbPath: string): Promise<void> {
  console.log('[Seed] Seeding database...');

  const db = getRawSqliteDb(dbPath);

  try {
    // 檢查是否已有數據
    let userCount = 0;
    try {
      const result = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
      userCount = result.count;
    } catch (error) {
      console.log('[Seed] Users table not found, skipping seed');
      return;
    }
    
    if (userCount > 0) {
      console.log('[Seed] Database already has data, skipping seed');
      return;
    }

    // 插入示例用戶
    const insertUser = db.prepare(`
      INSERT INTO users (openId, name, email, role, createdAt, updatedAt, lastSignedIn)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertUser.run(
      'demo-user-001',
      'Admin User',
      'admin@example.com',
      'admin',
      new Date().toISOString(),
      new Date().toISOString(),
      new Date().toISOString()
    );

    insertUser.run(
      'demo-user-002',
      'Test User',
      'user@example.com',
      'resident',
      new Date().toISOString(),
      new Date().toISOString(),
      new Date().toISOString()
    );

    console.log('[Seed] ✓ Created 2 sample users');

    // 插入示例設施
    const insertAmenity = db.prepare(`
      INSERT INTO amenities (name, description, category, capacity, location, openTime, closeTime, slotDurationMinutes, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertAmenity.run(
      'Gym',
      'Fully equipped fitness center',
      'wellness',
      20,
      'Level 2',
      '06:00',
      '22:00',
      60,
      new Date().toISOString(),
      new Date().toISOString()
    );

    insertAmenity.run(
      'Pool',
      'Olympic-size swimming pool',
      'recreation',
      30,
      'Rooftop',
      '07:00',
      '21:00',
      120,
      new Date().toISOString(),
      new Date().toISOString()
    );

    insertAmenity.run(
      'Meeting Room',
      'Conference room with projector',
      'business',
      10,
      'Level 3',
      '08:00',
      '20:00',
      60,
      new Date().toISOString(),
      new Date().toISOString()
    );

    console.log('[Seed] ✓ Created 3 sample amenities');
    console.log('[Seed] ✓ Sample data inserted successfully');
  } catch (error) {
    console.error('[Seed] Seeding failed:', error);
    throw error;
  } finally {
    db.close();
  }
}
