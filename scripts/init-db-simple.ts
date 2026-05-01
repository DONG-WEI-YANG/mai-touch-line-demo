/**
 * Simple Database Initialization Script
 * 使用原始 better-sqlite3 API
 */

import { runSimpleMigrations, seedDatabase } from '../src/server/database/migrate-simple';
import * as path from 'path';

async function initializeDatabase() {
  console.log('==================================================');
  console.log('m\'AI Touch - Database Initialization (Simple)');
  console.log('==================================================\n');

  try {
    // 獲取數據庫路徑
    const dbPath = process.env.SQLITE_FILENAME || './data/mai-touch.db';
    console.log(`Database path: ${dbPath}\n`);

    // 步驟 1: 運行遷移
    console.log('[1/2] Running migrations...');
    await runSimpleMigrations(dbPath);
    console.log('✓ Migrations completed\n');

    // 步驟 2: 插入示例數據
    console.log('[2/2] Seeding database...');
    await seedDatabase(dbPath);
    console.log('✓ Database seeded\n');

    console.log('==================================================');
    console.log('✅ Database initialization completed successfully!');
    console.log('==================================================\n');

    console.log('Next steps:');
    console.log('1. Start the NLP service: cd nlp-service && .\\start_service.bat');
    console.log('2. Start the backend server: npm run server');
    console.log('3. Start the frontend app: npm start\n');

  } catch (error) {
    console.error('\n==================================================');
    console.error('❌ Database initialization failed!');
    console.error('==================================================\n');
    console.error('Error:', error);
    process.exit(1);
  }
}

initializeDatabase();
