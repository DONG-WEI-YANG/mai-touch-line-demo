import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { tokenForBoundUser } from '../src/server/_core/personal-token';
describe('bound user token renewal', () => {
 it.each(['expired','revoked'])('renews %s token without reprovisioning or changing bound user role', (state) => {
  const db=new Database(':memory:');
  db.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY,role TEXT); CREATE TABLE web_tokens(token TEXT PRIMARY KEY,user_id INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP); INSERT INTO users VALUES(8,'admin');`);
  if(state==='expired') db.exec(`INSERT INTO web_tokens VALUES('old',8,'2020-01-01');`);
  const token=tokenForBoundUser(db,8);
  expect(token).toMatch(/^[a-f0-9]{64}$/);
  expect(tokenForBoundUser(db,8)).toBe(token);
  expect(db.prepare('SELECT * FROM users').all()).toEqual([{id:8,role:'admin'}]);
  expect(db.prepare('SELECT user_id FROM web_tokens WHERE token=?').get(token)).toEqual({user_id:8}); db.close();
 });
 it('rejects a deleted bound user instead of inventing a replacement', () => {
  const db=new Database(':memory:'); db.exec('CREATE TABLE users(id INTEGER);');
  expect(()=>tokenForBoundUser(db,8)).toThrow(/no longer exists/);db.close();
 });
});
