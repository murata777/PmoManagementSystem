require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'pmo',
  user: process.env.DB_USER || 'pmo',
  password: process.env.DB_PASSWORD,
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

  // 既存DBへのマイグレーション
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS group_id TEXT REFERENCES groups(id) ON DELETE SET NULL`);
}

initDB().catch(console.error);

module.exports = pool;
