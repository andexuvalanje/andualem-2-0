/* =========================================================
   ANDUALEM 2.0 REST API CLIENT
========================================================= */

const API_BASE = '/api';

const API = {
    // DAYS
    async getDay(date) {
        const res = await fetch(`${API_BASE}/days/${date}`);
        return await res.json();
    },

    async saveDay(date, dayData) {
        const res = await fetch(`${API_BASE}/days/${date}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dayData)
        });
        return await res.json();
    },

    async getDaysHistory(limit = 30, shiftType = '') {
        const url = `${API_BASE}/days?limit=${limit}&shift_type=${shiftType}`;
        const res = await fetch(url);
        return await res.json();
    },

    async resetDay(date) {
        const res = await fetch(`${API_BASE}/reset-day/${date}`, { method: 'POST' });
        return await res.json();
    },

    // TASKS
    async toggleTask(date, taskId, completed) {
        const res = await fetch(`${API_BASE}/daily-task-log/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date, task_id: taskId, completed })
        });
        return await res.json();
    },

    // PROJECTS
    async getProjects() {
        const res = await fetch(`${API_BASE}/projects`);
        return await res.json();
    },

    async createProject(projectData) {
        const res = await fetch(`${API_BASE}/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(projectData)
        });
        return await res.json();
    },

    async updateProject(id, projectData) {
        const res = await fetch(`${API_BASE}/projects/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(projectData)
        });
        return await res.json();
    },

    async deleteProject(id) {
        const res = await fetch(`${API_BASE}/projects/${id}`, { method: 'DELETE' });
        return await res.json();
    },

    // BUILDS
    async getBuilds(projectId = '') {
        const url = projectId ? `${API_BASE}/builds?project_id=${projectId}` : `${API_BASE}/builds`;
        const res = await fetch(url);
        return await res.json();
    },

    async createBuild(buildData) {
        const res = await fetch(`${API_BASE}/builds`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildData)
        });
        return await res.json();
    },

    async updateBuild(id, buildData) {
        const res = await fetch(`${API_BASE}/builds/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildData)
        });
        return await res.json();
    },

    async deleteBuild(id) {
        const res = await fetch(`${API_BASE}/builds/${id}`, { method: 'DELETE' });
        return await res.json();
    },

    // DEEP WORK
    async getDeepWork(date = '', limit = 50) {
        const url = date ? `${API_BASE}/deep-work?date=${date}` : `${API_BASE}/deep-work?limit=${limit}`;
        const res = await fetch(url);
        return await res.json();
    },

    async logDeepWork(sessionData) {
        const res = await fetch(`${API_BASE}/deep-work`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sessionData)
        });
        return await res.json();
    },

    async deleteDeepWork(id) {
        const res = await fetch(`${API_BASE}/deep-work/${id}`, { method: 'DELETE' });
        return await res.json();
    },

    // LEARNING
    async getLearning(date = '', limit = 50) {
        const url = date ? `${API_BASE}/learning?date=${date}` : `${API_BASE}/learning?limit=${limit}`;
        const res = await fetch(url);
        return await res.json();
    },

    async logLearning(learningData) {
        const res = await fetch(`${API_BASE}/learning`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(learningData)
        });
        return await res.json();
    },

    async deleteLearning(id) {
        const res = await fetch(`${API_BASE}/learning/${id}`, { method: 'DELETE' });
        return await res.json();
    },

    // DASHBOARD & TRENDS
    async getDashboardSummary(date = '') {
        const url = date ? `${API_BASE}/dashboard/summary?date=${date}` : `${API_BASE}/dashboard/summary`;
        const res = await fetch(url);
        return await res.json();
    },

    async getDashboardTrends() {
        const res = await fetch(`${API_BASE}/dashboard/trends`);
        return await res.json();
    },

    async getShiftAnalysis() {
        const res = await fetch(`${API_BASE}/shift-analysis`);
        return await res.json();
    },

    // EXPORT & MIGRATION
    async exportData() {
        const res = await fetch(`${API_BASE}/export`);
        return await res.json();
    },

    async migrateLocalStorage(state) {
        const res = await fetch(`${API_BASE}/migrate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state })
        });
        return await res.json();
    },

    async importBackup(backupData) {
        const res = await fetch(`${API_BASE}/migrate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ backup: backupData })
        });
        return await res.json();
    }
};
