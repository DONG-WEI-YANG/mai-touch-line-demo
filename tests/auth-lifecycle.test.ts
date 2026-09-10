import { describe, it, expect, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { userFromToken, userFromPersonalToken } from '../src/server/_core/token-auth';
describe('production token boundaries', () => {
 afterEach(() => { delete process.env.APP_PROFILE; delete process.env.WEB_ADMIN_TOKEN; });
 it('rejects shared admin tokens in production profile', () => {
  process.env.APP_PROFILE='production'; process.env.WEB_ADMIN_TOKEN='shared';
  expect(userFromToken('shared')).toBeNull();
 });
 it('rejects expired personal tokens', () => {
  const db=new Database(':memory:');
  db.exec(`CREATE TABLE users(id INTEGER,openId TEXT,email TEXT,name TEXT,role TEXT,unitId INTEGER,tier TEXT); CREATE TABLE web_tokens(token TEXT,user_id INTEGER,created_at TEXT); INSERT INTO users VALUES(1,'u','','','resident',1,'Platinum'); INSERT INTO web_tokens VALUES('old',1,'2020-01-01 00:00:00');`);
  expect(userFromPersonalToken('old',db)).toBeNull(); db.close();
 });
});
import { authRouter } from '../src/server/routers/auth';
it('revokes only the authenticated user personal tokens and fresh tokens authenticate', async () => {
 const db=new Database(':memory:');
 db.exec(`CREATE TABLE users(id INTEGER,openId TEXT,email TEXT,name TEXT,role TEXT,unitId INTEGER,tier TEXT); CREATE TABLE web_tokens(token TEXT,user_id INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP); INSERT INTO users VALUES(1,'u','','','resident',1,'Platinum'); INSERT INTO web_tokens(token,user_id) VALUES('fresh',1),('other',2);`);
 expect(userFromPersonalToken('fresh',db)?.id).toBe(1);
 const c=authRouter.createCaller({user:{id:1,role:'resident'},lineAdmin:{db}} as any);
 expect(await c.revokeAllTokens()).toEqual({revoked:1,scope:'personal-tokens'});
 expect(userFromPersonalToken('fresh',db)).toBeNull();
 expect(db.prepare("SELECT token FROM web_tokens").all()).toEqual([{token:'other'}]); db.close();
});
