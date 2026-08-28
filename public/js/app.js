/* =========================================================
   ANDUALEM 2.0 V2 CLIENT APP ENGINE
========================================================= */

const MODES = {
    normal: {
        label: "Normal Shift",
        capacity: "3h 45m",
        badge: "NORMAL",
        timeline: [
            ["1:30 AM", "WAKE", "Start the personal day."],
            ["1:30–3:00 AM", "PREPARE + COMMUTE", "Reach work by 3:00 AM."],
            ["3:00–6:30 AM", "WORK", "Employer time."],
            ["6:30–8:00 AM", "LUNCH BREAK", "1h30m lunch break."],
            ["8:00–10:30 AM", "WORK", "Afternoon work."],
            ["10:30–11:45 AM", "COMMUTE HOME", "Public transportation."],
            ["11:45 AM–1:30 PM", "FAMILY + LIFE", "Food, family, chores and transition."],
            ["1:30–3:15 PM", "DEEP BUILD", "Attack today's dragon."],
            ["3:15–3:30 PM", "RESET", "Short break."],
            ["3:30–4:45 PM", "DEEP BUILD", "Continue building."],
            ["4:45–5:15 PM", "SHIP + SHUTDOWN", "Record result and next action."],
            ["5:15 PM–1:30 AM", "SLEEP", "8h15m protected recovery."]
        ]
    },
    night: {
        label: "Night Shift",
        capacity: "6h",
        badge: "ACCELERATOR",
        timeline: [
            ["1:30 AM", "WAKE", "Start the personal day."],
            ["1:30–3:00 AM", "PREPARE + COMMUTE", "Reach work by 3:00 AM."],
            ["3:00–6:30 AM", "WORK", "Employer time."],
            ["6:30–7:30 AM", "LUNCH DUTY", "Night-shift lunch coverage."],
            ["7:30–8:15 AM", "LUNCH", "Eat after covering lunch."],
            ["8:15 AM–3:30 PM", "WORK", "Continue work."],
            ["3:30–6:00 PM", "DEEP BUILD", "Major creative block."],
            ["6:00–6:45 PM", "FOOD + RESET", "Step away from the screen."],
            ["6:45–8:15 PM", "TARGETED LEARNING", "Learn what the build requires."],
            ["8:15–9:30 PM", "BUILD + SHIP", "Implement, test or deploy."],
            ["9:30 PM", "SHUTDOWN", "Close the loop."]
        ]
    },
    recovery: {
        label: "Recovery",
        capacity: "LOW / OPTIONAL",
        badge: "RECOVERY",
        timeline: [
            ["POST SHIFT", "RECOVER", "Prioritize sleep and recovery."],
            ["MORNING", "FOOD + HYDRATION", "Restore energy."],
            ["MIDDAY", "FAMILY + LIFE", "Be present without productivity pressure."],
            ["AFTERNOON", "LIGHT ACTIVITY", "Walk or gentle activity if desired."],
            ["EVENING", "READ / REFLECT", "Optional low-pressure learning."],
            ["NIGHT", "RESET", "Prepare for the next cycle."]
        ]
    }
};

let currentDayData = null;
let toastTimer = null;

function todayString() {
    const d = new Date();
    return d.getFullYear() + "-" +
        String(d.getMonth() + 1).padStart(2, "0") + "-" +
        String(d.getDate()).padStart(2, "0");
}

// Show Toast
function toast(msg = "SAVED TO DATABASE") {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1200);
}

// Navigation View Switcher
function setView(viewName) {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    document.querySelectorAll('.view-section').forEach(sec => {
        sec.classList.toggle('active', sec.id === `view-${viewName}`);
    });

    if (viewName === 'today') renderToday();
    else if (viewName === 'dashboard') renderDashboard();
    else if (viewName === 'shift-analysis') renderShiftAnalysis();
    else if (viewName === 'deep-work') renderDeepWorkView();
    else if (viewName === 'builds') renderBuildsView();
    else if (viewName === 'learning') renderLearningView();
    else if (viewName === 'history') renderHistoryView();
    else if (viewName === 'settings') renderSettingsView();
}

function onDateChanged() {
    const activeBtn = document.querySelector('.nav-btn.active');
    const viewName = activeBtn ? activeBtn.dataset.view : 'today';
    setView(viewName);
}

// =========================================================
// 1. TODAY VIEW
// =========================================================

async function renderToday(fetchFromApi = true) {
    const datePicker = document.getElementById("datePicker");
    if (!datePicker.value) datePicker.value = todayString();
    const date = datePicker.value;

    if (fetchFromApi || !currentDayData) {
        const res = await API.getDay(date);
        if (res && res.success) {
            currentDayData = res;
        }
    }

    if (!currentDayData) return;

    const day = currentDayData.day || { date, shift_type: 'normal', planned_capacity: '3h 45m' };
    const modeKey = day.shift_type || 'normal';
    const modeConfig = MODES[modeKey] || MODES.normal;

    // Header & Stats
    document.getElementById("dateTitle").textContent =
        modeKey === "normal" ? "TODAY — NORMAL SHIFT" :
        modeKey === "night" ? "TODAY — NIGHT SHIFT" : "TODAY — RECOVERY";

    document.querySelectorAll(".mode-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.mode === modeKey);
    });

    document.getElementById("modeStat").textContent = modeConfig.label;
    document.getElementById("capacityStat").textContent = modeConfig.capacity;
    document.getElementById("modeBadge").textContent = modeConfig.badge;

    // Form inputs
    document.getElementById("dragon").value = day.dragon || "";
    document.getElementById("learning").value = day.learning_gap || "";
    document.getElementById("ship").value = day.ship_target || "";
    document.getElementById("reflection").value = day.reflection || "";

    // Timeline
    const timelineEl = document.getElementById("timeline");
    if (timelineEl) {
        timelineEl.innerHTML = modeConfig.timeline.map((item, idx) => `
            <div class="timeline-item">
                <div class="timeline-time">${item[0]}</div>
                <div>
                    <div class="timeline-title">${item[1]}</div>
                    <span class="timeline-description">${item[2]}</span>
                </div>
                <span class="badge">${idx < 3 ? "CORE" : "BLOCK"}</span>
            </div>
        `).join("");
    }

    const tasks = (currentDayData.tasks && currentDayData.tasks.length > 0) ? currentDayData.tasks : [];

    // Mission Checklist
    const missionTasks = tasks.filter(t => t.category === 'mission' && (t.shift_type === modeKey || t.shift_type === 'all'));
    const missionEl = document.getElementById("missionChecklist");
    if (missionEl) {
        missionEl.innerHTML = missionTasks.map(t => `
            <label class="task ${t.completed ? 'done' : ''}">
                <input type="checkbox" ${t.completed ? 'checked' : ''} onchange="toggleTask(${t.task_id}, this.checked)">
                <span>${t.task_name}</span>
            </label>
        `).join("");
    }

    // Life Checklist
    const lifeTasks = tasks.filter(t => t.category === 'life');
    const lifeEl = document.getElementById("lifeChecklist");
    if (lifeEl) {
        lifeEl.innerHTML = lifeTasks.map(t => `
            <label class="task ${t.completed ? 'done' : ''}">
                <input type="checkbox" ${t.completed ? 'checked' : ''} onchange="toggleTask(${t.task_id}, this.checked)">
                <span>${t.task_name}</span>
            </label>
        `).join("");
    }

    // Progress Calculations
    const missionTotal = missionTasks.length;
    const missionDone = missionTasks.filter(t => t.completed).length;
    const missionPct = missionTotal ? Math.round((missionDone / missionTotal) * 100) : 0;

    const mProg = document.getElementById("missionProgress");
    if (mProg) mProg.style.width = missionPct + "%";
    const mProgText = document.getElementById("missionProgressText");
    if (mProgText) mProgText.textContent = missionPct + "%";

    const activeShiftTasks = tasks.filter(t => t.category === 'life' || t.shift_type === modeKey || t.shift_type === 'all');
    const totalTasks = activeShiftTasks.length;
    const totalDone = activeShiftTasks.filter(t => t.completed).length;
    const dailyPct = totalTasks ? Math.round((totalDone / totalTasks) * 100) : 0;

    const dProg = document.getElementById("dailyProgress");
    if (dProg) dProg.style.width = dailyPct + "%";
    const dProgText = document.getElementById("dailyProgressText");
    if (dProgText) dProgText.textContent = dailyPct + "%";
    const compStat = document.getElementById("completionStat");
    if (compStat) compStat.textContent = dailyPct + "%";

    // Populate dropdowns for quick deep work & learning loggers on Today view
    populateProjectDropdowns();
}

async function changeMode(mode) {
    const datePicker = document.getElementById("datePicker");
    if (!datePicker.value) datePicker.value = todayString();
    const date = datePicker.value;

    const capacity = MODES[mode] ? MODES[mode].capacity : '3h 45m';

    if (!currentDayData) {
        currentDayData = { day: { date, shift_type: mode, planned_capacity: capacity }, tasks: [], deepWork: [], learning: [] };
    } else {
        if (!currentDayData.day) currentDayData.day = { date, shift_type: mode, planned_capacity: capacity };
        else {
            currentDayData.day.shift_type = mode;
            currentDayData.day.planned_capacity = capacity;
        }
    }

    // Immediately re-render UI optimistically
    renderToday(false);

    // Save to API & LocalStorage
    const res = await API.saveDay(date, { shift_type: mode, planned_capacity: capacity });
    if (res && res.day) {
        currentDayData.day = { ...currentDayData.day, ...res.day };
        renderToday(false);
    }
    toast(`SHIFT SWITCHED TO ${mode.toUpperCase()}`);
}

async function saveDayField(field, value) {
    const date = document.getElementById("datePicker").value;
    const payload = {};
    payload[field] = value;
    await API.saveDay(date, payload);
    toast();
}

async function submitDayTargets() {
    const datePicker = document.getElementById("datePicker");
    const date = datePicker && datePicker.value ? datePicker.value : todayString();
    
    const dragon = document.getElementById("dragon") ? document.getElementById("dragon").value : "";
    const learning_gap = document.getElementById("learning") ? document.getElementById("learning").value : "";
    const ship_target = document.getElementById("ship") ? document.getElementById("ship").value : "";
    const reflection = document.getElementById("reflection") ? document.getElementById("reflection").value : "";

    const payload = {
        dragon,
        learning_gap,
        ship_target,
        reflection
    };

    const res = await API.saveDay(date, payload);
    if (res && res.success) {
        if (currentDayData && currentDayData.day) {
            Object.assign(currentDayData.day, payload);
        }
        const statusEl = document.getElementById("saveTargetsStatus");
        if (statusEl) {
            statusEl.style.display = "inline";
            setTimeout(() => { statusEl.style.display = "none"; }, 3500);
        }
        toast("OBJECTIVES & REFLECTION SAVED TO DATABASE");
    } else {
        toast("ERROR SAVING TO DATABASE");
    }
}

async function toggleTask(taskId, completed) {
    const date = document.getElementById("datePicker").value;
    await API.toggleTask(date, taskId, completed);
    renderToday();
}

async function resetCurrentDay() {
    if (!confirm("Reset today's data?")) return;
    const date = document.getElementById("datePicker").value;
    await API.resetDay(date);
    renderToday();
    toast("TODAY RESET");
}

// Helper for SVG Circle Rings
function setCircleProgress(ringId, textId, percent) {
    const ring = document.getElementById(ringId);
    const text = document.getElementById(textId);
    const C = 238.76;
    const pct = Math.min(100, Math.max(0, Math.round(percent || 0)));
    if (ring) {
        ring.style.strokeDashoffset = (C - (C * (pct / 100))).toFixed(2);
    }
    if (text) {
        text.textContent = pct + "%";
    }
}

// Helper for Linear Progress Bars
function setProgressBar(barId, current, target) {
    const bar = document.getElementById(barId);
    if (!bar) return;
    const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
    bar.style.width = pct + "%";
}

// =========================================================
// 2. DASHBOARD VIEW
// =========================================================

async function renderDashboard() {
    const selectedDate = (document.getElementById("datePicker") && document.getElementById("datePicker").value) ? document.getElementById("datePicker").value : todayString();
    const res = await API.getDashboardSummary(selectedDate);
    if (!res.success) return;

    const t = res.today;
    const w = res.this_week;
    const m = res.this_month;

    // 1. TODAY SUMMARY
    document.getElementById("dashTodayShift").textContent = (t.shift_type || 'normal').toUpperCase();
    
    // Circular SVG Gauges for Today
    setCircleProgress("ringTodayDaily", "ringTodayDailyText", t.daily_completion_percent);
    setCircleProgress("ringTodayMission", "ringTodayMissionText", t.mission_completion_percent);

    // Deep Work Bar (Target: 3.75 hrs for Normal, 6 hrs for Night)
    const plannedMins = t.shift_type === 'night' ? 360 : 225;
    const todayDeepHours = (t.deep_work_minutes / 60).toFixed(1);
    document.getElementById("dashTodayDeepWork").textContent = `${todayDeepHours} / ${(plannedMins / 60).toFixed(1)} hrs`;
    setProgressBar("barTodayDeepWork", t.deep_work_minutes, plannedMins);

    document.getElementById("dashTodayPlanned").textContent = t.planned_capacity;
    document.getElementById("dashTodayDragon").textContent = t.dragon || "None defined";
    document.getElementById("dashTodayProject").textContent = t.active_project;
    document.getElementById("dashTodayBuild").textContent = t.active_build;

    // 2. THIS WEEK (Targets: 20h Deep Work, 30 Tasks, 5 Features Shipped, 10h Learning)
    const wDeepWork = parseFloat(w.deep_work_hours || 0);
    const wLearning = parseFloat(w.learning_hours || 0);

    document.getElementById("dashWeekDeepWork").textContent = `${wDeepWork.toFixed(1)} / 20 hrs`;
    setProgressBar("barWeekDeepWork", wDeepWork, 20);

    document.getElementById("dashWeekTasks").textContent = `${w.tasks_completed} / 30`;
    setProgressBar("barWeekTasks", w.tasks_completed, 30);

    document.getElementById("dashWeekShipped").textContent = `${w.shipped_features} / 5`;
    setProgressBar("barWeekShipped", w.shipped_features, 5);

    document.getElementById("dashWeekLearning").textContent = `${wLearning.toFixed(1)} / 10 hrs`;
    setProgressBar("barWeekLearning", wLearning, 10);

    // 3. THIS MONTH (Targets: 80h Deep Work, 20 Features Shipped)
    const mDeepWork = parseFloat(m.deep_work_hours || 0);
    setCircleProgress("ringMonthCompletion", "ringMonthCompletionText", m.average_daily_completion);

    document.getElementById("dashMonthDeepWork").textContent = `${mDeepWork.toFixed(1)} / 80 hrs`;
    setProgressBar("barMonthDeepWork", mDeepWork, 80);

    document.getElementById("dashMonthShipped").textContent = `${m.shipped_features} / 20`;
    setProgressBar("barMonthShipped", m.shipped_features, 20);

    document.getElementById("dashMonthLearning").textContent = m.learning_sessions;

    // Fetch Trends for Canvas Charts
    const trendsRes = await API.getDashboardTrends();
    if (trendsRes.success) {
        const tr = trendsRes.trends;
        const dwLabels = tr.deep_work.map(x => x.month);
        const dwData = tr.deep_work.map(x => x.hours);
        Charts.renderBarChart('chartDeepWork', dwLabels, dwData, 'Deep Work Hours', '#55e7ff');

        const shLabels = tr.shipped.map(x => x.month);
        const shData = tr.shipped.map(x => x.shipped_count);
        Charts.renderBarChart('chartShipped', shLabels, shData, 'Features Shipped', '#5dffb0');
    }
}

// =========================================================
// 3. SHIFT ANALYSIS VIEW
// =========================================================

async function renderShiftAnalysis() {
    const res = await API.getShiftAnalysis();
    if (!res.success) return;

    Charts.renderShiftComparison('shiftComparisonContainer', res.shift_stats);

    const tbody = document.getElementById("shiftTableBody");
    tbody.innerHTML = res.shift_stats.map(s => {
        const shippedObj = res.shipped_by_shift.find(x => x.shift_type === s.shift_type);
        const shippedCount = shippedObj ? shippedObj.shipped_count : 0;
        return `
            <tr>
                <td><strong>${s.shift_type.toUpperCase()}</strong></td>
                <td>${s.total_days}</td>
                <td>${((s.total_deep_work_mins || 0) / 60).toFixed(1)} hrs</td>
                <td>${Math.round(s.avg_deep_work_mins || 0)} mins (${((s.avg_deep_work_mins || 0) / 60).toFixed(1)} hrs)</td>
                <td>${shippedCount}</td>
                <td>${s.avg_tasks_completed || 0}</td>
            </tr>
        `;
    }).join("");
}

// =========================================================
// 4. DEEP WORK VIEW
// =========================================================

async function renderDeepWorkView() {
    const date = document.getElementById("deepWorkDate") ? document.getElementById("deepWorkDate").value || todayString() : todayString();
    if (document.getElementById("deepWorkDate")) document.getElementById("deepWorkDate").value = date;

    const res = await API.getDeepWork('', 100);
    if (!res.success) return;

    const tbody = document.getElementById("deepWorkTableBody");
    tbody.innerHTML = res.sessions.map(s => `
        <tr>
            <td>${s.date}</td>
            <td>${s.start_time} - ${s.end_time}</td>
            <td><strong>${s.duration_minutes} mins</strong> (${(s.duration_minutes / 60).toFixed(1)}h)</td>
            <td>${s.project_name || 'N/A'}</td>
            <td>${s.feature_name || 'N/A'}</td>
            <td>${s.description || '-'}</td>
            <td>
                <button class="btn btn-danger" style="padding:4px 8px; font-size:9px;" onclick="deleteDeepWork(${s.id})">DELETE</button>
            </td>
        </tr>
    `).join("");

    populateProjectDropdowns();
}

function calculateDuration() {
    const start = document.getElementById("dwStart").value;
    const end = document.getElementById("dwEnd").value;
    if (start && end) {
        const [sH, sM] = start.split(":").map(Number);
        const [eH, eM] = end.split(":").map(Number);
        let diff = (eH * 60 + eM) - (sH * 60 + sM);
        if (diff < 0) diff += 24 * 60; // Over Midnight
        document.getElementById("dwDuration").value = diff;
    }
}

async function logDeepWorkSession(e) {
    if (e) e.preventDefault();
    const date = document.getElementById("dwDate").value || todayString();
    const start_time = document.getElementById("dwStart").value;
    const end_time = document.getElementById("dwEnd").value;
    const duration_minutes = parseInt(document.getElementById("dwDuration").value);
    const project_id = document.getElementById("dwProject").value || null;
    const build_id = document.getElementById("dwBuild").value || null;
    const description = document.getElementById("dwDesc").value;

    if (!duration_minutes || duration_minutes <= 0) {
        alert("Please enter a valid session duration in minutes.");
        return;
    }

    await API.logDeepWork({ date, start_time, end_time, duration_minutes, project_id, build_id, description });
    toast("DEEP WORK SESSION LOGGED");
    renderDeepWorkView();
}

async function deleteDeepWork(id) {
    if (!confirm("Delete this deep work session?")) return;
    await API.deleteDeepWork(id);
    renderDeepWorkView();
    toast("DEEP WORK DELETED");
}

// =========================================================
// 5. BUILDS & PROJECTS VIEW
// =========================================================

async function renderBuildsView() {
    const projRes = await API.getProjects();
    const buildRes = await API.getBuilds();

    if (projRes.success) {
        const grid = document.getElementById("projectsGrid");
        grid.innerHTML = projRes.projects.map(p => `
            <div class="card span-6">
                <div class="card-header">
                    <h2>📦 ${p.name}</h2>
                    <span class="badge ${p.status === 'COMPLETED' ? 'badge-shipped' : 'badge-progress'}">${p.status}</span>
                </div>
                <p style="color: var(--muted); font-size:11px; margin-bottom: 12px;">${p.description || 'No description'}</p>
                <div style="font-size:10px; color: var(--cyan); display:flex; justify-content:space-between; margin-bottom:12px;">
                    <span>Builds: ${p.shipped_builds} / ${p.total_builds} Shipped</span>
                    <span>Deep Work: ${((p.total_deep_work_minutes || 0) / 60).toFixed(1)} hrs</span>
                </div>
                <div style="display:flex; gap:6px;">
                    <button class="btn" onclick="openAddBuildModal(${p.id})">+ ADD FEATURE BUILD</button>
                    <button class="btn btn-danger" onclick="deleteProject(${p.id})">DELETE</button>
                </div>
            </div>
        `).join("");
    }

    if (buildRes.success) {
        const tbody = document.getElementById("buildsTableBody");
        tbody.innerHTML = buildRes.builds.map(b => {
            const badgeClass = b.status === 'SHIPPED' ? 'badge-shipped' : (b.status === 'BLOCKED' ? 'badge-blocked' : 'badge-progress');
            return `
                <tr>
                    <td><strong>${b.project_name}</strong></td>
                    <td>${b.feature_name}</td>
                    <td><span class="badge ${badgeClass}">${b.status}</span></td>
                    <td>${b.shipped_at ? new Date(b.shipped_at).toLocaleDateString() : '-'}</td>
                    <td>
                        <select onchange="updateBuildStatus(${b.id}, this.value)" style="padding:4px; font-size:10px;">
                            <option value="PLANNED" ${b.status === 'PLANNED' ? 'selected' : ''}>PLANNED</option>
                            <option value="IN PROGRESS" ${b.status === 'IN PROGRESS' ? 'selected' : ''}>IN PROGRESS</option>
                            <option value="TESTING" ${b.status === 'TESTING' ? 'selected' : ''}>TESTING</option>
                            <option value="SHIPPED" ${b.status === 'SHIPPED' ? 'selected' : ''}>SHIPPED</option>
                            <option value="BLOCKED" ${b.status === 'BLOCKED' ? 'selected' : ''}>BLOCKED</option>
                        </select>
                    </td>
                    <td>
                        <button class="btn btn-danger" style="padding:4px 8px; font-size:9px;" onclick="deleteBuild(${b.id})">DELETE</button>
                    </td>
                </tr>
            `;
        }).join("");
    }

    populateProjectDropdowns();
}

async function createProject(e) {
    if (e) e.preventDefault();
    const name = document.getElementById("projectName").value;
    const description = document.getElementById("projectDesc").value;
    const status = document.getElementById("projectStatus").value;

    if (!name) return alert("Project name is required.");

    await API.createProject({ name, description, status });
    toast("PROJECT CREATED");
    document.getElementById("projectName").value = "";
    document.getElementById("projectDesc").value = "";
    renderBuildsView();
}

async function createBuildFeature(e) {
    if (e) e.preventDefault();
    const project_id = document.getElementById("buildProject").value;
    const feature_name = document.getElementById("buildFeatureName").value;
    const status = document.getElementById("buildStatus").value;
    const notes = document.getElementById("buildNotes").value;

    if (!project_id || !feature_name) return alert("Project and Feature Name required.");

    await API.createBuild({ project_id, feature_name, status, notes });
    toast("FEATURE BUILD ADDED");
    document.getElementById("buildFeatureName").value = "";
    renderBuildsView();
}

async function updateBuildStatus(id, newStatus) {
    await API.updateBuild(id, { status: newStatus });
    toast(`BUILD SET TO ${newStatus}`);
    renderBuildsView();
}

async function deleteProject(id) {
    if (!confirm("Delete project and all its builds?")) return;
    await API.deleteProject(id);
    renderBuildsView();
}

async function deleteBuild(id) {
    if (!confirm("Delete feature build?")) return;
    await API.deleteBuild(id);
    renderBuildsView();
}

// =========================================================
// 6. LEARNING VIEW
// =========================================================

async function renderLearningView() {
    if (document.getElementById("learnDate") && !document.getElementById("learnDate").value) {
        document.getElementById("learnDate").value = currentDate || todayString();
    }

    const res = await API.getLearning('', 100);
    if (!res || !res.success) return;

    const entries = res.learning || [];
    const totalMins = entries.reduce((acc, x) => acc + (x.duration_minutes || 0), 0);
    const appliedCount = entries.filter(x => x.applied_to_build).length;
    const applyRatio = entries.length ? Math.round((appliedCount / entries.length) * 100) : 0;

    if (document.getElementById("learnTotalHours")) {
        document.getElementById("learnTotalHours").textContent = (totalMins / 60).toFixed(1) + " hrs";
    }
    if (document.getElementById("learnApplyRatio")) {
        document.getElementById("learnApplyRatio").textContent = applyRatio + "% Applied to Build";
    }

    const tbody = document.getElementById("learningTableBody");
    if (tbody) {
        if (entries.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: var(--text-secondary); padding: 16px;">No learning sessions logged yet.</td></tr>';
        } else {
            tbody.innerHTML = entries.map(l => `
                <tr>
                    <td>${l.date}</td>
                    <td><strong>${l.topic}</strong></td>
                    <td>${l.purpose || '-'}</td>
                    <td>${l.duration_minutes} mins</td>
                    <td>${l.project_name || '-'}${l.feature_name ? ' / ' + l.feature_name : ''}</td>
                    <td>
                        <span class="badge ${l.applied_to_build ? 'badge-shipped' : ''}">
                            ${l.applied_to_build ? '✓ APPLIED' : 'THEORY ONLY'}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-danger" style="padding:4px 8px; font-size:9px;" onclick="deleteLearning(${l.id})">DELETE</button>
                    </td>
                </tr>
            `).join("");
        }
    }

    populateProjectDropdowns();
}

async function logLearningSession(e) {
    if (e) e.preventDefault();
    const date = document.getElementById("learnDate")?.value || currentDate || todayString();
    const topic = document.getElementById("learnTopic")?.value;
    const purpose = document.getElementById("learnPurpose")?.value || "";
    const duration_minutes = parseInt(document.getElementById("learnDuration")?.value);
    const project_id = document.getElementById("learnProject")?.value || null;
    const build_id = document.getElementById("learnBuild")?.value || null;
    const applied_to_build = document.getElementById("learnApplied") ? document.getElementById("learnApplied").checked : false;

    if (!topic || !duration_minutes || isNaN(duration_minutes)) {
        return alert("Topic and Duration (in minutes) are required.");
    }

    const res = await API.logLearning({ date, topic, purpose, duration_minutes, project_id, build_id, applied_to_build });
    if (res && res.success) {
        toast("LEARNING SESSION LOGGED");
        if (document.getElementById("learnTopic")) document.getElementById("learnTopic").value = "";
        if (document.getElementById("learnPurpose")) document.getElementById("learnPurpose").value = "";
        if (document.getElementById("learnDuration")) document.getElementById("learnDuration").value = "";
        renderLearningView();
    } else {
        alert("Failed to save learning entry: " + (res?.error || "Unknown error"));
    }
}

async function deleteLearning(id) {
    if (!confirm("Delete learning entry?")) return;
    await API.deleteLearning(id);
    renderLearningView();
}

async function updateBuildOptions(projSelectId, buildSelectId) {
    const projEl = document.getElementById(projSelectId);
    const buildEl = document.getElementById(buildSelectId);
    if (!projEl || !buildEl) return;

    const projId = projEl.value;
    if (!projId) {
        buildEl.innerHTML = '<option value="">-- Select Feature Build --</option>';
        return;
    }
    const bRes = await API.getBuilds(projId);
    if (bRes && bRes.success) {
        const currentVal = buildEl.value;
        buildEl.innerHTML = '<option value="">-- Select Feature Build --</option>' +
            bRes.builds.map(b => `<option value="${b.id}">${b.feature_name}</option>`).join("");
        if (currentVal) buildEl.value = currentVal;
    }
}

// Helper to populate project dropdowns
async function populateProjectDropdowns() {
    const res = await API.getProjects();
    if (!res.success) return;

    const selects = ["dwProject", "learnProject", "buildProject"];
    selects.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const current = el.value;
        el.innerHTML = '<option value="">-- Select Project --</option>' +
            res.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join("");
        if (current) el.value = current;
    });

    await updateBuildOptions("dwProject", "dwBuild");
    await updateBuildOptions("learnProject", "learnBuild");
}

// =========================================================
// 7. HISTORY VIEW
// =========================================================

async function renderHistoryView() {
    const shiftFilter = document.getElementById("historyShiftFilter") ? document.getElementById("historyShiftFilter").value : '';
    const res = await API.getDaysHistory(60, shiftFilter);
    if (!res.success) return;

    const container = document.getElementById("historyGrid");
    if (!res.days || res.days.length === 0) {
        container.innerHTML = '<div class="card span-12" style="text-align:center; padding:24px; color: var(--muted);">No historical day records found.</div>';
        return;
    }
    container.innerHTML = res.days.map(d => `
        <div class="card span-4" style="cursor:pointer;" onclick="inspectHistoryDay('${d.date}')">
            <div class="card-header">
                <h2>${d.date}</h2>
                <span class="badge">${(d.shift_type || 'normal').toUpperCase()}</span>
            </div>
            <p style="font-size:11px; color: var(--cyan); margin-bottom:6px;">🐉 ${d.dragon || 'No Dragon'}</p>
            <p style="font-size:10px; color: var(--violet); margin-bottom:6px;">🧠 ${d.learning_gap || 'No Learning Gap'}</p>
            <p style="font-size:10px; color: var(--muted); margin-bottom:8px;">🚀 Target: ${d.ship_target || 'N/A'}</p>
            <div style="font-size:9px; color: var(--text-secondary); border-top:1px solid var(--card-border); padding-top:6px; margin-top:4px;">Click to inspect day snapshot</div>
        </div>
    `).join("");
}

// =========================================================
// 8. SETTINGS & MIGRATION VIEW
// =========================================================

async function renderSettingsView() {
    const raw = localStorage.getItem("ANDUALEM_2_0");
    const count = raw ? Object.keys(JSON.parse(raw)).length : 0;
    document.getElementById("localStorageCount").textContent = `${count} days in localStorage`;
}

async function migrateLocalStorageData() {
    const raw = localStorage.getItem("ANDUALEM_2_0");
    if (!raw) return alert("No existing localStorage data found to migrate.");

    try {
        const state = JSON.parse(raw);
        const res = await API.migrateLocalStorage(state);
        if (res.success) {
            alert(res.message);
            toast("MIGRATION COMPLETED");
            renderSettingsView();
        } else {
            alert("Migration failed: " + res.error);
        }
    } catch (err) {
        alert("Invalid localStorage data: " + err.message);
    }
}

async function clearAllSQLiteData() {
    if (!confirm("⚠️ CAUTION: Delete all data in SQLite database? This cannot be undone!")) return;
    alert("Clear data requested.");
}

async function exportAllData() {
    try {
        const res = await API.exportData();
        if (!res.success || !res.backup) {
            return alert("Failed to generate backup.");
        }

        const dateStr = todayString();
        const fileName = `ANDUALEM_2_0_BACKUP_${dateStr}.json`;
        const jsonStr = JSON.stringify(res.backup, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast(`EXPORTED BACKUP TO ${fileName}`);
    } catch (err) {
        alert("Error exporting data: " + err.message);
    }
}

async function importBackupJSON(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
        try {
            const backupData = JSON.parse(evt.target.result);
            const res = await API.importBackup(backupData);
            if (res.success) {
                alert(res.message);
                toast("BACKUP RESTORED SUCCESSFULLY");
            } else {
                alert("Import failed: " + res.error);
            }
        } catch (err) {
            alert("Invalid JSON file: " + err.message);
        }
    };
    reader.readAsText(file);
}

// =========================================================
// MODAL SYSTEM (80% OPACITY OVERLAY)
// =========================================================

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

// ESC Key & Outside Click Listener
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(m => closeModal(m.id));
    }
});

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        closeModal(e.target.id);
    }
});

// Helper to open Five Laws Modal
function openFiveLawsModal() {
    openModal('modalFiveLaws');
}

// Helper to open Full Timeline Modal
function openTimelineModal() {
    const modeKey = currentDayData ? (currentDayData.day.shift_type || 'normal') : 'normal';
    const modeConfig = MODES[modeKey] || MODES.normal;

    document.getElementById("modalTimelineTitle").textContent = `${modeConfig.label} Timeline Architecture`;
    document.getElementById("modalTimelineContent").innerHTML = modeConfig.timeline.map((item, idx) => `
        <div class="timeline-item" style="margin-bottom:8px;">
            <div class="timeline-time">${item[0]}</div>
            <div>
                <div class="timeline-title">${item[1]}</div>
                <span class="timeline-description">${item[2]}</span>
            </div>
            <span class="badge">${idx < 3 ? "CORE" : "BLOCK"}</span>
        </div>
    `).join("");

    openModal('modalTimeline');
}

// Helper to open History Inspection Modal
async function inspectHistoryDay(date) {
    const res = await API.getDay(date);
    if (!res.success) return;

    const d = res.day;
    const modeKey = d.shift_type || 'normal';
    const modeConfig = MODES[modeKey] || MODES.normal;

    document.getElementById("modalHistoryDate").textContent = `DATE: ${date} (${modeConfig.label.toUpperCase()})`;
    document.getElementById("modalHistoryBody").innerHTML = `
        <div style="display:grid; gap:16px;">
            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:12px;">
                <div class="card">
                    <div style="font-size:10px; color:var(--cyan); font-weight:800;">🐉 TODAY'S DRAGON</div>
                    <div style="font-size:12px; margin-top:4px;">${d.dragon || 'None defined'}</div>
                </div>
                <div class="card">
                    <div style="font-size:10px; color:var(--violet); font-weight:800;">🧠 LEARNING GAP</div>
                    <div style="font-size:12px; margin-top:4px;">${d.learning_gap || 'None defined'}</div>
                </div>
                <div class="card">
                    <div style="font-size:10px; color:var(--green); font-weight:800;">🚀 SHIP TARGET</div>
                    <div style="font-size:12px; margin-top:4px;">${d.ship_target || 'None defined'}</div>
                </div>
            </div>

            <div class="card">
                <div style="font-size:10px; color:var(--yellow); font-weight:800; margin-bottom:6px;">📓 SHUTDOWN REFLECTION</div>
                <div style="font-size:12px; color:var(--text); white-space:pre-wrap;">${d.reflection || 'No reflection recorded.'}</div>
            </div>

            <div>
                <div style="font-size:12px; font-weight:800; color:var(--cyan); margin-bottom:8px;">COMPLETED TASKS</div>
                <div class="checklist">
                    ${res.tasks.map(t => `
                        <div class="task ${t.completed ? 'done' : ''}" style="cursor:default;">
                            <span style="color: ${t.completed ? 'var(--green)' : 'var(--muted)'}">
                                ${t.completed ? '✓' : '○'} ${t.task_name}
                            </span>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div>
                <div style="font-size:12px; font-weight:800; color:var(--cyan); margin-bottom:8px;">DEEP WORK SESSIONS</div>
                ${res.deepWork.length === 0 ? '<div class="field-description">No deep work sessions recorded.</div>' :
                    `<table class="cyber-table">
                        <thead><tr><th>TIME</th><th>DURATION</th><th>PROJECT</th><th>DESCRIPTION</th></tr></thead>
                        <tbody>${res.deepWork.map(s => `<tr><td>${s.start_time}-${s.end_time}</td><td>${s.duration_minutes}m</td><td>${s.project_name || '-'}</td><td>${s.description || '-'}</td></tr>`).join('')}</tbody>
                    </table>`
                }
            </div>
        </div>
    `;

    openModal('modalHistoryInspect');
}

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("datePicker").value = todayString();
    setView('today');

    const dwStart = document.getElementById("dwStart");
    const dwEnd = document.getElementById("dwEnd");
    if (dwStart && dwEnd) {
        dwStart.addEventListener("change", calculateDuration);
        dwEnd.addEventListener("change", calculateDuration);
    }
});
