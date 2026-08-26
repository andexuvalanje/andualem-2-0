const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'andualem.db');
const db = new sqlite3.Database(dbPath);

// Promisified DB helpers
function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// Enable foreign keys
db.run("PRAGMA foreign_keys = ON;");

// Initialize Schema
async function initDatabase() {
    console.log("[DB] Initializing SQLite database schema at:", dbPath);

    // Days table
    await dbRun(`
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
    `);

    // Tasks master definition table
    await dbRun(`
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_name TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT 'mission',
            shift_type TEXT DEFAULT 'all',
            priority INTEGER DEFAULT 1,
            active INTEGER DEFAULT 1
        );
    `);

    // Daily task log table
    await dbRun(`
        CREATE TABLE IF NOT EXISTS daily_task_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            task_id INTEGER NOT NULL,
            completed INTEGER DEFAULT 0,
            completed_at DATETIME,
            UNIQUE(date, task_id),
            FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );
    `);

    // Projects table
    await dbRun(`
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            status TEXT NOT NULL DEFAULT 'ACTIVE',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME
        );
    `);

    // Builds / Features table
    await dbRun(`
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
    `);

    // Deep work sessions table
    await dbRun(`
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
    `);

    // Learning table
    await dbRun(`
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
    `);

    // Create Indexes
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_days_date ON days(date);`);
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_days_shift ON days(shift_type);`);
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_task_log_date ON daily_task_log(date);`);
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_deep_work_date ON deep_work_sessions(date);`);
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_learning_date ON learning(date);`);
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_builds_project ON builds(project_id);`);

    // Seed default tasks if empty
    await seedDefaultTasks();

    console.log("[DB] Database initialization complete.");
}

async function seedDefaultTasks() {
    const countRow = await dbGet("SELECT COUNT(*) as count FROM tasks");
    if (countRow && countRow.count > 0) {
        return; // Already seeded
    }

    console.log("[DB] Seeding default mission and life tasks...");

    const defaultTasks = [
        // Mission - Normal Shift
        { name: "Define ONE dragon for today.", category: "mission", shift: "normal", priority: 1 },
        { name: "Build a meaningful feature.", category: "mission", shift: "normal", priority: 2 },
        { name: "Learn only what the build requires.", category: "mission", shift: "normal", priority: 3 },
        { name: "Test and verify the work.", category: "mission", shift: "normal", priority: 4 },
        { name: "Ship or leave a reproducible next step.", category: "mission", shift: "normal", priority: 5 },
        { name: "Write the exact next starting action.", category: "mission", shift: "normal", priority: 6 },

        // Mission - Night Shift
        { name: "Define the dragon before 3:30 PM.", category: "mission", shift: "night", priority: 1 },
        { name: "Deep-build a major feature.", category: "mission", shift: "night", priority: 2 },
        { name: "Take a real food/recovery break.", category: "mission", shift: "night", priority: 3 },
        { name: "Study one targeted knowledge gap.", category: "mission", shift: "night", priority: 4 },
        { name: "Implement what was learned.", category: "mission", shift: "night", priority: 5 },
        { name: "Ship, test or validate.", category: "mission", shift: "night", priority: 6 },
        { name: "Write tomorrow's first action.", category: "mission", shift: "night", priority: 7 },

        // Mission - Recovery Shift
        { name: "Sleep adequately.", category: "mission", shift: "recovery", priority: 1 },
        { name: "Eat and hydrate.", category: "mission", shift: "recovery", priority: 2 },
        { name: "Spend intentional family time.", category: "mission", shift: "recovery", priority: 3 },
        { name: "Get gentle movement if desired.", category: "mission", shift: "recovery", priority: 4 },
        { name: "Avoid guilt about reduced output.", category: "mission", shift: "recovery", priority: 5 },
        { name: "Prepare the next mission target.", category: "mission", shift: "recovery", priority: 6 },

        // Life Checklist (Applies to all shifts)
        { name: "Protect family time.", category: "life", shift: "all", priority: 1 },
        { name: "Eat and hydrate.", category: "life", shift: "all", priority: 2 },
        { name: "Protect the sleep anchor.", category: "life", shift: "all", priority: 3 },
        { name: "Avoid unnecessary scrolling.", category: "life", shift: "all", priority: 4 }
    ];

    for (const task of defaultTasks) {
        await dbRun(
            "INSERT INTO tasks (task_name, category, shift_type, priority, active) VALUES (?, ?, ?, ?, 1)",
            [task.name, task.category, task.shift, task.priority]
        );
    }
}

module.exports = {
    db,
    dbRun,
    dbGet,
    dbAll,
    initDatabase
};
