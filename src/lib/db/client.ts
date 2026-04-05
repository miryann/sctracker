import Database from 'better-sqlite3';
import { migrate } from './migrate.js';
import path from 'path';

const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data', 'sctracker.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
	if (!_db) {
		_db = new Database(dbPath);
		_db.pragma('journal_mode = WAL');
		_db.pragma('foreign_keys = ON');
		migrate(_db);
	}
	return _db;
}
