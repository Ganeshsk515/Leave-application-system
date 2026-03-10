// ===== LeaveOS AI ASSISTANT (Google Gemini) =====
const AIAssistant = {
  open: false,
  messages: [],
  userCtx: null,

  async init(userCtx) {
    this.userCtx = userCtx;
    this.messages = [];
    this.renderPanel();
    this.bindEvents();
  },

  buildSystem() {
    const u = this.userCtx;
    if (!u) return '';
    let s = `You are LeaveOS AI, a professional and concise HR leave management assistant.\nCurrent user: ${u.name} (${u.role})`;
    if (u.role === 'manager') {
      const d = u.dashboardData || {};
      s += `\nDepartment: ${u.department}`;
      s += `\nTeam size: ${d.stats?.total_employees || 0}`;
      s += `\nPending requests: ${d.stats?.pending_requests || 0}`;
      s += `\nOn leave today: ${d.stats?.on_leave_today || 0}`;
      if (d.pending_leaves?.length) {
        s += '\n\nPending leave requests:\n' + d.pending_leaves.map(l =>
          `- ${l.employee_name}: ${l.type} leave ${l.from_date} to ${l.to_date} (${l.days} days) — "${l.reason}"`
        ).join('\n');
      }
    } else {
      const d = u.dashboardData || {};
      const emp = d.employee || {};
      const bal = emp.leave_balance || {};
      s += `\nDepartment: ${emp.department || ''}`;
      s += `\nPosition: ${emp.position || ''}`;
      s += `\nLeave balances — Annual: ${bal.annual || 0}, Sick: ${bal.sick || 0}, Casual: ${bal.casual || 0}`;
      s += `\nManager: ${d.manager_name || ''}`;
      if (d.leaves?.length) {
        s += `\n\nRecent leaves:\n` + d.leaves.slice(0, 5).map(l =>
          `- ${l.type} leave ${l.from_date} to ${l.to_date} (${l.status})`
        ).join('\n');
      }
    }
    s += '\n\nBe concise (2-4 sentences). Be professional, helpful, and friendly. Use bullet points only when listing multiple items.';
    return s;
  },

  async send(text) {
    if (!text?.trim()) return;
    this.messages.push({ role: 'user', content: text });
    this.renderMessages(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          system: this.buildSystem(),
          messages: this.messages.map(m => ({ role: m.role, content: m.content }))
        })
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'AI request failed');
      }

      const reply = data.reply || 'Sorry, I could not generate a response.';
      this.messages.push({ role: 'assistant', content: reply });
    } catch (e) {
      this.messages.push({
        role: 'assistant',
        content: `⚠️ AI Error: ${e.message || 'Unable to reach Gemini. Check your API key in app.py.'}`
      });
    }

    this.renderMessages(false);
  },

  renderMessages(typing) {
    const box = document.getElementById('ai-messages');
    if (!box) return;
    box.innerHTML = this.messages.map(m =>
      `<div class="ai-msg ${m.role === 'user' ? 'user' : 'bot'}">${this.fmt(m.content)}</div>`
    ).join('');
    if (typing) {
      box.innerHTML += `<div class="ai-msg bot typing"><span></span><span></span><span></span></div>`;
    }
    box.scrollTop = box.scrollHeight;
  },

  fmt(txt) {
    return txt
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  },

  getChips() {
    return this.userCtx?.role === 'manager'
      ? ['View pending requests', 'Who is on leave today?', 'Leave summary this month', 'Tips for fair approvals']
      : ['Check my leave balance', 'Help write a leave reason', 'When was my last leave?', 'How many days do I have left?'];
  },

  renderPanel() {
    document.getElementById('ai-panel')?.remove();
    const el = document.createElement('div');
    el.id = 'ai-panel';
    el.className = 'ai-panel';
    el.innerHTML = `
      <div class="ai-window" id="ai-window">
        <div class="ai-header">
          <div class="ai-header-icon">✨</div>
          <div>
            <div class="ai-name">LeaveOS AI <span style="font-size:10px;color:var(--text-muted);font-weight:400;">powered by Gemini</span></div>
            <div class="ai-status">● Online</div>
          </div>
          <button class="modal-close" style="margin-left:auto" onclick="AIAssistant.toggle()">✕</button>
        </div>
        <div class="ai-messages" id="ai-messages">
          <div class="ai-msg bot">👋 Hi! I'm your AI assistant powered by Google Gemini. I have full context of your data. Ask me anything about leaves, balances, or requests!</div>
        </div>
        <div class="ai-quick-actions">
          ${this.getChips().map(c =>
            `<div class="ai-chip" onclick="AIAssistant.quickAsk('${c}')">${c}</div>`
          ).join('')}
        </div>
        <div class="ai-input-wrap">
          <input class="ai-input" id="ai-input" placeholder="Ask me anything..." />
          <button class="ai-send" id="ai-send">➤</button>
        </div>
      </div>
      <button class="ai-toggle" onclick="AIAssistant.toggle()">
        <div class="ai-pulse"></div>✨
      </button>`;
    document.body.appendChild(el);
  },

  quickAsk(text) {
    this.send(text);
  },

  toggle() {
    this.open = !this.open;
    document.getElementById('ai-window')?.classList.toggle('open', this.open);
  },

  bindEvents() {
    document.addEventListener('click', e => {
      if (e.target.id === 'ai-send') {
        const inp = document.getElementById('ai-input');
        if (inp?.value?.trim()) { this.send(inp.value); inp.value = ''; }
      }
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Enter' && document.activeElement?.id === 'ai-input') {
        const inp = document.getElementById('ai-input');
        if (inp?.value?.trim()) { this.send(inp.value); inp.value = ''; }
      }
    });
  }
};
