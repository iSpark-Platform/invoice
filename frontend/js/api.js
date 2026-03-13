// ═══ API Configuration ════════════════════════════════════
// Auto-detect base path so it works on localhost AND cPanel
const _scriptBase = (() => {
  const path = window.location.pathname; // e.g. /ispark_invoice/frontend/index.html
  const idx = path.indexOf('/frontend/');
  return idx !== -1 ? path.substring(0, idx) : '';
})();
const API_BASE = _scriptBase + '/api';

async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('access_token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}/${endpoint}`;

  try {
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      localStorage.clear();
      window.location.href = window.location.pathname;
      return;
    }
    
    // Safety check for non-JSON or empty responses
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      console.error('Invalid JSON response:', text);
      data = { error: 'Invalid server response' };
    }

    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  } catch (err) {
    console.error(`API Error [${endpoint}]:`, err);
    throw err;
  }
}

// ─── Auth ─────────────────────────────────────────────────
const AuthAPI = {
  login: (username, password) =>
    apiFetch('auth.php?action=login', {
      method: 'POST', body: JSON.stringify({ username, password })
    }),
  me: () => apiFetch('auth.php?action=me'),
  changePassword: (oldPwd, newPwd) =>
    apiFetch('auth.php?action=change-password', {
      method: 'POST', body: JSON.stringify({ old_password: oldPwd, new_password: newPwd })
    }),
  logout: () => apiFetch('auth.php?action=logout', { method: 'POST' }),
};

// ─── Schools ──────────────────────────────────────────────
const SchoolsAPI = {
  list:   ()     => apiFetch('schools.php'),
  get:    (id)   => apiFetch(`schools.php?id=${id}`),
  create: (data) => apiFetch('schools.php', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiFetch(`schools.php?id=${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id)   => apiFetch(`schools.php?id=${id}`, { method: 'DELETE' }),
};

// ─── Invoices ─────────────────────────────────────────────
const InvoicesAPI = {
  list:        ()     => apiFetch('invoices.php'),
  get:         (id)   => apiFetch(`invoices.php?id=${id}`),
  create:      (data) => apiFetch('invoices.php', { method: 'POST', body: JSON.stringify(data) }),
  update:      (id, data) => apiFetch(`invoices.php?id=${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  patch:       (id, data) => apiFetch(`invoices.php?id=${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete:      (id)   => apiFetch(`invoices.php?id=${id}`, { method: 'DELETE' }),
  pdfUrl:      (id)   => `${API_BASE}/invoice_pdf.php?id=${id}&token=${localStorage.getItem('access_token')}`,
  sendEmail:   (id, data) => apiFetch(`send_email.php?id=${id}`, { method: 'POST', body: JSON.stringify(data) }),
  dashboard:   ()     => apiFetch('invoices.php?action=dashboard'),
  reports:     (fy)   => apiFetch(`invoices.php?action=reports${fy ? '&fy=' + fy : ''}`),
};

// ─── Payments ─────────────────────────────────────────────
const PaymentsAPI = {
  list:   ()     => apiFetch('payments.php'),
  get:    (id)   => apiFetch(`payments.php?id=${id}`),
  create: (data) => apiFetch('payments.php', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiFetch(`payments.php?id=${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id)   => apiFetch(`payments.php?id=${id}`, { method: 'DELETE' }),
};

// ─── Users ────────────────────────────────────────────────
const UsersAPI = {
  list:          ()     => apiFetch('users.php'),
  get:           (id)   => apiFetch(`users.php?id=${id}`),
  create:        (data) => apiFetch('users.php', { method: 'POST', body: JSON.stringify(data) }),
  update:        (id, data) => apiFetch(`users.php?id=${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete:        (id)   => apiFetch(`users.php?id=${id}`, { method: 'DELETE' }),
  resetPassword: (userId, newPwd) =>
    apiFetch(`users.php?action=reset-password&user_id=${userId}`, {
      method: 'POST', body: JSON.stringify({ new_password: newPwd })
    }),
};
