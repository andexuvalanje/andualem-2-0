-- =========================================================
-- ANDUALEM 2.0 CLOUDFLARE D1 INITIAL SCHEMA MIGRATION
-- Migration: 0001_initial_schema.sql
-- =========================================================

-- 1. DAYS TABLE
CREATE TABLE IF NOT EXISTS days (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT UNIQUE NOT NULL,
    shift_type TEXT NOT NULL DEFAULT 'normal',
    planned_capacity TEXT DEFAULT '3h 45m',
    dragon TEXT DEFAULT '',
    learning_gap TEXT DEFAULT '',
    ship_target TEXT DEFAULT '',
    reflection TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. TASKS MASTER TABLE
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'mission',
    shift_type TEXT DEFAULT 'all',
    priority INTEGER DEFAULT 1,
    active INTEGER DEFAULT 1
);

-- 3. DAILY TASK LOG TABLE
CREATE TABLE IF NOT EXISTS daily_task_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    task_id INTEGER NOT NULL,
    completed INTEGER DEFAULT 0,
    completed_at DATETIME,
    UNIQUE(date, task_id),
    FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- 4. PROJECTS TABLE
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
);

-- 5. BUILDS / FEATURES TABLE
CREATE TABLE IF NOT EXISTS builds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    feature_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PLANNED',
    started_at DATETIME,
    shipped_at DATETIME,
    notes TEXT DEFAULT '',
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 6. DEEP WORK SESSIONS TABLE
CREATE TABLE IF NOT EXISTS deep_work_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    project_id INTEGER,
    build_id INTEGER,
    description TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY(build_id) REFERENCES builds(id) ON DELETE SET NULL
);

-- 7. LEARNING TABLE
CREATE TABLE IF NOT EXISTS learning (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    topic TEXT NOT NULL,
    purpose TEXT DEFAULT '',
    duration_minutes INTEGER NOT NULL,
    project_id INTEGER,
    build_id INTEGER,
    applied_to_build INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY(build_id) REFERENCES builds(id) ON DELETE SET NULL
);

-- 8. INDEXES
CREATE INDEX IF NOT EXISTS idx_days_date ON days(date);
CREATE INDEX IF NOT EXISTS idx_days_shift ON days(shift_type);
CREATE INDEX IF NOT EXISTS idx_task_log_date ON daily_task_log(date);
CREATE INDEX IF NOT EXISTS idx_deep_work_date ON deep_work_sessions(date);
CREATE INDEX IF NOT EXISTS idx_learning_date ON learning(date);
CREATE INDEX IF NOT EXISTS idx_builds_project ON builds(project_id);

-- 9. SEED DEFAULT TASKS
INSERT INTO tasks (task_name, category, shift_type, priority, active) VALUES
-- Normal Shift Mission Tasks
('Define ONE dragon for today.', 'mission', 'normal', 1, 1),
('Build a meaningful feature.', 'mission', 'normal', 2, 1),
('Learn only what the build requires.', 'mission', 'normal', 3, 1),
('Test and verify the work.', 'mission', 'normal', 4, 1),
('Ship or leave a reproducible next step.', 'mission', 'normal', 5, 1),
('Write the exact next starting action.', 'mission', 'normal', 6, 1),

-- Night Shift Mission Tasks
('Define the dragon before 3:30 PM.', 'mission', 'night', 1, 1),
('Deep-build a major feature.', 'mission', 'night', 2, 1),
('Take a real food/recovery break.', 'mission', 'night', 3, 1),
('Study one targeted knowledge gap.', 'mission', 'night', 4, 1),
('Implement what was learned.', 'mission', 'night', 5, 1),
('Ship, test or validate.', 'mission', 'night', 6, 1),
('Write tomorrow''s first action.', 'mission', 'night', 7, 1),

-- Recovery Shift Mission Tasks
('Sleep adequately.', 'mission', 'recovery', 1, 1),
('Eat and hydrate.', 'mission', 'recovery', 2, 1),
('Spend intentional family time.', 'mission', 'recovery', 3, 1),
('Get gentle movement if desired.', 'mission', 'recovery', 4, 1),
('Avoid guilt about reduced output.', 'mission', 'recovery', 5, 1),
('Prepare the next mission target.', 'mission', 'recovery', 6, 1),

-- Life Checklist
('Protect family time.', 'life', 'all', 1, 1),
('Eat and hydrate.', 'life', 'all', 2, 1),
('Protect the sleep anchor.', 'life', 'all', 3, 1),
('Avoid unnecessary scrolling.', 'life', 'all', 4, 1);
