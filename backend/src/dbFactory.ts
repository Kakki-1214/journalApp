import { sqliteProvider } from './dbSqlite';
import { postgresProvider } from './dbPostgres';
import type { DBProvider } from './dbProvider';

// Selection logic:
// 1. TEST_FORCE_SQLITE=1 -> always SQLite (deterministic tests referencing synchronous helpers in db.ts)
// 2. DATABASE_URL defined -> Postgres
// 3. Fallback -> SQLite
export function getDBProvider(): DBProvider {
  if(process.env.TEST_FORCE_SQLITE === '1') return sqliteProvider;
  if(process.env.DATABASE_URL) return postgresProvider;
  return sqliteProvider;
}
