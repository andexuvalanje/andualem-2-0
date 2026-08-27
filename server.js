const express = require('express');
const cors = require('cors');
const path = require('path');
const { dbRun, dbGet, dbAll, initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Capacity map helper
const SHIFT_CAPACITIES = {
    normal: '3h 45m',
    night: '6h',
    recovery: 'LOW / OPTIONAL'
};

// Date format validator (YYYY-MM-DD)
function isValidDate(dateStr) {
    return typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

// =========================================================
// DAYS ENDPOINTS
// =========================================================

// GET /api/days/:date - Retrieve or auto-create a day record
app.get('/api/days/:date', async (req, res) => {
    try {
        const { date } = req.params;
        if (!isValidDate(date)) {
            return res.status(400).json({ success: false, error: 'Invalid date format. Expected YYYY-MM-DD' });
        }

        let day = await dbGet('SELECT * FROM days WHERE date = ?', [date]);

        if (!day) {
            // Auto-create day with default normal shift
            await dbRun(
                'INSERT INTO days (date, shift_type, planned_capacity) VALUES (?, ?, ?)',
                [date, 'normal', SHIFT_CAPACITIES.normal]
            );
            day = await dbGet('SELECT * FROM days WHERE date = ?', [date]);
        }

        // Get tasks log for this day
        const tasks = await dbAll(`
            SELECT t.id as task_id, t.task_name, t.category, t.shift_type, t.priority,
                   COALESCE(l.completed, 0) as completed, l.completed_at
            FROM tasks t
            LEFT JOIN daily_task_log l ON t.id = l.task_id AND l.date = ?
            WHERE t.active = 1
            ORDER BY t.priority ASC
        `, [date]);

        // Get deep work sessions for this day
        const deepWork = await dbAll(`
            SELECT dw.*, p.name as project_name, b.feature_name
            FROM deep_work_sessions dw
            LEFT JOIN projects p ON dw.project_id = p.id
            LEFT JOIN builds b ON dw.build_id = b.id
            WHERE dw.date = ?
            ORDER BY dw.created_at ASC
        `, [date]);

        // Get learning sessions for this day
        const learning = await dbAll(`
            SELECT l.*, p.name as project_name, b.feature_name
            FROM learning l
            LEFT JOIN projects p ON l.project_id = p.id
            LEFT JOIN builds b ON l.build_id = b.id
            WHERE l.date = ?
            ORDER BY l.created_at ASC
        `, [date]);

        res.json({
            success: true,
            day: day || null,
            tasks: tasks || [],
            deepWork: deepWork || [],
            learning: learning || []
        });
    } catch (err) {
        console.error("Error fetching day:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/days/:date - Save day metadata
app.post('/api/days/:date', async (req, res) => {
    try {
        const { date } = req.params;
        if (!isValidDate(date)) {
            return res.status(400).json({ success: false, error: 'Invalid date format. Expected YYYY-MM-DD' });
        }
        const { shift_type, planned_capacity, dragon, learning_gap, ship_target, reflection } = req.body;

        const existing = await dbGet('SELECT id FROM days WHERE date = ?', [date]);
        const capacity = planned_capacity || SHIFT_CAPACITIES[shift_type] || '3h 45m';

        if (existing) {
            await dbRun(`
                UPDATE days
                SET shift_type = COALESCE(?, shift_type),
                    planned_capacity = ?,
                    dragon = COALESCE(?, dragon),
                    learning_gap = COALESCE(?, learning_gap),
                    ship_target = COALESCE(?, ship_target),
                    reflection = COALESCE(?, reflection),
                    updated_at = CURRENT_TIMESTAMP
                WHERE date = ?
            `, [shift_type, capacity, dragon, learning_gap, ship_target, reflection, date]);
        } else {
            await dbRun(`
                INSERT INTO days (date, shift_type, planned_capacity, dragon, learning_gap, ship_target, reflection)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [date, shift_type || 'normal', capacity, dragon || '', learning_gap || '', ship_target || '', reflection || '']);
        }

        const updated = await dbGet('SELECT * FROM days WHERE date = ?', [date]);
        res.json({ success: true, day: updated });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/days - Get list of historical days
app.get('/api/days', async (req, res) => {
    try {
        const { limit = 30, shift_type } = req.query;
        let sql = 'SELECT * FROM days';
        const params = [];

        if (shift_type) {
            sql += ' WHERE shift_type = ?';
            params.push(shift_type);
        }
        sql += ' ORDER BY date DESC LIMIT ?';
        params.push(parseInt(limit));

        const days = await dbAll(sql, params);
        res.json({ success: true, days: days || [] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/reset-day/:date - Reset a specific day
app.post('/api/reset-day/:date', async (req, res) => {
    try {
        const { date } = req.params;
        if (!isValidDate(date)) {
            return res.status(400).json({ success: false, error: 'Invalid date format. Expected YYYY-MM-DD' });
        }
        await dbRun(`
            UPDATE days
            SET shift_type = 'normal',
                planned_capacity = '3h 45m',
                dragon = '',
                learning_gap = '',
                ship_target = '',
                reflection = '',
                updated_at = CURRENT_TIMESTAMP
            WHERE date = ?
        `, [date]);
        await dbRun('DELETE FROM daily_task_log WHERE date = ?', [date]);
        res.json({ success: true, message: `Day ${date} reset successfully` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// =========================================================
// TASKS & LOGS ENDPOINTS
// =========================================================

// POST /api/daily-task-log/toggle - Toggle task completion status
app.post('/api/daily-task-log/toggle', async (req, res) => {
    try {
        const { date, task_id, completed } = req.body;
        const now = completed ? new Date().toISOString() : null;

        const existing = await dbGet('SELECT id FROM daily_task_log WHERE date = ? AND task_id = ?', [date, task_id]);

        if (existing) {
            await dbRun('UPDATE daily_task_log SET completed = ?, completed_at = ? WHERE id = ?', [completed ? 1 : 0, now, existing.id]);
        } else {
            await dbRun('INSERT INTO daily_task_log (date, task_id, completed, completed_at) VALUES (?, ?, ?, ?)', [date, task_id, completed ? 1 : 0, now]);
        }

        res.json({ success: true, completed: !!completed });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// =========================================================
// PROJECTS ENDPOINTS
// =========================================================

app.get('/api/projects', async (req, res) => {
    try {
        const projects = await dbAll(`
            SELECT p.*,
                   (SELECT COUNT(*) FROM builds b WHERE b.project_id = p.id) as total_builds,
                   (SELECT COUNT(*) FROM builds b WHERE b.project_id = p.id AND b.status = 'SHIPPED') as shipped_builds,
                   (SELECT COALESCE(SUM(duration_minutes), 0) FROM deep_work_sessions dw WHERE dw.project_id = p.id) as total_deep_work_minutes
            FROM projects p
            ORDER BY p.created_at DESC
        `);
        res.json({ success: true, projects });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/projects', async (req, res) => {
    try {
        const { name, description, status } = req.body;
        if (!name) return res.status(400).json({ success: false, error: 'Project name is required' });

        const result = await dbRun(
            'INSERT INTO projects (name, description, status) VALUES (?, ?, ?)',
            [name, description || '', status || 'ACTIVE']
        );
        const newProject = await dbGet('SELECT * FROM projects WHERE id = ?', [result.lastID]);
        res.json({ success: true, project: newProject });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.put('/api/projects/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, status } = req.body;
        const completedAt = status === 'COMPLETED' ? new Date().toISOString() : null;

        await dbRun(`
            UPDATE projects
            SET name = COALESCE(?, name),
                description = COALESCE(?, description),
                status = COALESCE(?, status),
                completed_at = CASE WHEN ? = 'COMPLETED' THEN ? ELSE completed_at END
            WHERE id = ?
        `, [name, description, status, status, completedAt, id]);

        const updated = await dbGet('SELECT * FROM projects WHERE id = ?', [id]);
        res.json({ success: true, project: updated });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.delete('/api/projects/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await dbRun('DELETE FROM projects WHERE id = ?', [id]);
        res.json({ success: true, message: 'Project deleted' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// =========================================================
// BUILDS / FEATURES ENDPOINTS
// =========================================================

app.get('/api/builds', async (req, res) => {
    try {
        const { project_id } = req.query;
        let sql = `
            SELECT b.*, p.name as project_name
            FROM builds b
            JOIN projects p ON b.project_id = p.id
        `;
        const params = [];

        if (project_id) {
            sql += ' WHERE b.project_id = ?';
            params.push(project_id);
        }
        sql += ' ORDER BY b.id DESC';

        const builds = await dbAll(sql, params);
        res.json({ success: true, builds });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/builds', async (req, res) => {
    try {
        const { project_id, feature_name, status, notes } = req.body;
        if (!project_id || !feature_name) {
            return res.status(400).json({ success: false, error: 'Project ID and feature name required' });
        }

        const buildStatus = status || 'PLANNED';
        const startedAt = (buildStatus === 'IN PROGRESS' || buildStatus === 'SHIPPED') ? new Date().toISOString() : null;
        const shippedAt = buildStatus === 'SHIPPED' ? new Date().toISOString() : null;

        const result = await dbRun(
            'INSERT INTO builds (project_id, feature_name, status, started_at, shipped_at, notes) VALUES (?, ?, ?, ?, ?, ?)',
            [project_id, feature_name, buildStatus, startedAt, shippedAt, notes || '']
        );
        const newBuild = await dbGet('SELECT b.*, p.name as project_name FROM builds b JOIN projects p ON b.project_id = p.id WHERE b.id = ?', [result.lastID]);
        res.json({ success: true, build: newBuild });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.put('/api/builds/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { feature_name, status, notes } = req.body;
        const existing = await dbGet('SELECT * FROM builds WHERE id = ?', [id]);
        if (!existing) return res.status(404).json({ success: false, error: 'Build feature not found' });

        let startedAt = existing.started_at;
        let shippedAt = existing.shipped_at;

        if (status === 'IN PROGRESS' && !startedAt) {
            startedAt = new Date().toISOString();
        }
        if (status === 'SHIPPED') {
            if (!startedAt) startedAt = new Date().toISOString();
            shippedAt = new Date().toISOString();
        }

        await dbRun(`
            UPDATE builds
            SET feature_name = COALESCE(?, feature_name),
                status = COALESCE(?, status),
                started_at = ?,
                shipped_at = ?,
                notes = COALESCE(?, notes)
            WHERE id = ?
        `, [feature_name, status, startedAt, shippedAt, notes, id]);

        const updated = await dbGet('SELECT b.*, p.name as project_name FROM builds b JOIN projects p ON b.project_id = p.id WHERE b.id = ?', [id]);
        res.json({ success: true, build: updated });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.delete('/api/builds/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await dbRun('DELETE FROM builds WHERE id = ?', [id]);
        res.json({ success: true, message: 'Build feature deleted' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// =========================================================
// DEEP WORK SESSIONS ENDPOINTS
// =========================================================

app.get('/api/deep-work', async (req, res) => {
    try {
        const { date, limit = 50 } = req.query;
        let sql = `
            SELECT dw.*, p.name as project_name, b.feature_name
            FROM deep_work_sessions dw
            LEFT JOIN projects p ON dw.project_id = p.id
            LEFT JOIN builds b ON dw.build_id = b.id
        `;
        const params = [];

        if (date) {
            sql += ' WHERE dw.date = ?';
            params.push(date);
        }
        sql += ' ORDER BY dw.date DESC, dw.id DESC LIMIT ?';
        params.push(parseInt(limit));

        const sessions = await dbAll(sql, params);
        res.json({ success: true, sessions });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/deep-work', async (req, res) => {
    try {
        const { date, start_time, end_time, duration_minutes, project_id, build_id, description } = req.body;
        if (!date || !duration_minutes) {
            return res.status(400).json({ success: false, error: 'Date and duration are required' });
        }

        const result = await dbRun(`
            INSERT INTO deep_work_sessions (date, start_time, end_time, duration_minutes, project_id, build_id, description)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [date, start_time || '', end_time || '', duration_minutes, project_id || null, build_id || null, description || '']);

        const newSession = await dbGet(`
            SELECT dw.*, p.name as project_name, b.feature_name
            FROM deep_work_sessions dw
            LEFT JOIN projects p ON dw.project_id = p.id
            LEFT JOIN builds b ON dw.build_id = b.id
            WHERE dw.id = ?
        `, [result.lastID]);

        res.json({ success: true, session: newSession });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.delete('/api/deep-work/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await dbRun('DELETE FROM deep_work_sessions WHERE id = ?', [id]);
        res.json({ success: true, message: 'Deep work session deleted' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// =========================================================
// LEARNING ENDPOINTS
// =========================================================

app.get('/api/learning', async (req, res) => {
    try {
        const { date, limit = 50 } = req.query;
        let sql = `
            SELECT l.*, p.name as project_name, b.feature_name
            FROM learning l
            LEFT JOIN projects p ON l.project_id = p.id
            LEFT JOIN builds b ON l.build_id = b.id
        `;
        const params = [];

        if (date) {
            sql += ' WHERE l.date = ?';
            params.push(date);
        }
        sql += ' ORDER BY l.date DESC, l.id DESC LIMIT ?';
        params.push(parseInt(limit));

        const entries = await dbAll(sql, params);
        res.json({ success: true, learning: entries });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/learning', async (req, res) => {
    try {
        const { date, topic, purpose, duration_minutes, project_id, build_id, applied_to_build } = req.body;
        if (!date || !topic || !duration_minutes) {
            return res.status(400).json({ success: false, error: 'Date, topic and duration are required' });
        }

        const result = await dbRun(`
            INSERT INTO learning (date, topic, purpose, duration_minutes, project_id, build_id, applied_to_build)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [date, topic, purpose || '', duration_minutes, project_id || null, build_id || null, applied_to_build ? 1 : 0]);

        const entry = await dbGet(`
            SELECT l.*, p.name as project_name, b.feature_name
            FROM learning l
            LEFT JOIN projects p ON l.project_id = p.id
            LEFT JOIN builds b ON l.build_id = b.id
            WHERE l.id = ?
        `, [result.lastID]);

        res.json({ success: true, learning: entry });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.delete('/api/learning/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await dbRun('DELETE FROM learning WHERE id = ?', [id]);
        res.json({ success: true, message: 'Learning record deleted' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// =========================================================
// DASHBOARD & ANALYTICS ENDPOINTS
// =========================================================

app.get('/api/dashboard/summary', async (req, res) => {
    try {
        const todayStr = req.query.date || new Date().toISOString().split('T')[0];

        // 1. TODAY METRICS
        const todayDay = await dbGet('SELECT * FROM days WHERE date = ?', [todayStr]) || { shift_type: 'normal', planned_capacity: '3h 45m' };
        const todayDeepWork = await dbGet('SELECT COALESCE(SUM(duration_minutes), 0) as total FROM deep_work_sessions WHERE date = ?', [todayStr]);
        const todayTasksCount = await dbGet(`
            SELECT COUNT(t.id) as total,
                   SUM(CASE WHEN l.completed = 1 THEN 1 ELSE 0 END) as done
            FROM tasks t
            LEFT JOIN daily_task_log l ON t.id = l.task_id AND l.date = ?
            WHERE t.active = 1
        `, [todayStr]);

        const todayMissionTasks = await dbGet(`
            SELECT COUNT(t.id) as total,
                   SUM(CASE WHEN l.completed = 1 THEN 1 ELSE 0 END) as done
            FROM tasks t
            LEFT JOIN daily_task_log l ON t.id = l.task_id AND l.date = ?
            WHERE t.active = 1 AND t.category = 'mission'
        `, [todayStr]);

        // Active project & build
        const activeProject = await dbGet("SELECT * FROM projects WHERE status = 'ACTIVE' ORDER BY id DESC LIMIT 1");
        const activeBuild = activeProject ? await dbGet("SELECT * FROM builds WHERE project_id = ? AND status != 'SHIPPED' ORDER BY id DESC LIMIT 1", [activeProject.id]) : null;

        // 2. THIS WEEK METRICS (Last 7 Days)
        const weekDeepWork = await dbGet('SELECT COALESCE(SUM(duration_minutes), 0) as total FROM deep_work_sessions WHERE date >= date(?, "-6 days")', [todayStr]);
        const weekLearning = await dbGet('SELECT COALESCE(SUM(duration_minutes), 0) as total FROM learning WHERE date >= date(?, "-6 days")', [todayStr]);
        const weekShippedFeatures = await dbGet("SELECT COUNT(*) as total FROM builds WHERE status = 'SHIPPED' AND date(shipped_at) >= date(?, '-6 days')", [todayStr]);
        const weekTasksDone = await dbGet("SELECT COUNT(*) as total FROM daily_task_log WHERE completed = 1 AND date >= date(?, '-6 days')", [todayStr]);

        // Week Shift Output comparison
        const weekShiftOutput = await dbAll(`
            SELECT d.shift_type,
                   COUNT(DISTINCT d.date) as days_count,
                   COALESCE(SUM(dw.duration_minutes), 0) as deep_work_mins
            FROM days d
            LEFT JOIN deep_work_sessions dw ON d.date = dw.date
            WHERE d.date >= date(?, '-6 days')
            GROUP BY d.shift_type
        `, [todayStr]);

        // 3. THIS MONTH METRICS (Last 30 Days)
        const monthDeepWork = await dbGet('SELECT COALESCE(SUM(duration_minutes), 0) as total FROM deep_work_sessions WHERE date >= date(?, "-29 days")', [todayStr]);
        const monthShippedFeatures = await dbGet("SELECT COUNT(*) as total FROM builds WHERE status = 'SHIPPED' AND date(shipped_at) >= date(?, '-29 days')", [todayStr]);
        const monthLearningSessions = await dbGet('SELECT COUNT(*) as total FROM learning WHERE date >= date(?, "-29 days")', [todayStr]);

        const monthCompletionAvg = await dbGet(`
            SELECT AVG(completion_rate) as avg_rate FROM (
                SELECT d.date,
                       (CAST(SUM(CASE WHEN l.completed = 1 THEN 1 ELSE 0 END) AS FLOAT) / COUNT(t.id)) * 100 as completion_rate
                FROM days d
                JOIN tasks t ON t.active = 1
                LEFT JOIN daily_task_log l ON t.id = l.task_id AND l.date = d.date
                WHERE d.date >= date(?, '-29 days')
                GROUP BY d.date
            )
        `, [todayStr]);

        res.json({
            success: true,
            today: {
                shift_type: todayDay.shift_type,
                planned_capacity: todayDay.planned_capacity,
                dragon: todayDay.dragon,
                deep_work_minutes: todayDeepWork.total,
                total_tasks: todayTasksCount.total || 0,
                done_tasks: todayTasksCount.done || 0,
                daily_completion_percent: todayTasksCount.total ? Math.round((todayTasksCount.done / todayTasksCount.total) * 100) : 0,
                mission_completion_percent: todayMissionTasks.total ? Math.round((todayMissionTasks.done / todayMissionTasks.total) * 100) : 0,
                active_project: activeProject ? activeProject.name : 'None',
                active_build: activeBuild ? `${activeBuild.feature_name} (${activeBuild.status})` : 'None'
            },
            this_week: {
                deep_work_hours: (weekDeepWork.total / 60).toFixed(1),
                learning_hours: (weekLearning.total / 60).toFixed(1),
                shipped_features: weekShippedFeatures.total,
                tasks_completed: weekTasksDone.total,
                shift_breakdown: weekShiftOutput
            },
            this_month: {
                deep_work_hours: (monthDeepWork.total / 60).toFixed(1),
                shipped_features: monthShippedFeatures.total,
                learning_sessions: monthLearningSessions.total,
                average_daily_completion: monthCompletionAvg.avg_rate ? Math.round(monthCompletionAvg.avg_rate) : 0
            }
        });
    } catch (err) {
        console.error("Dashboard summary error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/dashboard/trends - Long-term monthly trend visualization data
app.get('/api/dashboard/trends', async (req, res) => {
    try {
        // Group by YYYY-MM
        const deepWorkMonthly = await dbAll(`
            SELECT strftime('%Y-%m', date) as month,
                   ROUND(SUM(duration_minutes) / 60.0, 1) as hours
            FROM deep_work_sessions
            GROUP BY month
            ORDER BY month ASC
            LIMIT 12
        `);

        const shippedMonthly = await dbAll(`
            SELECT strftime('%Y-%m', shipped_at) as month,
                   COUNT(*) as shipped_count
            FROM builds
            WHERE status = 'SHIPPED' AND shipped_at IS NOT NULL
            GROUP BY month
            ORDER BY month ASC
            LIMIT 12
        `);

        const missionCompletionMonthly = await dbAll(`
            SELECT strftime('%Y-%m', d.date) as month,
                   ROUND(AVG(
                       CAST(
                           (SELECT COUNT(*) FROM daily_task_log l JOIN tasks t ON l.task_id = t.id WHERE l.date = d.date AND l.completed = 1 AND t.category = 'mission') AS FLOAT
                       ) / NULLIF(
                           (SELECT COUNT(*) FROM tasks WHERE active = 1 AND category = 'mission'), 0
                       ) * 100
                   ), 0) as mission_percent
            FROM days d
            GROUP BY month
            ORDER BY month ASC
            LIMIT 12
        `);

        res.json({
            success: true,
            trends: {
                deep_work: deepWorkMonthly,
                shipped: shippedMonthly,
                mission_completion: missionCompletionMonthly
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/shift-analysis - Shift comparative performance analytics
app.get('/api/shift-analysis', async (req, res) => {
    try {
        const stats = await dbAll(`
            SELECT d.shift_type,
                   COUNT(DISTINCT d.date) as total_days,
                   ROUND(AVG(COALESCE(dw.daily_deep_work, 0)), 1) as avg_deep_work_mins,
                   SUM(COALESCE(dw.daily_deep_work, 0)) as total_deep_work_mins,
                   ROUND(AVG(COALESCE(tl.completed_tasks, 0)), 1) as avg_tasks_completed
            FROM days d
            LEFT JOIN (
                SELECT date, SUM(duration_minutes) as daily_deep_work
                FROM deep_work_sessions
                GROUP BY date
            ) dw ON d.date = dw.date
            LEFT JOIN (
                SELECT date, COUNT(*) as completed_tasks
                FROM daily_task_log
                WHERE completed = 1
                GROUP BY date
            ) tl ON d.date = tl.date
            GROUP BY d.shift_type
        `);

        // Shipped features per shift type (mapping date of shipped features to day's shift type)
        const shippedByShift = await dbAll(`
            SELECT d.shift_type, COUNT(b.id) as shipped_count
            FROM builds b
            JOIN days d ON date(b.shipped_at) = d.date
            WHERE b.status = 'SHIPPED'
            GROUP BY d.shift_type
        `);

        res.json({
            success: true,
            shift_stats: stats,
            shipped_by_shift: shippedByShift
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// =========================================================
// MIGRATION ENDPOINT (from localStorage)
// =========================================================

app.post('/api/migrate', async (req, res) => {
    try {
        const { state } = req.body;
        if (!state || typeof state !== 'object') {
            return res.status(400).json({ success: false, error: 'Invalid state payload' });
        }

        let migratedDays = 0;
        const tasksList = await dbAll("SELECT id, task_name, category, shift_type, priority FROM tasks WHERE active = 1");

        for (const [date, data] of Object.entries(state)) {
            if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) continue;

            const shift_type = data.mode || 'normal';
            const capacity = SHIFT_CAPACITIES[shift_type] || '3h 45m';

            await dbRun(`
                INSERT INTO days (date, shift_type, planned_capacity, dragon, learning_gap, ship_target, reflection)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(date) DO UPDATE SET
                    shift_type = excluded.shift_type,
                    planned_capacity = excluded.planned_capacity,
                    dragon = excluded.dragon,
                    learning_gap = excluded.learning_gap,
                    ship_target = excluded.ship_target,
                    reflection = excluded.reflection
            `, [date, shift_type, capacity, data.dragon || '', data.learning || '', data.ship || '', data.reflection || '']);

            // Migrate mission checks
            if (data.checks && typeof data.checks === 'object') {
                const modeTasks = tasksList.filter(t => t.category === 'mission' && (t.shift_type === shift_type || t.shift_type === 'all'));
                for (const [idxStr, isDone] of Object.entries(data.checks)) {
                    const idx = parseInt(idxStr);
                    if (isDone && modeTasks[idx]) {
                        await dbRun(`
                            INSERT INTO daily_task_log (date, task_id, completed, completed_at)
                            VALUES (?, ?, 1, CURRENT_TIMESTAMP)
                            ON CONFLICT(date, task_id) DO UPDATE SET completed = 1
                        `, [date, modeTasks[idx].id]);
                    }
                }
            }

            // Migrate life checks
            if (data.life && typeof data.life === 'object') {
                const lifeTasks = tasksList.filter(t => t.category === 'life');
                for (const [idxStr, isDone] of Object.entries(data.life)) {
                    const idx = parseInt(idxStr);
                    if (isDone && lifeTasks[idx]) {
                        await dbRun(`
                            INSERT INTO daily_task_log (date, task_id, completed, completed_at)
                            VALUES (?, ?, 1, CURRENT_TIMESTAMP)
                            ON CONFLICT(date, task_id) DO UPDATE SET completed = 1
                        `, [date, lifeTasks[idx].id]);
                    }
                }
            }

            migratedDays++;
        }

        res.json({ success: true, message: `Successfully migrated ${migratedDays} historical day records.` });
    } catch (err) {
        console.error("Migration error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/export - Export All Data Backup
app.get('/api/export', async (req, res) => {
    try {
        const days = await dbAll('SELECT * FROM days ORDER BY date ASC');
        const tasks = await dbAll('SELECT * FROM tasks');
        const taskLog = await dbAll('SELECT * FROM daily_task_log');
        const projects = await dbAll('SELECT * FROM projects');
        const builds = await dbAll('SELECT * FROM builds');
        const deepWork = await dbAll('SELECT * FROM deep_work_sessions');
        const learning = await dbAll('SELECT * FROM learning');

        const backup = {
            version: "2.0",
            exported_at: new Date().toISOString(),
            database: "SQLite",
            data: { days, tasks, taskLog, projects, builds, deepWork, learning }
        };

        res.json({ success: true, backup });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Start Server with Port Fallback
function startServer(port) {
    const server = app.listen(port, () => {
        console.log(`==================================================`);
        console.log(`ANDUALEM 2.0 V2 Local-First Operating System`);
        console.log(`Server running at: http://localhost:${port}`);
        console.log(`Offline-first SQLite Database active`);
        console.log(`==================================================`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`Port ${port} is in use, trying port ${port + 1}...`);
            startServer(port + 1);
        } else {
            console.error("Server error:", err);
        }
    });
}

initDatabase().then(() => {
    startServer(PORT);
}).catch(err => {
    console.error("Failed to initialize database:", err);
});
