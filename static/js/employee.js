// ===== LeaveOS EMPLOYEE MODULE =====
const Employee = {
  user: null,
  _dashData: null,
  _histData: [],

  async init(user) {
    this.user = user;
    this.renderLayout();
    await this.navigate('dashboard');
    const dd = await API.empDashboard().catch(() => ({}));
    await AIAssistant.init({ ...user, dashboardData: dd });
  },

  renderLayout() {
    document.getElementById('app').innerHTML = `
      <div class="app-layout">
        <aside class="sidebar">
          <div class="sidebar-header">
            <div class="sidebar-brand">
              <div class="brand-icon">🏢</div>
              <div class="brand-name">Leave<span>OS</span></div>
            </div>
            <div class="user-card">
              <div class="user-avatar">${UI.avatar(this.user.name)}</div>
              <div class="user-info">
                <div class="user-name">${this.user.name}</div>
                <div class="user-role">Employee</div>
              </div>
            </div>
          </div>
          <nav class="sidebar-nav">
            <div class="nav-section-label">Overview</div>
            <div class="nav-item active" id="nav-dashboard" onclick="Employee.navigate('dashboard')">
              <span class="nav-icon">📊</span>Dashboard
            </div>
            <div class="nav-section-label">Leaves</div>
            <div class="nav-item" id="nav-apply" onclick="Employee.navigate('apply')">
              <span class="nav-icon">✍️</span>Apply for Leave
            </div>
            <div class="nav-item" id="nav-history" onclick="Employee.navigate('history')">
              <span class="nav-icon">📋</span>My Requests
            </div>
            <div class="nav-section-label">Account</div>
            <div class="nav-item" id="nav-profile" onclick="Employee.navigate('profile')">
              <span class="nav-icon">👤</span>My Profile
            </div>
          </nav>
          <div class="sidebar-footer">
            <button class="logout-btn" onclick="App.logout()"><span>🚪</span>Sign Out</button>
          </div>
        </aside>
        <main class="main-content" id="main-content">
          <div class="loading-page"><div class="spinner"></div></div>
        </main>
      </div>`;
  },

  async navigate(page) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navEl = document.getElementById('nav-' + page);
    if (navEl) navEl.classList.add('active');
    const mc = document.getElementById('main-content');
    UI.loading(mc);
    try {
      switch (page) {
        case 'dashboard':
          await this.renderDashboard(mc);
          setTimeout(() => this.drawCharts(), 60);
          break;
        case 'apply':
          this.renderApply(mc);
          break;
        case 'history':
          await this.renderHistory(mc);
          break;
        case 'profile':
          await this.renderProfile(mc);
          break;
      }
    } catch (e) {
      mc.innerHTML = `<div class="page-content"><div class="empty-state">
        <div class="empty-icon">⚠️</div><h3>Error loading page</h3><p>${e.message}</p>
      </div></div>`;
    }
  },

  // ─── DASHBOARD ───────────────────────────────────────────────────────────
  async renderDashboard(mc) {
    const d = await API.empDashboard();
    const emp = d.employee;
    const bal = emp.leave_balance;
    const taken = emp.leave_taken;

    this._dashData = { bal, taken, leaves: d.leaves };

    const balanceCards = [
      ['Annual Leave', bal.annual,  taken.annual,  'text-amber', 'fill-amber'],
      ['Sick Leave',   bal.sick,    taken.sick,    'text-green', 'fill-green'],
      ['Casual Leave', bal.casual,  taken.casual,  'text-blue',  'fill-blue'],
    ].map(([label, rem, tak, textCls, barCls]) => {
      const total = rem + tak;
      const pct = total > 0 ? Math.round((rem / total) * 100) : 100;
      return `
        <div class="balance-card">
          <div class="balance-type">${label}</div>
          <div class="balance-count ${textCls}">${rem}</div>
          <div class="balance-total">of ${total} days total</div>
          <div class="balance-bar">
            <div class="balance-fill ${barCls}" style="width:${pct}%"></div>
          </div>
        </div>`;
    }).join('');

    const recentLeaves = d.leaves.length === 0
      ? `<div class="empty-state">
           <div class="empty-icon">📋</div>
           <h3>No leave requests yet</h3>
           <p>Apply for your first leave above!</p>
         </div>`
      : `<div class="leave-timeline">
          ${d.leaves.slice(0, 5).map(l => `
            <div class="leave-item ${l.status}">
              <div class="leave-item-info">
                <div class="leave-item-type">
                  ${UI.cap(l.type)} Leave
                  <span class="badge badge-${l.status}">${l.status}</span>
                </div>
                <div class="leave-item-dates">
                  📅 ${UI.fmtDate(l.from_date)} → ${UI.fmtDate(l.to_date)}
                  · ${l.days} day${l.days > 1 ? 's' : ''}
                </div>
                <div class="leave-item-reason">"${l.reason}"</div>
                ${l.manager_note
                  ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px;">
                       💬 Manager: "${l.manager_note}"
                     </div>`
                  : ''}
              </div>
            </div>`).join('')}
        </div>`;

    mc.innerHTML = `
      <div class="page-header">
        <div>
          <h1>My Dashboard</h1>
          <p>Track your leaves and requests</p>
        </div>
        <button class="btn btn-amber" onclick="Employee.navigate('apply')">✍️ Apply for Leave</button>
      </div>
      <div class="page-content">

        <div class="balance-grid">${balanceCards}</div>

        <div class="stats-grid mb-32">
          <div class="stat-card amber">
            <span class="stat-icon">📋</span>
            <div class="stat-value">${d.stats.pending}</div>
            <div class="stat-label">Pending Requests</div>
          </div>
          <div class="stat-card green">
            <span class="stat-icon">✅</span>
            <div class="stat-value">${d.stats.approved}</div>
            <div class="stat-label">Approved Leaves</div>
          </div>
          <div class="stat-card red">
            <span class="stat-icon">❌</span>
            <div class="stat-value">${d.stats.rejected}</div>
            <div class="stat-label">Rejected</div>
          </div>
          <div class="stat-card blue">
            <span class="stat-icon">👤</span>
            <div class="stat-value">${d.manager_name.split(' ')[0]}</div>
            <div class="stat-label">My Manager</div>
          </div>
        </div>

        <div class="grid-2 mb-24">
          <div class="card">
            <div class="card-header">
              <div class="card-title">📊 Leave Usage Breakdown</div>
            </div>
            <div class="card-body" style="display:flex;flex-direction:column;align-items:center;">
              <canvas id="leaveDonut" width="200" height="200" style="max-width:200px;"></canvas>
              <div style="display:flex;justify-content:center;gap:16px;margin-top:16px;flex-wrap:wrap;">
                ${[
                  ['Annual', taken.annual,  '#f5a623'],
                  ['Sick',   taken.sick,    '#4ecb71'],
                  ['Casual', taken.casual,  '#4e9ff5'],
                ].map(([label, val, color]) => `
                  <div style="display:flex;align-items:center;gap:6px;font-size:13px;">
                    <span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0;"></span>
                    <span style="color:var(--text-muted);">${label}:</span>
                    <span style="font-weight:700;">${val}d</span>
                  </div>`).join('')}
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title">📅 Monthly Leave This Year</div>
            </div>
            <div class="card-body" style="overflow:hidden;">
              <canvas id="leaveBar" style="width:100%;height:200px;display:block;"></canvas>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">🕒 Recent Leave Requests</div>
            <button class="btn btn-outline btn-sm" onclick="Employee.navigate('history')">View All</button>
          </div>
          <div class="card-body">${recentLeaves}</div>
        </div>

      </div>`;
  },

  // ─── CHARTS ──────────────────────────────────────────────────────────────
  drawCharts() {
    if (!this._dashData) return;
    this._drawDonut();
    this._drawBar();
  },

  _drawDonut() {
    const canvas = document.getElementById('leaveDonut');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const taken = this._dashData.taken;

    const slices = [
      { val: taken.annual  || 0, color: '#f5a623' },
      { val: taken.sick    || 0, color: '#4ecb71' },
      { val: taken.casual  || 0, color: '#4e9ff5' },
    ];
    const total = slices.reduce((s, x) => s + x.val, 0);
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const outerR = 80;
    const innerR = 52;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (total === 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
      ctx.fillStyle = '#2a2a3a';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
      ctx.fillStyle = '#16161f';
      ctx.fill();
      ctx.fillStyle = '#55556a';
      ctx.font = '13px DM Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('No data', cx, cy);
      return;
    }

    let startAngle = -Math.PI / 2;
    slices.forEach(slice => {
      if (slice.val === 0) return;
      const angle = (slice.val / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, outerR, startAngle, startAngle + angle);
      ctx.closePath();
      ctx.fillStyle = slice.color;
      ctx.fill();
      startAngle += angle;
    });

    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
    ctx.fillStyle = '#16161f';
    ctx.fill();

    ctx.fillStyle = '#f0f0f5';
    ctx.font = 'bold 20px Syne, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(total + 'd', cx, cy - 8);
    ctx.fillStyle = '#55556a';
    ctx.font = '11px DM Sans, sans-serif';
    ctx.fillText('taken', cx, cy + 10);
  },

  _drawBar() {
    const canvas = document.getElementById('leaveBar');
    if (!canvas) return;

    canvas.width  = canvas.offsetWidth  || 340;
    canvas.height = canvas.offsetHeight || 200;

    const ctx = canvas.getContext('2d');
    const leaves = this._dashData.leaves || [];
    const currentYear = new Date().getFullYear();

    const byMonth = Array(12).fill(0);
    leaves
      .filter(l => l.status === 'approved' && new Date(l.from_date).getFullYear() === currentYear)
      .forEach(l => { byMonth[new Date(l.from_date).getMonth()] += l.days; });

    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const maxVal = Math.max(...byMonth, 1);
    const W = canvas.width;
    const H = canvas.height;
    const padL = 30, padR = 8, padT = 14, padB = 28;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;
    const colW = chartW / 12;
    const barW = colW * 0.55;

    ctx.clearRect(0, 0, W, H);

    // gridlines
    for (let i = 0; i <= 4; i++) {
      const y = padT + chartH - (i / 4) * chartH;
      ctx.beginPath();
      ctx.strokeStyle = '#2a2a3a';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.moveTo(padL, y);
      ctx.lineTo(W - padR, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#55556a';
      ctx.font = '10px DM Sans, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(Math.round((maxVal * i) / 4), padL - 4, y);
    }

    // bars
    byMonth.forEach((val, i) => {
      const barH = (val / maxVal) * chartH;
      const x = padL + i * colW + (colW - barW) / 2;
      const y = padT + chartH - barH;

      if (val > 0) {
        const grad = ctx.createLinearGradient(0, y, 0, y + barH);
        grad.addColorStop(0, '#f5a623');
        grad.addColorStop(1, '#c4841a');
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = '#1e1e2a';
      }

      const r = 3;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + barW - r, y);
      ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
      ctx.lineTo(x + barW, y + barH);
      ctx.lineTo(x, y + barH);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();

      if (val > 0) {
        ctx.fillStyle = '#f5a623';
        ctx.font = 'bold 9px DM Sans, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(val, x + barW / 2, y - 2);
      }

      ctx.fillStyle = '#55556a';
      ctx.font = '10px DM Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(MONTHS[i], x + barW / 2, padT + chartH + 6);
    });
  },

  // ─── APPLY LEAVE ─────────────────────────────────────────────────────────
  renderApply(mc) {
    const today = new Date().toISOString().split('T')[0];
    mc.innerHTML = `
      <div class="page-header">
        <div><h1>Apply for Leave</h1><p>Submit a new leave request</p></div>
      </div>
      <div class="page-content">
        <div style="max-width:640px;">
          <div class="card">
            <div class="card-header"><div class="card-title">✍️ New Leave Application</div></div>
            <div class="card-body">
              <div class="form-control">
                <label>Leave Type</label>
                <select id="lv-type">
                  <option value="annual">Annual Leave</option>
                  <option value="sick">Sick Leave</option>
                  <option value="casual">Casual Leave</option>
                </select>
              </div>
              <div class="form-row">
                <div class="form-control">
                  <label>From Date</label>
                  <input type="date" id="lv-from" min="${today}" value="${today}" onchange="Employee.updateDaysPreview()" />
                </div>
                <div class="form-control">
                  <label>To Date</label>
                  <input type="date" id="lv-to" min="${today}" value="${today}" onchange="Employee.updateDaysPreview()" />
                </div>
              </div>
              <div id="days-preview" style="background:var(--amber-glow);border:1px solid rgba(245,166,35,0.3);border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:14px;font-weight:600;color:var(--amber);">
                📅 Duration: 1 working day
              </div>
              <div class="form-control">
                <label>Reason / Description</label>
                <textarea id="lv-reason" placeholder="Describe the reason for your leave..." rows="4"></textarea>
              </div>
              <div style="display:flex;gap:12px;">
                <button class="btn btn-amber" style="flex:1;" onclick="Employee.submitLeave()">📤 Submit Application</button>
                <button class="btn btn-outline" onclick="Employee.aiDraftReason()">🤖 AI Draft Reason</button>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  },

  updateDaysPreview() {
    const from = document.getElementById('lv-from')?.value;
    const to   = document.getElementById('lv-to')?.value;
    if (!from || !to) return;
    const days = this.calcDays(from, to);
    const el = document.getElementById('days-preview');
    if (el) el.textContent = `📅 Duration: ${days} working day${days !== 1 ? 's' : ''}`;
  },

  calcDays(from, to) {
    let count = 0;
    const end = new Date(to);
    for (let d = new Date(from); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getDay() !== 0 && d.getDay() !== 6) count++;
    }
    return count;
  },

  async submitLeave() {
    const type   = document.getElementById('lv-type')?.value;
    const from   = document.getElementById('lv-from')?.value;
    const to     = document.getElementById('lv-to')?.value;
    const reason = document.getElementById('lv-reason')?.value?.trim();
    if (!from || !to || !reason) return UI.toast('Please fill all fields', 'error');
    try {
      await API.applyLeave({ type, from_date: from, to_date: to, reason });
      UI.toast('Leave application submitted!', 'success');
      this.navigate('history');
    } catch (e) {
      UI.toast(e.message, 'error');
    }
  },

  async aiDraftReason() {
    const type = document.getElementById('lv-type')?.value || 'annual';
    const from = document.getElementById('lv-from')?.value;
    const to   = document.getElementById('lv-to')?.value;
    const days = from && to ? this.calcDays(from, to) : 1;
    UI.toast('🤖 AI is drafting a reason...', 'info');
    try {
      const res = await fetch('/api/ai/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          prompt: `Write a professional, natural leave application reason for a ${type} leave of ${days} day(s). Be concise (2-3 sentences). Just the reason text, no subject line.`
        })
      });
      const data = await res.json();
      const text = data.reply || '';
      const ta = document.getElementById('lv-reason');
      if (ta && text) { ta.value = text.trim(); UI.toast('AI drafted your reason!', 'success'); }
    } catch {
      UI.toast('Could not reach AI. Check your Gemini API key.', 'error');
    }
  },

  // ─── HISTORY ─────────────────────────────────────────────────────────────
  async renderHistory(mc) {
    const leaves = await API.empLeaves();
    this._histData = leaves;
    mc.innerHTML = `
      <div class="page-header">
        <div><h1>My Requests</h1><p>History of all your leave applications</p></div>
        <button class="btn btn-amber" onclick="Employee.navigate('apply')">✍️ New Request</button>
      </div>
      <div class="page-content">
        <div class="table-toolbar">
          <div class="search-box">
            <span>🔍</span>
            <input id="hist-q" placeholder="Search..." oninput="Employee.filterHistory()" />
          </div>
          <select class="filter-select" id="hist-status" onchange="Employee.filterHistory()">
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div id="history-list">${this.historyList(leaves)}</div>
      </div>`;
  },

  historyList(leaves) {
    if (!leaves.length) return `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <h3>No leave history</h3>
        <p>Your submitted requests will appear here.</p>
      </div>`;
    return `<div class="leave-timeline">${leaves.map(l => `
      <div class="leave-item ${l.status}">
        <div class="leave-item-info">
          <div class="leave-item-type">
            ${UI.cap(l.type)} Leave
            <span class="badge badge-${l.status}">${l.status}</span>
          </div>
          <div class="leave-item-dates">
            📅 ${UI.fmtDate(l.from_date)} → ${UI.fmtDate(l.to_date)}
            · <strong>${l.days}</strong> day${l.days > 1 ? 's' : ''}
            · Applied ${UI.fmtDate(l.applied_on)}
          </div>
          <div class="leave-item-reason">"${l.reason}"</div>
          ${l.manager_note
            ? `<div style="margin-top:6px;font-size:13px;color:var(--text-muted);">
                 💬 Manager: "${l.manager_note}"
               </div>`
            : ''}
        </div>
        ${l.status === 'pending'
          ? `<div class="leave-item-actions">
               <button class="btn btn-red btn-sm" onclick="Employee.cancelLeave('${l.id}')">Cancel</button>
             </div>`
          : ''}
      </div>`).join('')}</div>`;
  },

  filterHistory() {
    const q = (document.getElementById('hist-q')?.value || '').toLowerCase();
    const s = document.getElementById('hist-status')?.value || '';
    let data = this._histData || [];
    if (s) data = data.filter(l => l.status === s);
    if (q) data = data.filter(l => l.reason.toLowerCase().includes(q) || l.type.includes(q));
    const container = document.getElementById('history-list');
    if (container) container.innerHTML = this.historyList(data);
  },

  async cancelLeave(id) {
    if (!confirm('Cancel this leave request?')) return;
    try {
      await API.cancelLeave(id);
      UI.toast('Leave request cancelled', 'info');
      this.navigate('history');
    } catch (e) {
      UI.toast(e.message, 'error');
    }
  },

  // ─── PROFILE ─────────────────────────────────────────────────────────────
  async renderProfile(mc) {
    const d = await API.empProfile();
    const e = d.employee;
    const bal   = e.leave_balance;
    const taken = e.leave_taken;

    mc.innerHTML = `
      <div class="page-header">
        <div><h1>My Profile</h1><p>Your account and employment details</p></div>
      </div>
      <div class="page-content">
        <div class="profile-grid">
          <div class="profile-card">
            <div class="profile-avatar">${UI.avatar(e.name)}</div>
            <div class="profile-name">${e.name}</div>
            <div class="profile-role">${e.position}</div>
            <div class="profile-dept">${e.department}</div>
            <div class="profile-meta">
              <div class="profile-meta-item"><span>📧</span><span>${e.email}</span></div>
              <div class="profile-meta-item"><span>🏢</span><span>${e.department}</span></div>
              <div class="profile-meta-item"><span>📅</span><span>Joined ${UI.fmtDate(e.join_date)}</span></div>
              <div class="profile-meta-item"><span>👔</span><span>Manager: ${d.manager_name}</span></div>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:24px;">
            <div class="card">
              <div class="card-header"><div class="card-title">📊 Leave Balance Summary</div></div>
              <div class="card-body">
                ${[
                  ['Annual Leave',  bal.annual,  taken.annual,  'fill-amber'],
                  ['Sick Leave',    bal.sick,    taken.sick,    'fill-green'],
                  ['Casual Leave',  bal.casual,  taken.casual,  'fill-blue'],
                ].map(([label, rem, tak, cls]) => {
                  const total = rem + tak;
                  const pct = total > 0 ? Math.round((rem / total) * 100) : 100;
                  return `
                    <div style="margin-bottom:20px;">
                      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                        <span style="font-size:14px;font-weight:600;">${label}</span>
                        <span style="font-size:13px;color:var(--text-muted);">${rem} remaining / ${total} total</span>
                      </div>
                      <div class="balance-bar" style="height:8px;">
                        <div class="balance-fill ${cls}" style="width:${pct}%;"></div>
                      </div>
                      <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:12px;color:var(--text-muted);">
                        <span>${tak} taken</span><span>${rem} left</span>
                      </div>
                    </div>`;
                }).join('')}
              </div>
            </div>
            <div class="card">
              <div class="card-header"><div class="card-title">📋 Leave Statistics</div></div>
              <div class="card-body">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                  ${[
                    ['Total Applications', d.leave_stats.total,    '📋'],
                    ['Approved',           d.leave_stats.approved, '✅'],
                    ['Pending',            d.leave_stats.pending,  '⏳'],
                    ['Rejected',           d.leave_stats.rejected, '❌'],
                  ].map(([label, val, icon]) => `
                    <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:16px;text-align:center;">
                      <div style="font-size:22px;margin-bottom:6px;">${icon}</div>
                      <div style="font-family:'Syne',sans-serif;font-size:26px;font-weight:800;">${val}</div>
                      <div style="font-size:12px;color:var(--text-muted);">${label}</div>
                    </div>`).join('')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }
};
