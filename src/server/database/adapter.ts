/**
 * Database Adapter
 * 支持多種數據庫類型的適配器系統
 */

import { drizzle as drizzleMysql } from 'drizzle-orm/mysql2';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import mysql from 'mysql2/promise';
import Database from 'better-sqlite3';
import postgres from 'postgres';
import * as schema from '../schema';

export type DatabaseType = 'mysql' | 'sqlite' | 'postgres';

export interface DatabaseConfig {
  type: DatabaseType;
  url?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  filename?: string; // For SQLite
}

export interface DatabaseAdapter {
  db: any;
  type: DatabaseType;
  close: () => Promise<void>;
}

/**
 * 從環境變量解析數據庫配置
 */
export function parseDatabaseConfig(): DatabaseConfig {
  const dbUrl = process.env.DATABASE_URL;
  const dbType = (process.env.DB_TYPE || 'sqlite') as DatabaseType;

  if (dbUrl) {
    // 從 URL 解析數據庫類型
    if (dbUrl.startsWith('mysql://')) {
      return { type: 'mysql', url: dbUrl };
    } else if (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://')) {
      return { type: 'postgres', url: dbUrl };
    } else if (dbUrl.startsWith('file:') || dbUrl.endsWith('.db') || dbUrl.endsWith('.sqlite')) {
      return { type: 'sqlite', filename: dbUrl.replace('file:', '') };
    }
  }

  // 使用獨立配置
  if (dbType === 'sqlite') {
    return {
      type: 'sqlite',
      filename: process.env.SQLITE_FILENAME || './data/mai-touch.db',
    };
  } else if (dbType === 'mysql') {
    return {
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'mai_touch',
    };
  } else if (dbType === 'postgres') {
    return {
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'mai_touch',
    };
  }

  // 默認使用 SQLite
  return {
    type: 'sqlite',
    filename: './data/mai-touch.db',
  };
}

/**
 * 創建 MySQL 連接
 */
async function createMysqlAdapter(config: DatabaseConfig): Promise<DatabaseAdapter> {
  let connection: mysql.Connection;

  if (config.url) {
    connection = await mysql.createConnection(config.url);
  } else {
    connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
    });
  }

  const db = drizzleMysql(connection, { schema, mode: 'default' });

  return {
    db,
    type: 'mysql',
    close: async () => {
      await connection.end();
    },
  };
}

/**
 * 創建 SQLite 連接
 */
function createSqliteAdapter(config: DatabaseConfig): DatabaseAdapter {
  const filename = config.filename || './data/mai-touch.db';
  
  // 確保目錄存在
  const fs = require('fs');
  const path = require('path');
  const dir = path.dirname(filename);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const sqlite = new Database(filename);
  const db = drizzleSqlite(sqlite, { schema });

  return {
    db,
    type: 'sqlite',
    close: async () => {
      sqlite.close();
    },
  };
}

/**
 * 創建 PostgreSQL 連接
 */
async function createPostgresAdapter(config: DatabaseConfig): Promise<DatabaseAdapter> {
  let connectionString: string;

  if (config.url) {
    connectionString = config.url;
  } else {
    connectionString = `postgres://${config.user}:${config.password}@${config.host}:${config.port}/${config.database}`;
  }

  const client = postgres(connectionString);
  const db = drizzlePostgres(client, { schema });

  return {
    db,
    type: 'postgres',
    close: async () => {
      await client.end();
    },
  };
}

/**
 * 創建數據庫適配器
 */
export async function createDatabaseAdapter(config?: DatabaseConfig): Promise<DatabaseAdapter> {
  const dbConfig = config || parseDatabaseConfig();

  console.log(`[Database] Connecting to ${dbConfig.type} database...`);

  try {
    let adapter: DatabaseAdapter;

    switch (dbConfig.type) {
      case 'mysql':
        adapter = await createMysqlAdapter(dbConfig);
        break;
      case 'sqlite':
        adapter = createSqliteAdapter(dbConfig);
        break;
      case 'postgres':
        adapter = await createPostgresAdapter(dbConfig);
        break;
      default:
        throw new Error(`Unsupported database type: ${dbConfig.type}`);
    }

    console.log(`[Database] Connected to ${dbConfig.type} successfully`);
    return adapter;
  } catch (error) {
    console.error(`[Database] Failed to connect to ${dbConfig.type}:`, error);
    throw error;
  }
}

/**
 * 數據庫連接管理器
 */
export class DatabaseManager {
  private static instance: DatabaseManager;
  private adapter: DatabaseAdapter | null = null;

  private constructor() {}

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  async connect(config?: DatabaseConfig): Promise<DatabaseAdapter> {
    if (this.adapter) {
      return this.adapter;
    }

    this.adapter = await createDatabaseAdapter(config);
    return this.adapter;
  }

  getAdapter(): DatabaseAdapter | null {
    return this.adapter;
  }

  getDb(): any {
    if (!this.adapter) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.adapter.db;
  }

  getType(): DatabaseType | null {
    return this.adapter?.type || null;
  }

  async close(): Promise<void> {
    if (this.adapter) {
      await this.adapter.close();
      this.adapter = null;
      console.log('[Database] Connection closed');
    }
  }

  async reconnect(config?: DatabaseConfig): Promise<DatabaseAdapter> {
    await this.close();
    return this.connect(config);
  }
}

// 導出單例實例
export const dbManager = DatabaseManager.getInstance();