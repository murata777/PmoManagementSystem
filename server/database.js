const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config();
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

// pg は password に undefined を渡すと SASL: client password must be a string になる
const dbPassword =
  process.env.DB_PASSWORD == null || process.env.DB_PASSWORD === ''
    ? ''
    : String(process.env.DB_PASSWORD);

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'pmo',
  user: process.env.DB_USER || 'pmo',
  password: dbPassword,
  options: '-c timezone=UTC',
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_temp_password INTEGER DEFAULT 1,
      role TEXT,
      department TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_groups (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, group_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'planning',
      priority TEXT DEFAULT 'medium',
      start_date TEXT,
      end_date TEXT,
      progress INTEGER DEFAULT 0,
      manager TEXT,
      group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'todo',
      priority TEXT DEFAULT 'medium',
      assignee TEXT,
      due_date TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS project_custom_fields (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      field_key TEXT NOT NULL,
      field_type TEXT NOT NULL DEFAULT 'text',
      field_value TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS task_comments (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      comment TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS phase_gates (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      phase_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_started',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(project_id, phase_key)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS phase_gate_metrics (
      id TEXT PRIMARY KEY,
      phase_gate_id TEXT NOT NULL REFERENCES phase_gates(id) ON DELETE CASCADE,
      metric_key TEXT NOT NULL,
      value NUMERIC,
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(phase_gate_id, metric_key)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS phase_gate_comments (
      id TEXT PRIMARY KEY,
      phase_gate_id TEXT NOT NULL REFERENCES phase_gates(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      comment TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS progress_records (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      record_date TEXT NOT NULL,
      bac NUMERIC,
      pv NUMERIC,
      ev NUMERIC,
      ac NUMERIC,
      evaluation TEXT,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS progress_comments (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL REFERENCES progress_records(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      comment TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // 既存DBへのマイグレーション
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS group_id TEXT REFERENCES groups(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS comment_type TEXT NOT NULL DEFAULT 'comment'`);
  await pool.query(`ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS old_assignee TEXT`);
  await pool.query(`ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS new_assignee TEXT`);
  await pool.query(`ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS old_status TEXT`);
  await pool.query(`ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS new_status TEXT`);
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS process_type TEXT DEFAULT 'development'`);
  await pool.query(`ALTER TABLE progress_comments ADD COLUMN IF NOT EXISTS linked_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE progress_records ADD COLUMN IF NOT EXISTS evaluation_linked_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE progress_records ADD COLUMN IF NOT EXISTS links JSONB NOT NULL DEFAULT '[]'::jsonb`);
  await pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS progress_record_id TEXT REFERENCES progress_records(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS progress_comment_id TEXT REFERENCES progress_comments(id) ON DELETE SET NULL`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT,
      summary TEXT NOT NULL,
      detail JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs (created_at DESC)`
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS activity_email_settings (
      id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      enabled INTEGER NOT NULL DEFAULT 0,
      project_scope TEXT NOT NULL DEFAULT 'all',
      project_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      group_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      exclude_login INTEGER NOT NULL DEFAULT 1,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    INSERT INTO activity_email_settings (id, enabled, project_scope, project_ids, group_ids, exclude_login)
    VALUES (1, 0, 'all', '[]'::jsonb, '[]'::jsonb, 1)
    ON CONFLICT (id) DO NOTHING
  `);

  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin INTEGER NOT NULL DEFAULT 0`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS activity_notification_configs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 0,
      project_scope TEXT NOT NULL DEFAULT 'all',
      project_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      group_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      exclude_login INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    UPDATE users u SET is_admin = 1
    WHERE NOT EXISTS (SELECT 1 FROM users WHERE is_admin = 1)
      AND u.id = (SELECT id FROM users ORDER BY created_at ASC NULLS LAST LIMIT 1)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      path TEXT NOT NULL,
      label TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (user_id, path)
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_user_favorites_user_sort ON user_favorites (user_id, sort_order)`
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_personal_todos (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      notes TEXT,
      due_date TEXT,
      completed INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_user_personal_todos_user ON user_personal_todos (user_id, completed, sort_order)`
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS feature_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      body TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_feature_requests_created ON feature_requests (created_at DESC)`
  );

  const { rows: cfgCount } = await pool.query('SELECT COUNT(*)::int AS c FROM activity_notification_configs');
  if (cfgCount[0].c === 0) {
    const { rows: oldRows } = await pool.query('SELECT * FROM activity_email_settings WHERE id = 1');
    if (oldRows[0]) {
      const o = oldRows[0];
      await pool.query(
        `INSERT INTO activity_notification_configs (id, name, enabled, project_scope, project_ids, group_ids, exclude_login, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamp, NOW()), COALESCE($8::timestamp, NOW()))`,
        [
          uuidv4(),
          'デフォルト',
          o.enabled,
          o.project_scope,
          o.project_ids,
          o.group_ids,
          o.exclude_login,
          o.updated_at,
        ]
      );
    }
  }
}

initDB().catch(console.error);

module.exports = pool;
