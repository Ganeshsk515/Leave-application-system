// ===== LeaveOS API CLIENT =====
const API = {
  async req(method, url, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    };
    if (body) opts.body = JSON.stringify(body);

    let res;
    try {
      res = await fetch(url, opts);
    } catch (networkErr) {
      throw new Error('Cannot connect to server. Is Flask running?');
    }

    // Try to parse JSON, fall back to text for debugging
    let data;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json().catch(() => ({}));
    } else {
      const text = await res.text().catch(() => '');
      console.error('Non-JSON response from', url, ':', text.slice(0, 300));
      throw new Error(`Server error (${res.status}). Check Flask console for details.`);
    }

    if (!res.ok) {
      throw new Error(data.error || data.message || `Request failed (${res.status})`);
    }
    return data;
  },

  get:  (url)       => API.req('GET',    url),
  post: (url, body) => API.req('POST',   url, body),
  del:  (url)       => API.req('DELETE', url),

  // Auth
  me:     () => API.get('/api/auth/me'),
  logout: () => API.post('/api/auth/logout', {}),

  // Manager
  managerDashboard:  ()       => API.get('/api/manager/dashboard'),
  getEmployees:      ()       => API.get('/api/manager/employees'),
  createEmployee:    (d)      => API.post('/api/manager/employees', d),
  deleteEmployee:    (id)     => API.del(`/api/manager/employees/${id}`),
  getEmployeeDetail: (id)     => API.get(`/api/manager/employees/${id}`),
  getLeaves:         (p='')   => API.get(`/api/manager/leaves${p}`),
  decideLeave:       (id,s,n) => API.post(`/api/manager/leaves/${id}/decision`, { status: s, manager_note: n }),
  analytics:         ()       => API.get('/api/manager/analytics'),
  calendarData:      ()       => API.get('/api/manager/calendar'),

  // Employee
  empDashboard: ()     => API.get('/api/employee/dashboard'),
  empLeaves:    (p='') => API.get(`/api/employee/leaves${p}`),
  applyLeave:   (d)    => API.post('/api/employee/leaves', d),
  cancelLeave:  (id)   => API.del(`/api/employee/leaves/${id}`),
  empProfile:   ()     => API.get('/api/employee/profile'),
};
