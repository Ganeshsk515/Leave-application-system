// ===== LeaveOS MANAGER MODULE =====
const Manager = {
  page: 'dashboard',
  dashboardData: null,

  async init(user) {
    this.user = user;
    this.renderLayout();
    await this.navigate('dashboard');
    const dd = await API.managerDashboard().catch(() => ({}));
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
                <div class="user-role">Manager</div>
              </div>
            </div>
          </div>
          <nav class="sidebar-nav">
            <div class="nav-section-label">Overview</div>
            <div class="nav-item active" id="nav-dashboard" onclick="Manager.navigate('dashboard')"><span class="nav-icon">📊</span>Dashboard</div>
            <div class="nav-section-label">Team</div>
            <div class="nav-item" id="nav-employees" onclick="Manager.navigate('employees')"><span class="nav-icon">👥</span>My Employees</div>
            <div class="nav-item" id="nav-requests" onclick="Manager.navigate('requests')"><span class="nav-icon">📋</span>Leave Requests<span class="nav-badge" id="pending-badge" style="display:none">0</span></div>
            <div class="nav-section-label">Insights</div>
            <div class="nav-item" id="nav-analytics" onclick="Manager.navigate('analytics')"><span class="nav-icon">📈</span>Analytics</div>
            <div class="nav-item" id="nav-calendar" onclick="Manager.navigate('calendar')"><span class="nav-icon">🗓️</span>Leave Calendar</div>
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

  setNav(page) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('nav-' + page)?.classList.add('active');
  },

  async navigate(page) {
    this.page = page;
    this.setNav(page);
    const mc = document.getElementById('main-content');
    UI.loading(mc);
    try {
      switch(page) {
        case 'dashboard': await this.renderDashboard(mc); break;
        case 'employees': await this.renderEmployees(mc); break;
        case 'requests':  await this.renderRequests(mc); break;
        case 'analytics': await this.renderAnalytics(mc); break;
        case 'calendar':  await this.renderCalendar(mc); break;
      }
    } catch(e) {
      mc.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⚠️</div><h3>Error loading page</h3><p>${e.message}</p></div></div>`;
    }
  },

  async renderDashboard(mc) {
    const d = await API.managerDashboard();
    this.dashboardData = d;
    const badge = document.getElementById('pending-badge');
    if (badge) { badge.textContent = d.stats.pending_requests; badge.style.display = d.stats.pending_requests > 0 ? '' : 'none'; }

    mc.innerHTML = `
      <div class="page-header">
        <div><h1>Dashboard</h1><p>Welcome back, ${this.user.name.split(' ')[0]}. Here's your team overview.</p></div>
        <div style="font-size:13px;color:var(--text-muted)">${new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
      </div>
      <div class="page-content">
        <div class="stats-grid">
          <div class="stat-card amber"><span class="stat-icon">👥</span><div class="stat-value">${d.stats.total_employees}</div><div class="stat-label">Team Members</div><div class="stat-sub">Under your management</div></div>
          <div class="stat-card blue"><span class="stat-icon">📋</span><div class="stat-value">${d.stats.pending_requests}</div><div class="stat-label">Pending Requests</div><div class="stat-sub">Awaiting your decision</div></div>
          <div class="stat-card green"><span class="stat-icon">✅</span><div class="stat-value">${d.stats.approved_this_month}</div><div class="stat-label">Approved This Month</div><div class="stat-sub">Leave approvals</div></div>
          <div class="stat-card red"><span class="stat-icon">🏖️</span><div class="stat-value">${d.stats.on_leave_today}</div><div class="stat-label">On Leave Today</div><div class="stat-sub">Team members absent</div></div>
        </div>
        <div class="grid-2 mb-24">
          <div class="card">
            <div class="card-header"><div class="card-title">⚡ Pending Approvals</div>${d.pending_leaves.length ? `<button class="btn btn-outline btn-sm" onclick="Manager.navigate('requests')">View All</button>` : ''}</div>
            <div class="card-body">
              ${d.pending_leaves.length === 0
                ? `<div class="empty-state"><div class="empty-icon">🎉</div><h3>All clear!</h3><p>No pending requests.</p></div>`
                : d.pending_leaves.slice(0,4).map(l => `
                  <div class="leave-item pending" style="margin-bottom:10px">
                    <div class="leave-item-info">
                      <div class="leave-item-type">${l.employee_name} — ${UI.cap(l.type)} Leave</div>
                      <div class="leave-item-dates">📅 ${UI.fmtDate(l.from_date)} → ${UI.fmtDate(l.to_date)} · ${l.days}d</div>
                      <div class="leave-item-reason">"${l.reason}"</div>
                    </div>
                    <div class="leave-item-actions">
                      <button class="btn btn-green btn-sm" onclick="Manager.quickDecide('${l.id}','approved')">✓</button>
                      <button class="btn btn-red btn-sm" onclick="Manager.quickDecide('${l.id}','rejected')">✗</button>
                    </div>
                  </div>`).join('')}
            </div>
          </div>
          <div class="card">
            <div class="card-header"><div class="card-title">👤 Team Status</div></div>
            <div class="card-body">
              ${d.team_status.map(t => `
              <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
                <div class="user-avatar" style="width:36px;height:36px;font-size:14px">${UI.avatar(t.name)}</div>
                <div style="flex:1"><div style="font-weight:600;font-size:14px">${t.name}</div><div style="font-size:12px;color:var(--text-muted)">${t.position}</div></div>
                <span class="badge badge-${t.status}">${t.status === 'on_leave' ? 'On Leave' : UI.cap(t.status)}</span>
              </div>`).join('')}
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title">🕒 Recent Activity</div></div>
          <div class="table-wrap">
            <table><thead><tr><th>Employee</th><th>Type</th><th>Duration</th><th>Applied</th><th>Status</th></tr></thead>
            <tbody>${d.recent_leaves.map(l => `
              <tr>
                <td class="td-name">${l.employee_name}</td>
                <td>${UI.cap(l.type)}</td>
                <td>${UI.fmtDate(l.from_date)} — ${UI.fmtDate(l.to_date)} <span style="color:var(--text-muted)">(${l.days}d)</span></td>
                <td>${UI.fmtDate(l.applied_on)}</td>
                <td><span class="badge badge-${l.status}">${l.status}</span></td>
              </tr>`).join('')}
            </tbody></table>
          </div>
        </div>
      </div>`;
  },

  async renderEmployees(mc) {
    const emps = await API.getEmployees();
    mc.innerHTML = `
      <div class="page-header">
        <div><h1>My Employees</h1><p>Manage your team members</p></div>
        <button class="btn btn-amber" onclick="Manager.showAddEmployee()">＋ Add Employee</button>
      </div>
      <div class="page-content">
        <div class="table-toolbar">
          <div class="search-box"><span>🔍</span><input id="emp-q" placeholder="Search employees..." oninput="Manager.filterTable()" /></div>
        </div>
        <div class="card"><div class="table-wrap"><table>
          <thead><tr><th>Name</th><th>Position</th><th>Email</th><th>Join Date</th><th>Annual</th><th>Sick</th><th>Casual</th><th>Actions</th></tr></thead>
          <tbody id="emp-tbody">${this.empRows(emps)}</tbody>
        </table></div></div>
      </div>`;
    this._empData = emps;
  },

  empRows(emps) {
    if (!emps.length) return `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">👥</div><h3>No employees yet</h3><p>Add your first team member.</p></div></td></tr>`;
    return emps.map(e => `
      <tr>
        <td><div style="display:flex;align-items:center;gap:10px"><div class="user-avatar" style="width:32px;height:32px;font-size:13px">${UI.avatar(e.name)}</div><span class="td-name">${e.name}</span></div></td>
        <td>${e.position}</td>
        <td style="color:var(--text-muted)">${e.email}</td>
        <td>${UI.fmtDate(e.join_date)}</td>
        <td><span style="color:var(--amber);font-weight:700">${e.leave_balance.annual}</span> <span style="color:var(--text-muted)">/ ${e.leave_balance.annual+e.leave_taken.annual}</span></td>
        <td><span style="color:var(--green);font-weight:700">${e.leave_balance.sick}</span> <span style="color:var(--text-muted)">/ ${e.leave_balance.sick+e.leave_taken.sick}</span></td>
        <td><span style="color:var(--blue);font-weight:700">${e.leave_balance.casual}</span> <span style="color:var(--text-muted)">/ ${e.leave_balance.casual+e.leave_taken.casual}</span></td>
        <td><div style="display:flex;gap:6px">
          <button class="btn btn-outline btn-sm" onclick="Manager.viewEmployee('${e.id}')">View</button>
          <button class="btn btn-red btn-sm" onclick="Manager.deleteEmployee('${e.id}','${e.name}')">Delete</button>
        </div></td>
      </tr>`).join('');
  },

  filterTable() {
    const q = document.getElementById('emp-q')?.value.toLowerCase() || '';
    const filtered = (this._empData||[]).filter(e =>
      e.name.toLowerCase().includes(q) || e.position.toLowerCase().includes(q) || e.email.includes(q));
    const tb = document.getElementById('emp-tbody');
    if (tb) tb.innerHTML = this.empRows(filtered);
  },

  async renderRequests(mc) {
    const leaves = await API.getLeaves();
    mc.innerHTML = `
      <div class="page-header">
        <div><h1>Leave Requests</h1><p>Review and manage your team's leave applications</p></div>
      </div>
      <div class="page-content">
        <div class="table-toolbar">
          <div class="search-box"><span>🔍</span><input id="req-q" placeholder="Search..." oninput="Manager.filterReqs()" /></div>
          <select class="filter-select" id="req-status" onchange="Manager.filterReqs()"><option value="">All Status</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select>
          <select class="filter-select" id="req-type" onchange="Manager.filterReqs()"><option value="">All Types</option><option value="annual">Annual</option><option value="sick">Sick</option><option value="casual">Casual</option></select>
        </div>
        <div class="card"><div class="table-wrap"><table>
          <thead><tr><th>Employee</th><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Applied</th><th>Status</th><th>Action</th></tr></thead>
          <tbody id="req-tbody">${this.reqRows(leaves)}</tbody>
        </table></div></div>
      </div>`;
    this._reqData = leaves;
  },

  reqRows(leaves) {
    if (!leaves.length) return `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">📋</div><h3>No requests found</h3></div></td></tr>`;
    return leaves.map(l => `
      <tr>
        <td><div style="display:flex;align-items:center;gap:8px"><div class="user-avatar" style="width:28px;height:28px;font-size:11px">${UI.avatar(l.employee_name)}</div><span class="td-name">${l.employee_name}</span></div></td>
        <td>${UI.cap(l.type)}</td>
        <td>${UI.fmtDate(l.from_date)}</td>
        <td>${UI.fmtDate(l.to_date)}</td>
        <td><strong>${l.days}</strong></td>
        <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${l.reason}">${l.reason}</td>
        <td>${UI.fmtDate(l.applied_on)}</td>
        <td><span class="badge badge-${l.status}">${l.status}</span></td>
        <td>${l.status === 'pending'
          ? `<div style="display:flex;gap:6px">
               <button class="btn btn-green btn-sm" onclick="Manager.showDecision('${l.id}','${l.employee_name}','${l.type}','${l.from_date}','${l.to_date}','${l.days}','approved')">✓ Approve</button>
               <button class="btn btn-red btn-sm" onclick="Manager.showDecision('${l.id}','${l.employee_name}','${l.type}','${l.from_date}','${l.to_date}','${l.days}','rejected')">✗ Reject</button>
             </div>`
          : `<button class="btn btn-outline btn-sm" onclick="Manager.viewLeaveDetail(${JSON.stringify(l).replace(/"/g,'&quot;')})">View</button>`}
        </td>
      </tr>`).join('');
  },

  filterReqs() {
    const q = (document.getElementById('req-q')?.value||'').toLowerCase();
    const s = document.getElementById('req-status')?.value||'';
    const t = document.getElementById('req-type')?.value||'';
    let d = this._reqData||[];
    if (s) d = d.filter(l => l.status === s);
    if (t) d = d.filter(l => l.type === t);
    if (q) d = d.filter(l => l.employee_name?.toLowerCase().includes(q) || l.reason.toLowerCase().includes(q));
    const tb = document.getElementById('req-tbody');
    if (tb) tb.innerHTML = this.reqRows(d);
  },

  async renderAnalytics(mc) {
    const d = await API.analytics();
    const total = d.total_days || 1;
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const maxMonth = Math.max(...d.by_month, 1);
    const maxEmp = d.by_employee[0]?.days || 1;

    mc.innerHTML = `
      <div class="page-header"><div><h1>Analytics</h1><p>Leave patterns and insights</p></div></div>
      <div class="page-content">
        <div class="stats-grid mb-32">
          <div class="stat-card amber"><span class="stat-icon">📅</span><div class="stat-value">${d.total_days}</div><div class="stat-label">Total Days Taken</div></div>
          <div class="stat-card green"><span class="stat-icon">✅</span><div class="stat-value">${d.total_leaves}</div><div class="stat-label">Approved Leaves</div></div>
          <div class="stat-card blue"><span class="stat-icon">🤧</span><div class="stat-value">${d.by_type.sick}</div><div class="stat-label">Sick Days Total</div></div>
          <div class="stat-card red"><span class="stat-icon">📊</span><div class="stat-value">${d.avg_per_employee}</div><div class="stat-label">Avg Days / Employee</div></div>
        </div>
        <div class="grid-2 mb-24">
          <div class="card">
            <div class="card-header"><div class="card-title">📊 Leave by Type</div></div>
            <div class="card-body">
              <div class="chart-wrap">
                ${[['Annual',d.by_type.annual,'fill-amber'],['Sick',d.by_type.sick,'fill-green'],['Casual',d.by_type.casual,'fill-blue']].map(([l,v,c]) =>
                  `<div class="chart-bar-row"><div class="chart-bar-label">${l}</div><div class="chart-bar-track"><div class="chart-bar-fill ${c}" style="width:${(v/total*100).toFixed(1)}%"></div></div><div class="chart-bar-val">${v}d</div></div>`
                ).join('')}
              </div>
            </div>
          </div>
          <div class="card">
            <div class="card-header"><div class="card-title">👤 Leave by Employee</div></div>
            <div class="card-body">
              <div class="chart-wrap">
                ${d.by_employee.map(({name,days}) =>
                  `<div class="chart-bar-row"><div class="chart-bar-label">${name.split(' ')[0]}</div><div class="chart-bar-track"><div class="chart-bar-fill fill-amber" style="width:${(days/maxEmp*100).toFixed(1)}%"></div></div><div class="chart-bar-val">${days}d</div></div>`
                ).join('')}
              </div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title">📅 Monthly Leave Trend</div></div>
          <div class="card-body">
            <div class="chart-wrap">
              ${months.map((m,i) =>
                `<div class="chart-bar-row"><div class="chart-bar-label">${m}</div><div class="chart-bar-track"><div class="chart-bar-fill fill-blue" style="width:${(d.by_month[i]/maxMonth*100).toFixed(1)}%"></div></div><div class="chart-bar-val">${d.by_month[i]}d</div></div>`
              ).join('')}
            </div>
          </div>
        </div>
      </div>`;
  },

  async renderCalendar(mc) {
    const leaves = await API.calendarData();
    const today = new Date();
    const month = today.getMonth();
    const year = today.getFullYear();
    const monthName = today.toLocaleDateString('en-US',{month:'long',year:'numeric'});
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month+1, 0).getDate();
    const cells = [...Array(firstDay).fill(null), ...Array.from({length:daysInMonth},(_,i)=>i+1)];

    const getLeaves = (day) => {
      const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      return leaves.filter(l => l.from_date <= ds && l.to_date >= ds);
    };

    mc.innerHTML = `
      <div class="page-header"><div><h1>Leave Calendar</h1><p>Team leave overview for ${monthName}</p></div></div>
      <div class="page-content">
        <div class="card mb-24">
          <div class="card-header"><div class="card-title">📅 ${monthName}</div></div>
          <div class="card-body">
            <div class="cal-grid" style="margin-bottom:8px">
              ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<div class="cal-header-cell">${d}</div>`).join('')}
            </div>
            <div class="cal-grid">
              ${cells.map(day => {
                if (!day) return '<div class="cal-cell empty"></div>';
                const dl = getLeaves(day);
                const isToday = day === today.getDate();
                return `<div class="cal-cell${isToday?' today':''}">
                  <div class="cal-day">${day}</div>
                  ${dl.slice(0,2).map(l=>`<div class="cal-event ${l.status}">${l.employee_name?.split(' ')[0]||'?'}</div>`).join('')}
                  ${dl.length>2?`<div style="font-size:10px;color:var(--text-muted)">+${dl.length-2} more</div>`:''}
                </div>`;
              }).join('')}
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title">📋 This Month's Leaves</div></div>
          <div class="table-wrap"><table>
            <thead><tr><th>Employee</th><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Status</th></tr></thead>
            <tbody>${leaves.filter(l=>{
              const lm=new Date(l.from_date).getMonth();
              const lm2=new Date(l.to_date).getMonth();
              return lm===month||lm2===month;
            }).map(l=>`<tr><td class="td-name">${l.employee_name}</td><td>${UI.cap(l.type)}</td><td>${UI.fmtDate(l.from_date)}</td><td>${UI.fmtDate(l.to_date)}</td><td>${l.days}</td><td><span class="badge badge-${l.status}">${l.status}</span></td></tr>`).join('')||'<tr><td colspan="6"><div class="empty-state"><p>No leaves this month</p></div></td></tr>'}
            </tbody>
          </table></div>
        </div>
      </div>`;
  },

  // MODALS
  showAddEmployee() {
    UI.modal('Add New Employee', `
      <div class="form-row">
        <div class="form-control"><label>Full Name</label><input id="n-name" placeholder="John Doe" /></div>
        <div class="form-control"><label>Email</label><input id="n-email" type="email" placeholder="john@company.com" /></div>
      </div>
      <div class="form-row">
        <div class="form-control"><label>Position</label><input id="n-pos" placeholder="Software Engineer" /></div>
        <div class="form-control"><label>Password</label><input id="n-pass" type="password" placeholder="Login password" /></div>
      </div>
      <div class="form-row">
        <div class="form-control"><label>Annual Leave Days</label><input id="n-annual" type="number" value="15" min="0" /></div>
        <div class="form-control"><label>Join Date</label><input id="n-join" type="date" value="${new Date().toISOString().split('T')[0]}" /></div>
      </div>`, async () => {
        const name = document.getElementById('n-name').value.trim();
        const email = document.getElementById('n-email').value.trim();
        const pos = document.getElementById('n-pos').value.trim();
        const pass = document.getElementById('n-pass').value.trim();
        const annual = parseInt(document.getElementById('n-annual').value)||15;
        const join = document.getElementById('n-join').value;
        if (!name||!email||!pos||!pass) return UI.toast('Please fill all fields','error');
        try {
          await API.createEmployee({name,email,password:pass,position:pos,join_date:join,annual_days:annual});
          UI.closeModal();
          UI.toast(`${name} added successfully!`,'success');
          this.navigate('employees');
        } catch(e) { UI.toast(e.message,'error'); }
    }, 'Add Employee');
  },

  async viewEmployee(id) {
    try {
      const d = await API.getEmployeeDetail(id);
      const e = d.employee;
      UI.modal(`${e.name}'s Profile`, `
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;padding-bottom:24px;border-bottom:1px solid var(--border)">
          <div class="user-avatar" style="width:60px;height:60px;font-size:24px">${UI.avatar(e.name)}</div>
          <div><div style="font-size:20px;font-weight:700">${e.name}</div><div style="color:var(--amber);font-size:13px;margin-top:2px">${e.position}</div><div style="color:var(--text-muted);font-size:13px">${e.email}</div></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:24px">
          ${[['Annual',e.leave_balance.annual,'var(--amber)'],['Sick',e.leave_balance.sick,'var(--green)'],['Casual',e.leave_balance.casual,'var(--blue)']].map(([t,v,c])=>
            `<div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:14px;text-align:center"><div style="font-size:26px;font-weight:800;color:${c}">${v}</div><div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.8px">${t} Left</div></div>`
          ).join('')}
        </div>
        <div style="font-size:13px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">Recent Leaves</div>
        ${d.leaves.slice(0,5).map(l=>`
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
            <div><div style="font-size:14px;font-weight:600">${UI.cap(l.type)} Leave</div><div style="font-size:12px;color:var(--text-muted)">${UI.fmtDate(l.from_date)} → ${UI.fmtDate(l.to_date)} · ${l.days}d</div></div>
            <span class="badge badge-${l.status}">${l.status}</span>
          </div>`).join('')||'<div style="color:var(--text-muted);font-size:14px">No leave history</div>'}
      `, null, null, true);
    } catch(e) { UI.toast(e.message,'error'); }
  },

  showDecision(id, name, type, from, to, days, action) {
    UI.modal(`${action==='approved'?'✅ Approve':'❌ Reject'} Leave Request`, `
      <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:20px">
        <div style="font-weight:600;margin-bottom:4px">${name} — ${UI.cap(type)} Leave</div>
        <div style="font-size:13px;color:var(--text-muted)">${UI.fmtDate(from)} to ${UI.fmtDate(to)} (${days} days)</div>
      </div>
      <div class="form-control"><label>Note to Employee (Optional)</label><textarea id="mgr-note" placeholder="Add a note..." rows="3"></textarea></div>
    `, async () => {
        const note = document.getElementById('mgr-note')?.value||'';
        try {
          await API.decideLeave(id, action, note);
          UI.closeModal();
          UI.toast(`Leave ${action} for ${name}`, action==='approved'?'success':'info');
          this.navigate('requests');
        } catch(e) { UI.toast(e.message,'error'); }
    }, action==='approved'?'✅ Approve':'❌ Reject');
  },

  async quickDecide(id, action) {
    try {
      await API.decideLeave(id, action, '');
      UI.toast(`Leave ${action}`,'success');
      this.navigate('dashboard');
    } catch(e) { UI.toast(e.message,'error'); }
  },

  viewLeaveDetail(l) {
    if (typeof l === 'string') l = JSON.parse(l);
    UI.modal('Leave Details', `
      <div style="display:flex;flex-direction:column;gap:14px">
        ${[['Employee',l.employee_name],['Type',UI.cap(l.type)],['From',UI.fmtDate(l.from_date)],['To',UI.fmtDate(l.to_date)],['Duration',l.days+' day(s)'],['Reason',l.reason],['Applied On',UI.fmtDate(l.applied_on)],['Status',l.status.toUpperCase()],['Manager Note',l.manager_note||'N/A']].map(([k,v])=>
          `<div style="display:flex;gap:12px"><div style="width:120px;font-size:13px;color:var(--text-muted);flex-shrink:0">${k}</div><div style="font-size:14px;font-weight:500">${v}</div></div>`
        ).join('')}
      </div>`, null, null, true);
  },

  async deleteEmployee(id, name) {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    try {
      await API.deleteEmployee(id);
      UI.toast(`${name} removed`,'info');
      this.navigate('employees');
    } catch(e) { UI.toast(e.message,'error'); }
  }
};
