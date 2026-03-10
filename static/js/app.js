// ===== LeaveOS MAIN APP =====
const App = {
  async init() {
    try {
      const user = await API.me();
      this.route(user);
    } catch {
      this.renderLogin();
    }
  },

  route(user) {
    if (user.role === 'manager') Manager.init(user);
    else Employee.init(user);
  },

  // ─── LOGIN ────────────────────────────────────────────────────
  renderLogin() {
    document.getElementById('app').innerHTML = `
      <div class="login-page">
        <div class="login-right">
          <div class="login-box">
            <div class="login-logo">🏢 <span>Leave<strong>OS</strong></span></div>
            <h2>Welcome back</h2>
            <p style="color:var(--text-muted);margin-bottom:24px;">Sign in to your account</p>

            <div class="role-selector">
              <div class="role-btn active" id="role-manager" onclick="App.selectRole('manager')">
                <span class="role-icon">👔</span>
                <div class="role-title">Manager</div>
                <div class="role-sub">Approve & manage</div>
              </div>
              <div class="role-btn" id="role-employee" onclick="App.selectRole('employee')">
                <span class="role-icon">👤</span>
                <div class="role-title">Employee</div>
                <div class="role-sub">Apply & track</div>
              </div>
            </div>

            <div class="form-group">
              <label>Email Address</label>
              <input type="email" id="login-email" placeholder="yourname@company.com"
                oninput="App.validateEmailLive(this)" />
              <div class="field-hint" id="email-hint"></div>
            </div>
            <div class="form-group">
              <label>Password</label>
              <div style="position:relative;">
                <input type="password" id="login-pass" placeholder="Enter your password" />
                <span class="pass-toggle" onclick="App.togglePass('login-pass', this)">👁</span>
              </div>
            </div>

            <div style="text-align:right;margin-bottom:20px;">
              <a href="#" class="link-btn" onclick="App.renderForgotPassword()">Forgot password?</a>
            </div>

            <button class="btn-primary" id="login-btn" onclick="App.doLogin()">Sign In →</button>
            <div class="auth-error" id="login-error"></div>
          </div>
        </div>
      </div>`;
    document.getElementById('login-pass').addEventListener('keydown', e => {
      if (e.key === 'Enter') App.doLogin();
    });
  },

  validateEmailLive(input) {
    const hint = document.getElementById('email-hint');
    if (!hint) return;
    const val = input.value.trim();
    if (!val) { hint.textContent = ''; return; }
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val);
    hint.textContent = valid ? '✅ Valid email' : '❌ Enter a valid email address';
    hint.style.color = valid ? '#4ecb71' : '#ff6b6b';
  },

  selectRole(role) {
    document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('role-' + role)?.classList.add('active');
  },

  togglePass(id, btn) {
    const inp = document.getElementById(id);
    if (!inp) return;
    if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; }
    else { inp.type = 'password'; btn.textContent = '👁'; }
  },

  async doLogin() {
    const email = document.getElementById('login-email')?.value?.trim();
    const pass  = document.getElementById('login-pass')?.value?.trim();
    const errEl = document.getElementById('login-error');
    errEl.textContent = '';

    if (!email || !pass) {
      errEl.textContent = '⚠️ Please enter your email and password.'; return;
    }
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
    if (!emailValid) {
      errEl.textContent = '⚠️ Please enter a valid email address.'; return;
    }

    const btn = document.getElementById('login-btn');
    btn.textContent = 'Signing in...'; btn.disabled = true;
    try {
      const res = await API.post('/api/auth/login', { email, password: pass });
      if (res.requires_otp) {
        this._pendingEmail = email;
        this.renderOTP(res.message, res.otp_dev);
      }
    } catch (e) {
      errEl.textContent = '⚠️ ' + (e.message || 'Invalid email or password.');
    } finally {
      btn.textContent = 'Sign In →'; btn.disabled = false;
    }
  },

  // ─── OTP VERIFICATION ────────────────────────────────────────
  renderOTP(message, otpDev) {
    document.getElementById('app').innerHTML = `
      <div class="login-page">
        <div class="login-right">
          <div class="login-box">
            <div class="otp-icon">🔐</div>
            <h2>2-Step Verification</h2>
            <p style="color:var(--text-muted);margin-bottom:8px;">${message}</p>
            ${otpDev ? `<div class="otp-dev-hint">🛠 Dev mode — OTP: <strong>${otpDev}</strong></div>` : ''}

            <div class="otp-inputs" id="otp-inputs">
              ${[0,1,2,3,4,5].map(i =>
                `<input class="otp-box" id="otp-${i}" maxlength="1" type="text"
                  inputmode="numeric" pattern="[0-9]"
                  oninput="App.otpNext(this, ${i})"
                  onkeydown="App.otpBack(event, ${i})"
                  onpaste="App.otpPaste(event)" />`
              ).join('')}
            </div>

            <button class="btn-primary" id="otp-btn" onclick="App.doVerifyOTP()" style="margin-top:24px;">
              Verify & Sign In →
            </button>
            <div class="auth-error" id="otp-error"></div>

            <div style="text-align:center;margin-top:16px;">
              <span style="color:var(--text-muted);font-size:13px;">Didn't receive it? </span>
              <a href="#" class="link-btn" onclick="App.resendOTP()">Resend OTP</a>
            </div>
            <div style="text-align:center;margin-top:8px;">
              <a href="#" class="link-btn" onclick="App.renderLogin()">← Back to login</a>
            </div>
          </div>
        </div>
      </div>`;
    setTimeout(() => document.getElementById('otp-0')?.focus(), 100);
  },

  otpNext(input, index) {
    input.value = input.value.replace(/\D/g, '');
    if (input.value && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
    if (index === 5 && input.value) this.doVerifyOTP();
  },

  otpBack(e, index) {
    if (e.key === 'Backspace' && !e.target.value && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus();
    }
  },

  otpPaste(e) {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
    text.split('').forEach((ch, i) => {
      const inp = document.getElementById(`otp-${i}`);
      if (inp) inp.value = ch;
    });
    document.getElementById(`otp-${Math.min(text.length, 5)}`)?.focus();
  },

  getOTPValue() {
    return [0,1,2,3,4,5].map(i => document.getElementById(`otp-${i}`)?.value || '').join('');
  },

  async doVerifyOTP() {
    const otp   = this.getOTPValue();
    const errEl = document.getElementById('otp-error');
    errEl.textContent = '';
    if (otp.length < 6) { errEl.textContent = '⚠️ Enter the 6-digit OTP.'; return; }

    const btn = document.getElementById('otp-btn');
    btn.textContent = 'Verifying...'; btn.disabled = true;
    try {
      const user = await API.post('/api/auth/verify-otp', { otp });
      this.route(user);
    } catch (e) {
      errEl.textContent = '⚠️ ' + (e.message || 'Incorrect OTP. Try again.');
      [0,1,2,3,4,5].forEach(i => { const inp = document.getElementById(`otp-${i}`); if (inp) inp.value = ''; });
      document.getElementById('otp-0')?.focus();
    } finally {
      btn.textContent = 'Verify & Sign In →'; btn.disabled = false;
    }
  },

  async resendOTP() {
    try {
      const res = await API.post('/api/auth/resend-otp', {});
      UI.toast('OTP resent! ' + (res.otp_dev ? `(Dev: ${res.otp_dev})` : ''), 'success');
    } catch (e) {
      UI.toast(e.message || 'Could not resend OTP', 'error');
    }
  },

  // ─── FORGOT PASSWORD ─────────────────────────────────────────
  renderForgotPassword() {
    document.getElementById('app').innerHTML = `
      <div class="login-page">
        <div class="login-right">
          <div class="login-box">
            <div class="otp-icon">🔑</div>
            <h2>Forgot Password</h2>
            <p style="color:var(--text-muted);margin-bottom:24px;">
              Enter your registered email address and we'll send you an OTP to reset your password.
            </p>

            <div class="form-group">
              <label>Email Address</label>
              <input type="email" id="fp-email" placeholder="yourname@company.com"
                oninput="App.validateEmailLive(this)" />
              <div class="field-hint" id="email-hint"></div>
            </div>

            <button class="btn-primary" id="fp-btn" onclick="App.doForgotPassword()">
              Send Reset OTP →
            </button>
            <div class="auth-error" id="fp-error"></div>

            <div style="text-align:center;margin-top:16px;">
              <a href="#" class="link-btn" onclick="App.renderLogin()">← Back to login</a>
            </div>
          </div>
        </div>
      </div>`;
    document.getElementById('fp-email').addEventListener('keydown', e => {
      if (e.key === 'Enter') App.doForgotPassword();
    });
  },

  async doForgotPassword() {
    const email = document.getElementById('fp-email')?.value?.trim();
    const errEl = document.getElementById('fp-error');
    errEl.textContent = '';

    if (!email) { errEl.textContent = '⚠️ Please enter your email.'; return; }
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
    if (!valid) { errEl.textContent = '⚠️ Please enter a valid email address.'; return; }

    const btn = document.getElementById('fp-btn');
    btn.textContent = 'Sending...'; btn.disabled = true;
    try {
      const res = await API.post('/api/auth/forgot-password', { email });
      this._resetEmail = email;
      this.renderResetOTP(res.message, res.otp_dev);
    } catch (e) {
      errEl.textContent = '⚠️ ' + (e.message || 'Something went wrong.');
    } finally {
      btn.textContent = 'Send Reset OTP →'; btn.disabled = false;
    }
  },

  // ─── RESET OTP VERIFICATION ───────────────────────────────────
  renderResetOTP(message, otpDev) {
    document.getElementById('app').innerHTML = `
      <div class="login-page">
        <div class="login-right">
          <div class="login-box">
            <div class="otp-icon">📨</div>
            <h2>Enter Reset OTP</h2>
            <p style="color:var(--text-muted);margin-bottom:8px;">${message}</p>
            ${otpDev ? `<div class="otp-dev-hint">🛠 Dev mode — OTP: <strong>${otpDev}</strong></div>` : ''}

            <div class="otp-inputs" id="otp-inputs">
              ${[0,1,2,3,4,5].map(i =>
                `<input class="otp-box" id="otp-${i}" maxlength="1" type="text"
                  inputmode="numeric" pattern="[0-9]"
                  oninput="App.otpNext(this, ${i})"
                  onkeydown="App.otpBack(event, ${i})"
                  onpaste="App.otpPaste(event)" />`
              ).join('')}
            </div>

            <button class="btn-primary" id="otp-btn" onclick="App.doVerifyResetOTP()" style="margin-top:24px;">
              Verify OTP →
            </button>
            <div class="auth-error" id="otp-error"></div>
            <div style="text-align:center;margin-top:16px;">
              <a href="#" class="link-btn" onclick="App.renderForgotPassword()">← Back</a>
            </div>
          </div>
        </div>
      </div>`;
    setTimeout(() => document.getElementById('otp-0')?.focus(), 100);
  },

  async doVerifyResetOTP() {
    const otp   = this.getOTPValue();
    const errEl = document.getElementById('otp-error');
    errEl.textContent = '';
    if (otp.length < 6) { errEl.textContent = '⚠️ Enter the 6-digit OTP.'; return; }

    const btn = document.getElementById('otp-btn');
    btn.textContent = 'Verifying...'; btn.disabled = true;
    try {
      await API.post('/api/auth/verify-reset-otp', { email: this._resetEmail, otp });
      this.renderResetPassword();
    } catch (e) {
      errEl.textContent = '⚠️ ' + (e.message || 'Incorrect OTP.');
      [0,1,2,3,4,5].forEach(i => { const inp = document.getElementById(`otp-${i}`); if (inp) inp.value = ''; });
      document.getElementById('otp-0')?.focus();
    } finally {
      btn.textContent = 'Verify OTP →'; btn.disabled = false;
    }
  },

  // ─── RESET PASSWORD ───────────────────────────────────────────
  renderResetPassword() {
    document.getElementById('app').innerHTML = `
      <div class="login-page">
        <div class="login-right">
          <div class="login-box">
            <div class="otp-icon">🔒</div>
            <h2>Reset Password</h2>
            <p style="color:var(--text-muted);margin-bottom:24px;">
              Choose a strong new password for your account.
            </p>

            <div class="form-group">
              <label>New Password</label>
              <div style="position:relative;">
                <input type="password" id="rp-pass" placeholder="Minimum 6 characters"
                  oninput="App.checkPasswordStrength(this)" />
                <span class="pass-toggle" onclick="App.togglePass('rp-pass', this)">👁</span>
              </div>
              <div class="strength-bar" id="strength-bar" style="display:none;">
                <div class="strength-fill" id="strength-fill"></div>
              </div>
              <div class="field-hint" id="strength-label"></div>
            </div>

            <div class="form-group">
              <label>Confirm New Password</label>
              <div style="position:relative;">
                <input type="password" id="rp-pass2" placeholder="Re-enter new password"
                  oninput="App.checkPasswordMatch()" />
                <span class="pass-toggle" onclick="App.togglePass('rp-pass2', this)">👁</span>
              </div>
              <div class="field-hint" id="match-hint"></div>
            </div>

            <button class="btn-primary" id="rp-btn" onclick="App.doResetPassword()">
              Reset Password →
            </button>
            <div class="auth-error" id="rp-error"></div>
          </div>
        </div>
      </div>`;
  },

  checkPasswordStrength(input) {
    const val = input.value;
    const bar  = document.getElementById('strength-bar');
    const fill = document.getElementById('strength-fill');
    const lbl  = document.getElementById('strength-label');
    if (!val) { bar.style.display = 'none'; lbl.textContent = ''; return; }
    bar.style.display = 'block';
    let score = 0;
    if (val.length >= 6)  score++;
    if (val.length >= 10) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;
    const levels = [
      { pct: '20%', color: '#ff4444', label: 'Very Weak' },
      { pct: '40%', color: '#ff8800', label: 'Weak' },
      { pct: '60%', color: '#f5a623', label: 'Fair' },
      { pct: '80%', color: '#4ecb71', label: 'Strong' },
      { pct: '100%', color: '#00c853', label: 'Very Strong' },
    ];
    const lvl = levels[Math.min(score - 1, 4)] || levels[0];
    fill.style.width = lvl.pct;
    fill.style.background = lvl.color;
    lbl.textContent = lvl.label;
    lbl.style.color = lvl.color;
    this.checkPasswordMatch();
  },

  checkPasswordMatch() {
    const p1 = document.getElementById('rp-pass')?.value;
    const p2 = document.getElementById('rp-pass2')?.value;
    const hint = document.getElementById('match-hint');
    if (!hint || !p2) return;
    if (p1 === p2) { hint.textContent = '✅ Passwords match'; hint.style.color = '#4ecb71'; }
    else { hint.textContent = '❌ Passwords do not match'; hint.style.color = '#ff6b6b'; }
  },

  async doResetPassword() {
    const pass  = document.getElementById('rp-pass')?.value?.trim();
    const pass2 = document.getElementById('rp-pass2')?.value?.trim();
    const errEl = document.getElementById('rp-error');
    errEl.textContent = '';

    if (!pass || pass.length < 6) { errEl.textContent = '⚠️ Password must be at least 6 characters.'; return; }
    if (pass !== pass2) { errEl.textContent = '⚠️ Passwords do not match.'; return; }

    const btn = document.getElementById('rp-btn');
    btn.textContent = 'Resetting...'; btn.disabled = true;
    try {
      await API.post('/api/auth/reset-password', { password: pass, confirm_password: pass2 });
      UI.toast('✅ Password reset successfully! Please log in.', 'success');
      setTimeout(() => App.renderLogin(), 1500);
    } catch (e) {
      errEl.textContent = '⚠️ ' + (e.message || 'Could not reset password.');
    } finally {
      btn.textContent = 'Reset Password →'; btn.disabled = false;
    }
  },

  async logout() {
    try { await API.logout(); } catch {}
    location.reload();
  }
};

App.init();
