/* =========================================================
   ANDUALEM 2.0 OFFLINE CANVAS & SVG CHART ENGINE
   No External Libraries / 100% Local
========================================================= */

const Charts = {
    renderBarChart(canvasId, labels, data, labelName, color = '#55e7ff') {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        // High DPI scaling
        const rect = canvas.getBoundingClientRect();
        canvas.width = (rect.width || 600) * 2;
        canvas.height = (rect.height || 220) * 2;
        ctx.scale(2, 2);

        const width = rect.width || 600;
        const height = rect.height || 220;
        const padding = 40;

        ctx.clearRect(0, 0, width, height);

        if (!data || data.length === 0) {
            ctx.fillStyle = '#748298';
            ctx.font = '12px Orbitron, sans-serif';
            ctx.fillText('No historical trend data recorded yet.', width / 2 - 110, height / 2);
            return;
        }

        const maxValue = Math.max(...data, 5);
        const chartWidth = width - padding * 2;
        const chartHeight = height - padding * 2;
        const barWidth = Math.min(40, (chartWidth / data.length) - 15);

        // Draw Axes & Grid lines
        ctx.strokeStyle = 'rgba(120, 150, 255, 0.15)';
        ctx.lineWidth = 1;

        for (let i = 0; i <= 4; i++) {
            const y = height - padding - (chartHeight * (i / 4));
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(width - padding, y);
            ctx.stroke();

            // Y-axis labels
            ctx.fillStyle = '#68778b';
            ctx.font = '9px Orbitron, sans-serif';
            ctx.fillText(Math.round(maxValue * (i / 4)), 10, y + 3);
        }

        // Draw Bars
        data.forEach((val, idx) => {
            const barH = (val / maxValue) * chartHeight;
            const x = padding + (idx * (chartWidth / data.length)) + ((chartWidth / data.length) - barWidth) / 2;
            const y = height - padding - barH;

            // Bar Gradient
            const gradient = ctx.createLinearGradient(0, y, 0, height - padding);
            gradient.addColorStop(0, color);
            gradient.addColorStop(1, 'rgba(113, 136, 255, 0.1)');

            ctx.fillStyle = gradient;
            ctx.fillRect(x, y, barWidth, barH);

            ctx.strokeStyle = color;
            ctx.strokeRect(x, y, barWidth, barH);

            // Value text above bar
            ctx.fillStyle = '#eef7ff';
            ctx.font = '10px Orbitron, sans-serif';
            ctx.fillText(val, x + (barWidth / 2) - 8, y - 6);

            // X label below
            ctx.fillStyle = '#748298';
            ctx.font = '9px Orbitron, sans-serif';
            const lText = labels[idx] || '';
            ctx.fillText(lText, x + (barWidth / 2) - 14, height - padding + 16);
        });
    },

    renderShiftComparison(containerId, shiftStats) {
        const el = document.getElementById(containerId);
        if (!el) return;

        if (!shiftStats || shiftStats.length === 0) {
            el.innerHTML = `<div class="field-description">Accumulate data across Normal, Night, and Recovery shifts to reveal performance patterns.</div>`;
            return;
        }

        const maxMins = Math.max(...shiftStats.map(s => s.avg_deep_work_mins || 0), 1);

        el.innerHTML = shiftStats.map(s => {
            const shiftName = s.shift_type.toUpperCase() + ' SHIFT';
            const avgMins = Math.round(s.avg_deep_work_mins || 0);
            const avgHours = (avgMins / 60).toFixed(1);
            const pct = Math.round((avgMins / maxMins) * 100);
            const totalDays = s.total_days || 0;
            const avgTasks = s.avg_tasks_completed || 0;

            return `
                <div style="margin-bottom: 16px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 11px;">
                        <span><strong>${shiftName}</strong> (${totalDays} days recorded)</span>
                        <span style="color: var(--cyan);">${avgHours} hrs avg deep work (${avgTasks} tasks/day)</span>
                    </div>
                    <div class="progress" style="height: 10px;">
                        <div class="progress-fill" style="width: ${pct}%;"></div>
                    </div>
                </div>
            `;
        }).join('');
    }
};
