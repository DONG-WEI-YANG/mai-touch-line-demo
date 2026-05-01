import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const rootDir = path.resolve(__dirname, "..");

function fileExists(relativePath: string): boolean {
  return fs.existsSync(path.join(rootDir, relativePath));
}

describe('m\'AI Touch 系統基本功能測試', () => {
  it('1. 文件結構完整性', () => {
    const requiredDirs = [
      'src/app',
      'src/components', 
      'src/hooks',
      'src/lib',
      'src/server',
      'nlp-service',
      'docs',
      'tests',
      'migrations'
    ];
    
    requiredDirs.forEach(dir => {
      expect(fileExists(dir), `Directory ${dir} should exist`).toBe(true);
    });
  });

  it('2. 配置文件完整性', () => {
    const requiredFiles = [
      'package.json',
      'tsconfig.json',
      '.env.example',
      '.gitignore',
      '.dockerignore',
      'Dockerfile',
      'docker-compose.yml',
      'nginx.conf'
    ];
    
    requiredFiles.forEach(file => {
      expect(fileExists(file), `File ${file} should exist`).toBe(true);
    });
  });

  it('3. 核心庫文件檢查', () => {
    const coreLibFiles = [
      'src/lib/types.ts',
      'src/lib/store.ts',
      'src/lib/engine.ts',
      'src/lib/amenities.ts',
      'src/lib/notifications.ts',
      'src/lib/offline.ts'
    ];
    
    coreLibFiles.forEach(file => {
      expect(fileExists(file), `File ${file} should exist`).toBe(true);
    });
  });

  it('4. 服務器中間件檢查', () => {
    const middlewareFiles = [
      'src/server/middleware/rateLimit.ts',
      'src/server/middleware/cache.ts'
    ];
    
    middlewareFiles.forEach(file => {
      expect(fileExists(file), `File ${file} should exist`).toBe(true);
    });
  });

  it('5. 服務文件檢查', () => {
    const serviceFiles = [
      'src/server/services/emailService.ts',
      'src/server/services/smsService.ts'
    ];
    
    serviceFiles.forEach(file => {
      expect(fileExists(file), `File ${file} should exist`).toBe(true);
    });
  });

  it('6. OAuth 認證檢查', () => {
    const authFiles = [
      'src/server/auth/oauthConfig.ts',
      'src/server/auth/oauthService.ts',
      'src/server/oauth.ts'
    ];
    
    authFiles.forEach(file => {
      expect(fileExists(file), `File ${file} should exist`).toBe(true);
    });
  });

  it('7. NLP 服務檢查', () => {
    const nlpFiles = [
      'nlp-service/main.py',
      'nlp-service/pool/model_pool.py',
      'nlp-service/models/tiny_nlp.py',
      'nlp-service/config/settings.py'
    ];
    
    nlpFiles.forEach(file => {
      expect(fileExists(file), `File ${file} should exist`).toBe(true);
    });
  });

  it('8. 文檔完整性檢查', () => {
    const docFiles = [
      'docs/CHECKLIST.md',
      'docs/NEXT_STEPS.md',
      'docs/DEPLOYMENT.md',
      'docs/API.md',
      'docs/SYSTEM_COMPLETION_REPORT.md',
      'docs/FINAL_CHECKLIST.md'
    ];
    
    docFiles.forEach(file => {
      expect(fileExists(file), `File ${file} should exist`).toBe(true);
    });
  });

  it('9. 數據庫遷移檢查', () => {
    const migrationFiles = [
      'migrations/0001_absurd_zeigeist.sql',
      'migrations/0002_oauth_sessions.sql'
    ];
    
    migrationFiles.forEach(file => {
      expect(fileExists(file), `File ${file} should exist`).toBe(true);
    });
  });

  it('10. 測試文件檢查', () => {
    const testFiles = [
      'tests/amenities.test.ts',
      'tests/calendar-utils.test.ts',
      'tests/language-preference.test.ts',
      'tests/nlp-engine.test.ts',
      'tests/store.test.ts',
      'tests/system-basic.test.ts'
    ];
    
    testFiles.forEach(file => {
      expect(fileExists(file), `File ${file} should exist`).toBe(true);
    });
  });
});