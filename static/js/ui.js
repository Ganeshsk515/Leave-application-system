// ===== LeaveOS UI UTILITIES =====
const UI = {
  toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
      <span class="toast-icon">${icons[type]||'ℹ️'}</span>
      <span class="toast-text">${message}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">✕</button>`;
    container.appendChild(el);
    setTimeout(() => el.remove(), 4500);
  },

  modal(title, body, onConfirm, confirmLabel = 'Confirm', readOnly = false) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'active-modal';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close" onclick="UI.closeModal()">✕</button>
        </div>
        <div class="modal-body">${body}</div>
        <div class="modal-footer">
          ${readOnly
            ? `<button class="btn btn-outline" onclick="UI.closeModal()">Close</button>`
            : `<button class="btn btn-outline" onclick="UI.closeModal()">Cancel</button>
               <button class="btn btn-amber" id="modal-confirm">${confirmLabel}</button>`
          }
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) UI.closeModal(); });
    if (onConfirm) {
      document.getElementById('modal-confirm')?.addEventListener('click', onConfirm);
    }
  },

  closeModal() {
    document.getElementById('active-modal')?.remove();
  },

  fmtDate(d) {
    if (!d) return '—';
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  cap(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
  },

  avatar(name) {
    return name ? name.charAt(0).toUpperCase() : '?';
  },

  loading(container) {
    if (container) container.innerHTML = `<div class="loading-page"><div class="spinner"></div></div>`;
  }
};
