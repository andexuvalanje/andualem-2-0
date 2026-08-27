/* =========================================================
   ANDUALEM 2.0 REST API CLIENT (WITH RESILIENT OFFLINE FALLBACK)
========================================================= */

const API_BASE = '/api';

// Internal safe request helper
async function request(endpoint, options = {}) {
    try {
        const res = await fetch(endpoint, options);
        
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const data = await res.json();
            if (!res.ok) {
                return { success: false, error: data.error || `Server error (${res.status})`, status: res.status };
            }
            return data;
        }

        if (!res.ok) {
            return { success: false, error: `HTTP ${res.status}: ${res.statusText}`, status: res.status };
        }

        const text = await res.text();
        return { success: true, text };
    } catch (err) {
        console.warn(`[API] Network or fetch failure for ${endpoint}:`, err.message);
        return { success: false, error: err.message, offline: true };
    }
}

// LocalStorage Fallback Helpers
function getLocalDay(date) {
    try {
        const raw = localStorage.getItem(`andualem_day_${date}`);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function saveLocalDay(date, data) {
    try {
        const existing = getLocalDay(date) || { date, shift_type: 'normal', planned_capacity: '3h 45m', dragon: '', learning_gap: '', ship_target: '', reflection: '' };
        const updated = { ...existing, ...data, updated_at: new Date().toISOString() };
        localStorage.setItem(`andualem_day_${date}`, JSON.stringify(updated));
        return updated;
    } catch (e) {
        return null;
    }
}

const API = {
    // DAYS
    async getDay(date) {
        if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return { success: false, error: 'Invalid date format' };
        }
        const res = await request(`${API_BASE}/days/${date}`);
        if (res.success) return res;

        // Offline / Fallback mode
        const local = getLocalDay(date) || { date, shift_type: 'normal', planned_capacity: '3h 45m', dragon: '', learning_gap: '', ship_target: '', reflection: '' };
        return {
            success: true,
            fallback: true,
            day: local,
            tasks: [],
            deepWork: [],
            learning: []
        };
    },

    async saveDay(date, dayData) {
        if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return { success: false, error: 'Invalid date format' };
        }
        // Always persist to local cache first
        const local = saveLocalDay(date, dayData);

        const res = await request(`${API_BASE}/days/${date}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dayData)
        });

        if (res.success) return res;
        return { success: true, fallback: true, day: local };
    },

    async getDaysHistory(limit = 30, shiftType = '') {
        const url = `${API_BASE}/days?limit=${limit}&shift_type=${shiftType}`;
        const res = await request(url);
        if (res.success) return res;
        return { success: true, days: [], fallback: true };
    },

    async resetDay(date) {
        if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return { success: false, error: 'Invalid date format' };
        }
        localStorage.removeItem(`andualem_day_${date}`);
        const res = await request(`${API_BASE}/reset-day/${date}`, { method: 'POST' });
        if (res.success) return res;
        return { success: true, fallback: true, message: `Day ${date} reset locally` };
    },

    // TASKS
    async toggleTask(date, taskId, completed) {
        const res = await request(`${API_BASE}/daily-task-log/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date, task_id: taskId, completed })
        });
        if (res.success) return res;
        return { success: true, completed: !!completed, fallback: true };
    },

    // PROJECTS
    async getProjects() {
        const res = await request(`${API_BASE}/projects`);
        if (res.success) return res;
        return { success: true, projects: [], fallback: true };
    },

    async createProject(projectData) {
        const res = await request(`${API_BASE}/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(projectData)
        });
        return res;
    },

    async updateProject(id, projectData) {
        const res = await request(`${API_BASE}/projects/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(projectData)
        });
        return res;
    },

    async deleteProject(id) {
        return await request(`${API_BASE}/projects/${id}`, { method: 'DELETE' });
    },

    // BUILDS
    async getBuilds(projectId = '') {
        const url = projectId ? `${API_BASE}/builds?project_id=${projectId}` : `${API_BASE}/builds`;
        const res = await request(url);
        if (res.success) return res;
        return { success: true, builds: [], fallback: true };
    },

    async createBuild(buildData) {
        return await request(`${API_BASE}/builds`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildData)
        });
    },

    async updateBuild(id, buildData) {
        return await request(`${API_BASE}/builds/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildData)
        });
    },

    async deleteBuild(id) {
        return await request(`${API_BASE}/builds/${id}`, { method: 'DELETE' });
    },

    // DEEP WORK
    async getDeepWork(date = '', limit = 50) {
        const url = date ? `${API_BASE}/deep-work?date=${date}` : `${API_BASE}/deep-work?limit=${limit}`;
        const res = await request(url);
        if (res.success) return res;
        return { success: true, sessions: [], fallback: true };
    },

    async logDeepWork(sessionData) {
        return await request(`${API_BASE}/deep-work`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sessionData)
        });
    },

    async deleteDeepWork(id) {
        return await request(`${API_BASE}/deep-work/${id}`, { method: 'DELETE' });
    },

    // LEARNING
    async getLearning(date = '', limit = 50) {
        const url = date ? `${API_BASE}/learning?date=${date}` : `${API_BASE}/learning?limit=${limit}`;
        const res = await request(url);
        if (res.success) return res;
        return { success: true, learning: [], fallback: true };
    },

    async logLearning(learningData) {
        return await request(`${API_BASE}/learning`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(learningData)
        });
    },

    async deleteLearning(id) {
        return await request(`${API_BASE}/learning/${id}`, { method: 'DELETE' });
    },

    // DASHBOARD & TRENDS
    async getDashboardSummary(date = '') {
        const url = date ? `${API_BASE}/dashboard/summary?date=${date}` : `${API_BASE}/dashboard/summary`;
        const res = await request(url);
        if (res.success) return res;
        return {
            success: true,
            fallback: true,
            today: { shift_type: 'normal', planned_capacity: '3h 45m', dragon: '', deep_work_minutes: 0, total_tasks: 0, done_tasks: 0, daily_completion_percent: 0, mission_completion_percent: 0, active_project: 'None', active_build: 'None' },
            this_week: { deep_work_hours: "0.0", learning_hours: "0.0", shipped_features: 0, tasks_completed: 0 },
            this_month: { deep_work_hours: "0.0", shipped_features: 0, learning_sessions: 0, average_daily_completion: 0 }
        };
    },

    async getDashboardTrends() {
        const res = await request(`${API_BASE}/dashboard/trends`);
        if (res.success) return res;
        return { success: true, fallback: true, trends: { deep_work: [], shipped: [] } };
    },

    async getShiftAnalysis() {
        const res = await request(`${API_BASE}/shift-analysis`);
        if (res.success) return res;
        return { success: true, fallback: true, shift_stats: [], shipped_by_shift: [] };
    },

    // EXPORT & MIGRATION
    async exportData() {
        return await request(`${API_BASE}/export`);
    },

    async migrateLocalStorage(state) {
        return await request(`${API_BASE}/migrate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state })
        });
    },

    async importBackup(backupData) {
        return await request(`${API_BASE}/migrate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ backup: backupData })
        });
    }
};
