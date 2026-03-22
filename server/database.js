require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'pmo',
  user: process.env.DB_USER || 'pmo',
  password: process.env.DB_PASSWORD,
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
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS process_type TEXT DEFAULT 'development'`);
  await pool.query(`ALTER TABLE progress_comments ADD COLUMN IF NOT EXISTS linked_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE progress_records ADD COLUMN IF NOT EXISTS evaluation_linked_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS progress_record_id TEXT REFERENCES progress_records(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS progress_comment_id TEXT REFERENCES progress_comments(id) ON DELETE SET NULL`);
}

initDB().catch(console.error);

module.exports = pool;
