/* =========================================================
   ANDUALEM 2.0 V2 CLOUDFLARE WORKER & D1 BACKEND
   100% Edge-Native / Zero External Dependencies
========================================================= */

const SHIFT_CAPACITIES = {
    normal: '3h 45m',
    night: '6h',
    recovery: 'LOW / OPTIONAL'
};

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const { pathname } = url;
        const method = request.method;

        // Handle OPTIONS preflight
        if (method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type'
                }
            });
        }

        // Only intercept /api/* endpoints; let assets serve frontend
        if (!pathname.startsWith('/api')) {
            if (env.ASSETS) {
                return env.ASSETS.fetch(request);
            }
            return new Response('Not Found', { status: 404 });
        }

        try {
            // =========================================================
            // 1. DAYS ENDPOINTS
            // =========================================================
            if (pathname.startsWith('/api/days/')) {
                const date = pathname.split('/api/days/')[1];

                if (method === 'GET') {
                    let day = await env.DB.prepare('SELECT * FROM days WHERE date = ?').bind(date).first();

                    if (!day) {
                        await env.DB.prepare(
                            'INSERT INTO days (date, shift_type, planned_capacity) VALUES (?, ?, ?)'
                        ).bind(date, 'normal', SHIFT_CAPACITIES.normal).run();
                        day = await env.DB.prepare('SELECT * FROM days WHERE date = ?').bind(date).first();
                    }

                    const tasks = (await env.DB.prepare(`
                        SELECT t.id as task_id, t.task_name, t.category, t.shift_type, t.priority,
                               COALESCE(l.completed, 0) as completed, l.completed_at
                        FROM tasks t
                        LEFT JOIN daily_task_log l ON t.id = l.task_id AND l.date = ?
                        WHERE t.active = 1
                        ORDER BY t.priority ASC
                    `).bind(date).all()).results;

                    const deepWork = (await env.DB.prepare(`
                        SELECT dw.*, p.name as project_name, b.feature_name
                        FROM deep_work_sessions dw
                        LEFT JOIN projects p ON dw.project_id = p.id
                        LEFT JOIN builds b ON dw.build_id = b.id
                        WHERE dw.date = ?
                        ORDER BY dw.created_at ASC
                    `).bind(date).all()).results;

                    const learning = (await env.DB.prepare(`
                        SELECT l.*, p.name as project_name, b.feature_name
                        FROM learning l
                        LEFT JOIN projects p ON l.project_id = p.id
                        LEFT JOIN builds b ON l.build_id = b.id
                        WHERE l.date = ?
                        ORDER BY l.created_at ASC
                    `).bind(date).all()).results;

                    return jsonResponse({ success: true, day, tasks, deepWork, learning });
                }

                if (method === 'POST') {
                    const body = await request.json();
                    const { shift_type, planned_capacity, dragon, learning_gap, ship_target, reflection } = body;

                    const existing = await env.DB.prepare('SELECT id FROM days WHERE date = ?').bind(date).first();
                    const capacity = planned_capacity || SHIFT_CAPACITIES[shift_type] || '3h 45m';

                    if (existing) {
                        await env.DB.prepare(`
                            UPDATE days
                            SET shift_type = COALESCE(?, shift_type),
                                planned_capacity = ?,
                                dragon = COALESCE(?, dragon),
                                learning_gap = COALESCE(?, learning_gap),
                                ship_target = COALESCE(?, ship_target),
                                reflection = COALESCE(?, reflection),
                                updated_at = CURRENT_TIMESTAMP
                            WHERE date = ?
                        `).bind(shift_type, capacity, dragon, learning_gap, ship_target, reflection, date).run();
                    } else {
                        await env.DB.prepare(`
                            INSERT INTO days (date, shift_type, planned_capacity, dragon, learning_gap, ship_target, reflection)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        `).bind(date, shift_type || 'normal', capacity, dragon || '', learning_gap || '', ship_target || '', reflection || '').run();
                    }

                    const updated = await env.DB.prepare('SELECT * FROM days WHERE date = ?').bind(date).first();
                    return jsonResponse({ success: true, day: updated });
                }
            }

            if (pathname === '/api/days' && method === 'GET') {
                const limit = parseInt(url.searchParams.get('limit') || '30');
                const shift_type = url.searchParams.get('shift_type');

                let sql = 'SELECT * FROM days';
                let params = [];

                if (shift_type) {
                    sql += ' WHERE shift_type = ?';
                    params.push(shift_type);
                }
                sql += ' ORDER BY date DESC LIMIT ?';
                params.push(limit);

                const days = (await env.DB.prepare(sql).bind(...params).all()).results;
                return jsonResponse({ success: true, days });
            }

            if (pathname.startsWith('/api/reset-day/') && method === 'POST') {
                const date = pathname.split('/api/reset-day/')[1];
                await env.DB.prepare(`
                    UPDATE days
                    SET shift_type = 'normal',
                        planned_capacity = '3h 45m',
                        dragon = '',
                        learning_gap = '',
                        ship_target = '',
                        reflection = '',
                        updated_at = CURRENT_TIMESTAMP
                    WHERE date = ?
                `).bind(date).run();
                await env.DB.prepare('DELETE FROM daily_task_log WHERE date = ?').bind(date).run();
                return jsonResponse({ success: true, message: `Day ${date} reset successfully` });
            }

            // =========================================================
            // 2. TASK LOG TOGGLE
            // =========================================================
            if (pathname === '/api/daily-task-log/toggle' && method === 'POST') {
                const { date, task_id, completed } = await request.json();
                const now = completed ? new Date().toISOString() : null;

                const existing = await env.DB.prepare('SELECT id FROM daily_task_log WHERE date = ? AND task_id = ?').bind(date, task_id).first();

                if (existing) {
                    await env.DB.prepare('UPDATE daily_task_log SET completed = ?, completed_at = ? WHERE id = ?').bind(completed ? 1 : 0, now, existing.id).run();
                } else {
                    await env.DB.prepare('INSERT INTO daily_task_log (date, task_id, completed, completed_at) VALUES (?, ?, ?, ?)').bind(date, task_id, completed ? 1 : 0, now).run();
                }

                return jsonResponse({ success: true, completed: !!completed });
            }

            // =========================================================
            // 3. PROJECTS ENDPOINTS
            // =========================================================
            if (pathname === '/api/projects') {
                if (method === 'GET') {
                    const projects = (await env.DB.prepare(`
                        SELECT p.*,
                               (SELECT COUNT(*) FROM builds b WHERE b.project_id = p.id) as total_builds,
                               (SELECT COUNT(*) FROM builds b WHERE b.project_id = p.id AND b.status = 'SHIPPED') as shipped_builds,
                               (SELECT COALESCE(SUM(duration_minutes), 0) FROM deep_work_sessions dw WHERE dw.project_id = p.id) as total_deep_work_minutes
                        FROM projects p
                        ORDER BY p.created_at DESC
                    `).all()).results;
                    return jsonResponse({ success: true, projects });
                }

                if (method === 'POST') {
                    const { name, description, status } = await request.json();
                    if (!name) return jsonResponse({ success: false, error: 'Project name is required' }, 400);

                    const res = await env.DB.prepare(
                        'INSERT INTO projects (name, description, status) VALUES (?, ?, ?)'
                    ).bind(name, description || '', status || 'ACTIVE').run();

                    const newProject = await env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(res.meta.last_row_id).first();
                    return jsonResponse({ success: true, project: newProject });
                }
            }

            if (pathname.startsWith('/api/projects/')) {
                const id = pathname.split('/api/projects/')[1];

                if (method === 'PUT') {
                    const { name, description, status } = await request.json();
                    const completedAt = status === 'COMPLETED' ? new Date().toISOString() : null;

                    await env.DB.prepare(`
                        UPDATE projects
                        SET name = COALESCE(?, name),
                            description = COALESCE(?, description),
                            status = COALESCE(?, status),
                            completed_at = CASE WHEN ? = 'COMPLETED' THEN ? ELSE completed_at END
                        WHERE id = ?
                    `).bind(name, description, status, status, completedAt, id).run();

                    const updated = await env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first();
                    return jsonResponse({ success: true, project: updated });
                }

                if (method === 'DELETE') {
                    await env.DB.prepare('DELETE FROM projects WHERE id = ?').bind(id).run();
                    return jsonResponse({ success: true, message: 'Project deleted' });
                }
            }

            // =========================================================
            // 4. BUILDS ENDPOINTS
            // =========================================================
            if (pathname === '/api/builds') {
                if (method === 'GET') {
                    const projectId = url.searchParams.get('project_id');
                    let sql = `
                        SELECT b.*, p.name as project_name
                        FROM builds b
                        JOIN projects p ON b.project_id = p.id
                    `;
                    let params = [];

                    if (projectId) {
                        sql += ' WHERE b.project_id = ?';
                        params.push(projectId);
                    }
                    sql += ' ORDER BY b.id DESC';

                    const builds = (await env.DB.prepare(sql).bind(...params).all()).results;
                    return jsonResponse({ success: true, builds });
                }

                if (method === 'POST') {
                    const { project_id, feature_name, status, notes } = await request.json();
                    if (!project_id || !feature_name) return jsonResponse({ success: false, error: 'Project ID and feature name required' }, 400);

                    const buildStatus = status || 'PLANNED';
                    const startedAt = (buildStatus === 'IN PROGRESS' || buildStatus === 'SHIPPED') ? new Date().toISOString() : null;
                    const shippedAt = buildStatus === 'SHIPPED' ? new Date().toISOString() : null;

                    const res = await env.DB.prepare(
                        'INSERT INTO builds (project_id, feature_name, status, started_at, shipped_at, notes) VALUES (?, ?, ?, ?, ?, ?)'
                    ).bind(project_id, feature_name, buildStatus, startedAt, shippedAt, notes || '').run();

                    const newBuild = await env.DB.prepare(
                        'SELECT b.*, p.name as project_name FROM builds b JOIN projects p ON b.project_id = p.id WHERE b.id = ?'
                    ).bind(res.meta.last_row_id).first();

                    return jsonResponse({ success: true, build: newBuild });
                }
            }

            if (pathname.startsWith('/api/builds/')) {
                const id = pathname.split('/api/builds/')[1];

                if (method === 'PUT') {
                    const { feature_name, status, notes } = await request.json();
                    const existing = await env.DB.prepare('SELECT * FROM builds WHERE id = ?').bind(id).first();
                    if (!existing) return jsonResponse({ success: false, error: 'Build feature not found' }, 404);

                    let startedAt = existing.started_at;
                    let shippedAt = existing.shipped_at;

                    if (status === 'IN PROGRESS' && !startedAt) startedAt = new Date().toISOString();
                    if (status === 'SHIPPED') {
                        if (!startedAt) startedAt = new Date().toISOString();
                        shippedAt = new Date().toISOString();
                    }

                    await env.DB.prepare(`
                        UPDATE builds
                        SET feature_name = COALESCE(?, feature_name),
                            status = COALESCE(?, status),
                            started_at = ?,
                            shipped_at = ?,
                            notes = COALESCE(?, notes)
                        WHERE id = ?
                    `).bind(feature_name, status, startedAt, shippedAt, notes, id).run();

                    const updated = await env.DB.prepare(
                        'SELECT b.*, p.name as project_name FROM builds b JOIN projects p ON b.project_id = p.id WHERE b.id = ?'
                    ).bind(id).first();

                    return jsonResponse({ success: true, build: updated });
                }

                if (method === 'DELETE') {
                    await env.DB.prepare('DELETE FROM builds WHERE id = ?').bind(id).run();
                    return jsonResponse({ success: true, message: 'Build feature deleted' });
                }
            }

            // =========================================================
            // 5. DEEP WORK ENDPOINTS
            // =========================================================
            if (pathname === '/api/deep-work') {
                if (method === 'GET') {
                    const date = url.searchParams.get('date');
                    const limit = parseInt(url.searchParams.get('limit') || '50');

                    let sql = `
                        SELECT dw.*, p.name as project_name, b.feature_name
                        FROM deep_work_sessions dw
                        LEFT JOIN projects p ON dw.project_id = p.id
                        LEFT JOIN builds b ON dw.build_id = b.id
                    `;
                    let params = [];

                    if (date) {
                        sql += ' WHERE dw.date = ?';
                        params.push(date);
                    }
                    sql += ' ORDER BY dw.date DESC, dw.id DESC LIMIT ?';
                    params.push(limit);

                    const sessions = (await env.DB.prepare(sql).bind(...params).all()).results;
                    return jsonResponse({ success: true, sessions });
                }

                if (method === 'POST') {
                    const { date, start_time, end_time, duration_minutes, project_id, build_id, description } = await request.json();
                    if (!date || !duration_minutes) return jsonResponse({ success: false, error: 'Date and duration required' }, 400);

                    const res = await env.DB.prepare(`
                        INSERT INTO deep_work_sessions (date, start_time, end_time, duration_minutes, project_id, build_id, description)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `).bind(date, start_time || '', end_time || '', duration_minutes, project_id || null, build_id || null, description || '').run();

                    const newSession = await env.DB.prepare(`
                        SELECT dw.*, p.name as project_name, b.feature_name
                        FROM deep_work_sessions dw
                        LEFT JOIN projects p ON dw.project_id = p.id
                        LEFT JOIN builds b ON dw.build_id = b.id
                        WHERE dw.id = ?
                    `).bind(res.meta.last_row_id).first();

                    return jsonResponse({ success: true, session: newSession });
                }
            }

            if (pathname.startsWith('/api/deep-work/') && method === 'DELETE') {
                const id = pathname.split('/api/deep-work/')[1];
                await env.DB.prepare('DELETE FROM deep_work_sessions WHERE id = ?').bind(id).run();
                return jsonResponse({ success: true, message: 'Deep work session deleted' });
            }

            // =========================================================
            // 6. LEARNING ENDPOINTS
            // =========================================================
            if (pathname === '/api/learning') {
                if (method === 'GET') {
                    const date = url.searchParams.get('date');
                    const limit = parseInt(url.searchParams.get('limit') || '50');

                    let sql = `
                        SELECT l.*, p.name as project_name, b.feature_name
                        FROM learning l
                        LEFT JOIN projects p ON l.project_id = p.id
                        LEFT JOIN builds b ON l.build_id = b.id
                    `;
                    let params = [];

                    if (date) {
                        sql += ' WHERE l.date = ?';
                        params.push(date);
                    }
                    sql += ' ORDER BY l.date DESC, l.id DESC LIMIT ?';
                    params.push(limit);

                    const entries = (await env.DB.prepare(sql).bind(...params).all()).results;
                    return jsonResponse({ success: true, learning: entries });
                }

                if (method === 'POST') {
                    const { date, topic, purpose, duration_minutes, project_id, build_id, applied_to_build } = await request.json();
                    if (!date || !topic || !duration_minutes) return jsonResponse({ success: false, error: 'Date, topic and duration required' }, 400);

                    const res = await env.DB.prepare(`
                        INSERT INTO learning (date, topic, purpose, duration_minutes, project_id, build_id, applied_to_build)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `).bind(date, topic, purpose || '', duration_minutes, project_id || null, build_id || null, applied_to_build ? 1 : 0).run();

                    const entry = await env.DB.prepare(`
                        SELECT l.*, p.name as project_name, b.feature_name
                        FROM learning l
                        LEFT JOIN projects p ON l.project_id = p.id
                        LEFT JOIN builds b ON l.build_id = b.id
                        WHERE l.id = ?
                    `).bind(res.meta.last_row_id).first();

                    return jsonResponse({ success: true, learning: entry });
                }
            }

            if (pathname.startsWith('/api/learning/') && method === 'DELETE') {
                const id = pathname.split('/api/learning/')[1];
                await env.DB.prepare('DELETE FROM learning WHERE id = ?').bind(id).run();
                return jsonResponse({ success: true, message: 'Learning record deleted' });
            }

            // =========================================================
            // 7. DASHBOARD & SHIFT ANALYTICS
            // =========================================================
            if (pathname === '/api/dashboard/summary' && method === 'GET') {
                const todayStr = url.searchParams.get('date') || new Date().toISOString().split('T')[0];

                const todayDay = (await env.DB.prepare('SELECT * FROM days WHERE date = ?').bind(todayStr).first()) || { shift_type: 'normal', planned_capacity: '3h 45m' };
                const todayDeepWork = (await env.DB.prepare('SELECT COALESCE(SUM(duration_minutes), 0) as total FROM deep_work_sessions WHERE date = ?').bind(todayStr).first()) || { total: 0 };
                const todayTasksCount = (await env.DB.prepare(`
                    SELECT COUNT(t.id) as total,
                           SUM(CASE WHEN l.completed = 1 THEN 1 ELSE 0 END) as done
                    FROM tasks t
                    LEFT JOIN daily_task_log l ON t.id = l.task_id AND l.date = ?
                    WHERE t.active = 1
                `).bind(todayStr).first()) || { total: 0, done: 0 };

                const todayMissionTasks = (await env.DB.prepare(`
                    SELECT COUNT(t.id) as total,
                           SUM(CASE WHEN l.completed = 1 THEN 1 ELSE 0 END) as done
                    FROM tasks t
                    LEFT JOIN daily_task_log l ON t.id = l.task_id AND l.date = ?
                    WHERE t.active = 1 AND t.category = 'mission'
                `).bind(todayStr).first()) || { total: 0, done: 0 };

                const activeProject = await env.DB.prepare("SELECT * FROM projects WHERE status = 'ACTIVE' ORDER BY id DESC LIMIT 1").first();
                const activeBuild = activeProject ? await env.DB.prepare("SELECT * FROM builds WHERE project_id = ? AND status != 'SHIPPED' ORDER BY id DESC LIMIT 1").bind(activeProject.id).first() : null;

                const weekDeepWork = (await env.DB.prepare('SELECT COALESCE(SUM(duration_minutes), 0) as total FROM deep_work_sessions WHERE date >= date(?, "-6 days")').bind(todayStr).first()) || { total: 0 };
                const weekLearning = (await env.DB.prepare('SELECT COALESCE(SUM(duration_minutes), 0) as total FROM learning WHERE date >= date(?, "-6 days")').bind(todayStr).first()) || { total: 0 };
                const weekShippedFeatures = (await env.DB.prepare("SELECT COUNT(*) as total FROM builds WHERE status = 'SHIPPED' AND date(shipped_at) >= date(?, '-6 days')").bind(todayStr).first()) || { total: 0 };
                const weekTasksDone = (await env.DB.prepare("SELECT COUNT(*) as total FROM daily_task_log WHERE completed = 1 AND date >= date(?, '-6 days')").bind(todayStr).first()) || { total: 0 };

                const monthDeepWork = (await env.DB.prepare('SELECT COALESCE(SUM(duration_minutes), 0) as total FROM deep_work_sessions WHERE date >= date(?, "-29 days")').bind(todayStr).first()) || { total: 0 };
                const monthShippedFeatures = (await env.DB.prepare("SELECT COUNT(*) as total FROM builds WHERE status = 'SHIPPED' AND date(shipped_at) >= date(?, '-29 days')").bind(todayStr).first()) || { total: 0 };
                const monthLearningSessions = (await env.DB.prepare('SELECT COUNT(*) as total FROM learning WHERE date >= date(?, "-29 days")').bind(todayStr).first()) || { total: 0 };

                const monthCompletionAvg = (await env.DB.prepare(`
                    SELECT AVG(completion_rate) as avg_rate FROM (
                        SELECT d.date,
                               (CAST(SUM(CASE WHEN l.completed = 1 THEN 1 ELSE 0 END) AS FLOAT) / COUNT(t.id)) * 100 as completion_rate
                        FROM days d
                        JOIN tasks t ON t.active = 1
                        LEFT JOIN daily_task_log l ON t.id = l.task_id AND l.date = d.date
                        WHERE d.date >= date(?, '-29 days')
                        GROUP BY d.date
                    )
                `).bind(todayStr).first()) || { avg_rate: 0 };

                return jsonResponse({
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
                        tasks_completed: weekTasksDone.total
                    },
                    this_month: {
                        deep_work_hours: (monthDeepWork.total / 60).toFixed(1),
                        shipped_features: monthShippedFeatures.total,
                        learning_sessions: monthLearningSessions.total,
                        average_daily_completion: monthCompletionAvg.avg_rate ? Math.round(monthCompletionAvg.avg_rate) : 0
                    }
                });
            }

            if (pathname === '/api/dashboard/trends' && method === 'GET') {
                const deepWorkMonthly = (await env.DB.prepare(`
                    SELECT strftime('%Y-%m', date) as month,
                           ROUND(SUM(duration_minutes) / 60.0, 1) as hours
                    FROM deep_work_sessions
                    GROUP BY month
                    ORDER BY month ASC
                    LIMIT 12
                `).all()).results;

                const shippedMonthly = (await env.DB.prepare(`
                    SELECT strftime('%Y-%m', shipped_at) as month,
                           COUNT(*) as shipped_count
                    FROM builds
                    WHERE status = 'SHIPPED' AND shipped_at IS NOT NULL
                    GROUP BY month
                    ORDER BY month ASC
                    LIMIT 12
                `).all()).results;

                return jsonResponse({
                    success: true,
                    trends: {
                        deep_work: deepWorkMonthly,
                        shipped: shippedMonthly
                    }
                });
            }

            if (pathname === '/api/shift-analysis' && method === 'GET') {
                const stats = (await env.DB.prepare(`
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
                `).all()).results;

                const shippedByShift = (await env.DB.prepare(`
                    SELECT d.shift_type, COUNT(b.id) as shipped_count
                    FROM builds b
                    JOIN days d ON date(b.shipped_at) = d.date
                    WHERE b.status = 'SHIPPED'
                    GROUP BY d.shift_type
                `).all()).results;

                return jsonResponse({ success: true, shift_stats: stats, shipped_by_shift: shippedByShift });
            }

            // =========================================================
            // 8. DATA EXPORT & MIGRATION ENDPOINTS
            // =========================================================
            if (pathname === '/api/export' && method === 'GET') {
                const days = (await env.DB.prepare('SELECT * FROM days ORDER BY date ASC').all()).results;
                const tasks = (await env.DB.prepare('SELECT * FROM tasks').all()).results;
                const taskLog = (await env.DB.prepare('SELECT * FROM daily_task_log').all()).results;
                const projects = (await env.DB.prepare('SELECT * FROM projects').all()).results;
                const builds = (await env.DB.prepare('SELECT * FROM builds').all()).results;
                const deepWork = (await env.DB.prepare('SELECT * FROM deep_work_sessions').all()).results;
                const learning = (await env.DB.prepare('SELECT * FROM learning').all()).results;

                const backupData = {
                    version: "2.0",
                    exported_at: new Date().toISOString(),
                    database: "Cloudflare D1 / SQLite",
                    data: { days, tasks, taskLog, projects, builds, deepWork, learning }
                };

                return jsonResponse({ success: true, backup: backupData });
            }

            if (pathname === '/api/migrate' && method === 'POST') {
                const body = await request.json();
                
                // Case A: Full JSON Backup import
                if (body.backup && body.backup.data) {
                    const bd = body.backup.data;
                    let count = 0;

                    if (Array.isArray(bd.days)) {
                        for (const d of bd.days) {
                            await env.DB.prepare(`
                                INSERT INTO days (date, shift_type, planned_capacity, dragon, learning_gap, ship_target, reflection)
                                VALUES (?, ?, ?, ?, ?, ?, ?)
                                ON CONFLICT(date) DO UPDATE SET
                                    shift_type = excluded.shift_type,
                                    dragon = excluded.dragon,
                                    learning_gap = excluded.learning_gap,
                                    ship_target = excluded.ship_target,
                                    reflection = excluded.reflection
                            `).bind(d.date, d.shift_type, d.planned_capacity, d.dragon || '', d.learning_gap || '', d.ship_target || '', d.reflection || '').run();
                            count++;
                        }
                    }

                    return jsonResponse({ success: true, message: `Successfully restored ${count} historical day records from JSON backup.` });
                }

                // Case B: Legacy localStorage state import
                if (body.state && typeof body.state === 'object') {
                    let count = 0;
                    const tasksList = (await env.DB.prepare("SELECT id, task_name, category, shift_type FROM tasks WHERE active = 1").all()).results;

                    for (const [date, data] of Object.entries(body.state)) {
                        if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) continue;
                        const shift_type = data.mode || 'normal';
                        const capacity = SHIFT_CAPACITIES[shift_type] || '3h 45m';

                        await env.DB.prepare(`
                            INSERT INTO days (date, shift_type, planned_capacity, dragon, learning_gap, ship_target, reflection)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                            ON CONFLICT(date) DO UPDATE SET
                                shift_type = excluded.shift_type,
                                dragon = excluded.dragon,
                                learning_gap = excluded.learning_gap,
                                ship_target = excluded.ship_target,
                                reflection = excluded.reflection
                        `).bind(date, shift_type, capacity, data.dragon || '', data.learning || '', data.ship || '', data.reflection || '').run();

                        count++;
                    }

                    return jsonResponse({ success: true, message: `Successfully migrated ${count} historical day records.` });
                }

                return jsonResponse({ success: false, error: 'Invalid migration payload' }, 400);
            }

            return jsonResponse({ success: false, error: 'Endpoint not found' }, 404);

        } catch (err) {
            console.error("Worker error:", err);
            return jsonResponse({ success: false, error: err.message }, 500);
        }
    }
};
