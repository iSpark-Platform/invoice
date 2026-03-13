// ═══ APP INIT & ROUTING ════════════════════════════════════

const MENU = [
  { key: 'dashboard', icon: 'dashboard',         label: 'Dashboard',  roles: ['admin','manager','accountant'], loader: loadDashboard },
  { key: 'schools',   icon: 'school',            label: 'Schools',    roles: ['admin','manager','accountant'], loader: loadSchools   },
  { key: 'invoices',  icon: 'receipt_long',      label: 'Invoices',   roles: ['admin','manager','accountant'], loader: loadInvoices  },
  { key: 'payments',  icon: 'payments',          label: 'Payments',   roles: ['admin','accountant'],           loader: loadPayments  },
  { key: 'reports',   icon: 'assessment',        label: 'Reports',    roles: ['admin','accountant'],           loader: loadReports   },
  { key: 'users',     icon: 'group',             label: 'Users',      roles: ['admin'],                        loader: loadUsers     },
];

let currentPage = 'dashboard';
let userInfo    = {};

function initApp() {
  const token = localStorage.getItem('access_token');
  try {
    userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
  } catch(e) {
    userInfo = {};
    localStorage.clear();
  }

  if (!token || !userInfo.role) {
    document.getElementById('login-page').style.display = 'block';
    document.getElementById('app-layout').style.display = 'none';
    return;
  }

  document.getElementById('login-page').style.display  = 'none';
  document.getElementById('app-layout').style.display  = 'block';

  buildMenu();
  renderUserInfo();

  // Route based on URL
  const path = window.location.pathname;
  const page = path.split('/').pop() || 'dashboard';
  const validPage = MENU.some(m => m.key === page) ? page : 'dashboard';
  navigate(validPage, true);
}

function buildMenu() {
  const role = userInfo.role || 'admin';
  const nav  = document.getElementById('sidebar-menu');
  nav.innerHTML = '';

  MENU.filter(m => m.roles.includes(role)).forEach(m => {
    const btn = document.createElement('button');
    btn.className  = 'nav-item';
    btn.id         = `nav-${m.key}`;
    btn.innerHTML  = `<span class="material-icons nav-icon">${m.icon}</span>${m.label}`;
    btn.onclick    = () => navigate(m.key);
    nav.appendChild(btn);
  });
}

function renderUserInfo() {
  const roleLabels = { admin: 'Admin', manager: 'Manager', accountant: 'Accountant' };
  const roleClass  = { admin:'role-admin', manager:'role-manager', accountant:'role-accountant' };
  const role       = userInfo.role || 'admin';
  const name       = userInfo.full_name || 'User';
  document.getElementById('topbar-user').innerHTML =
    `<span class="material-icons" style="font-size:22px;color:var(--text-muted)">account_circle</span>
     <span style="font-weight:600; font-size:14px; color:var(--text-main); line-height:1;">${name}</span>`;
}

function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('active');
  document.body.classList.toggle('sidebar-open', sidebar && sidebar.classList.contains('open'));
}

function navigate(page, replace = false) {
  const item = MENU.find(m => m.key === page);
  if (!item) return;
  if (!item.roles.includes(userInfo.role)) {
    navigate('dashboard', true); return;
  }

  // Close sidebar on mobile
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('active');
  document.body.classList.remove('sidebar-open');

  currentPage = page;

  // History API
  const url = page === 'dashboard' ? './' : page;
  if (replace) {
    history.replaceState({ page }, '', url);
  } else if (window.location.pathname.split('/').pop() !== page) {
    history.pushState({ page }, '', url);
  }

  MENU.forEach(m => {
    const el = document.getElementById(`nav-${m.key}`);
    if (el) el.classList.toggle('active', m.key === page);
  });

  const content = document.getElementById('page-content');
  content.innerHTML = `<div class="loading-text">Loading...</div>`;
  item.loader();
}

// ─── Event Listeners ──────────────────────────────────────
window.addEventListener('popstate', (e) => {
  if (e.state && e.state.page) navigate(e.state.page, true);
});

window.addEventListener('DOMContentLoaded', () => {
  initApp();
});