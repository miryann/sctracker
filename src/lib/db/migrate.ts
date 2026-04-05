import type Database from 'better-sqlite3';

export function migrate(db: Database.Database): void {
	db.exec(`
    CREATE TABLE IF NOT EXISTS flights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route TEXT NOT NULL,
      date TEXT NOT NULL,
      cabin TEXT NOT NULL CHECK(cabin IN ('economy','business','first')),
      fare_class TEXT,
      sc_value INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('flown','booked','planned')),
      included_in_projection INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sc_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route TEXT,
      route_type TEXT CHECK(route_type IN ('domestic','trans_tasman','international')),
      cabin TEXT NOT NULL CHECK(cabin IN ('economy','business','first')),
      fare_class TEXT,
      sc_value INTEGER NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS year_config (
      id INTEGER PRIMARY KEY DEFAULT 1,
      target_sc INTEGER NOT NULL DEFAULT 1400,
      year_start TEXT NOT NULL DEFAULT '2025-07-01',
      year_end TEXT NOT NULL DEFAULT '2026-06-30',
      ground_sc_earned INTEGER NOT NULL DEFAULT 0,
      rollover_sc INTEGER NOT NULL DEFAULT 0
    );
  `);

	// Ensure the single year_config row exists
	db.prepare(`
    INSERT OR IGNORE INTO year_config (id) VALUES (1)
  `).run();
}

// Allow running directly: npx tsx src/lib/db/migrate.ts
if (process.argv[1]?.endsWith('migrate.ts') || process.argv[1]?.endsWith('migrate.js')) {
	import('better-sqlite3').then(({ default: Database }) => {
		import('path').then(({ default: path }) => {
			const dbPath =
				process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data', 'sctracker.db');
			import('fs').then(({ mkdirSync }) => {
				mkdirSync(path.dirname(dbPath), { recursive: true });
				const db = new Database(dbPath);
				migrate(db);
				console.log('Migration complete:', dbPath);
				db.close();
			});
		});
	});
}
