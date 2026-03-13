let _users = [];
let _usrFilters = { search: '' };

async function loadUsers() {
  if (userInfo.role !== 'admin') {
    document.getElementById('page-content').innerHTML =
      `<div class="alert alert-error">
        <span class="material-icons">security</span>
        <div><strong>Access Denied</strong><br/><small>Only administrators can access user management.</small></div>
      </div>`;
    return;
  }
  try {
    const data = await UsersAPI.list();
    _users = ensureArray(data);
    renderUsers();
  } catch (err) {
    document.getElementById('page-content').innerHTML =
      `<div class="alert alert-error">
        <span class="material-icons">error</span>
        <div><strong>Failed to load users!</strong><br/><small>${err.message}</small></div>
      </div>`;
  }
}

const roleIcons = { admin: 'military_tech', manager: 'manage_accounts', accountant: 'account_balance_wallet' };
const roleLabel = { admin: 'Admin', manager: 'Manager', accountant: 'Accountant' };

function getFilteredUsers() {
  return _users.filter(u => {
    return _usrFilters.search
      ? (u.full_name || '').toLowerCase().includes(_usrFilters.search.toLowerCase()) ||
        (u.username || '').toLowerCase().includes(_usrFilters.search.toLowerCase())
      : true;
  });
}

function renderUsers() {
  const stats = `<div class="stat-grid">
    <div class="stat-card">
      <div class="stat-icon-wrap" style="background:#eff6ff; color:var(--primary);">
        <span class="material-icons">group</span>
      </div>
      <div class="stat-info">
        <div class="stat-value">${_users.length}</div>
        <div class="stat-label">Total Users</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon-wrap" style="background:#ecfdf5; color:var(--success);">
        <span class="material-icons">verified_user</span>
      </div>
      <div class="stat-info">
        <div class="stat-value">${_users.filter(u => u.is_active).length}</div>
        <div class="stat-label">Active Users</div>
      </div>
    </div>
  </div>`;

  const columns = [
    { title: '#', key: 'id', render: (v, r, i) => i + 1 },
    {
      title: 'System User', key: 'full_name', render: (v, r) => `
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:36px; height:36px; background:var(--bg-color); border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700; color:var(--primary); border:1px solid var(--border-color);">
          ${(v || 'U').charAt(0).toUpperCase()}
        </div>
        <div>
          <div style="font-weight:600; color:var(--text-main);">${v}</div>
          <div style="font-size:12px; color:var(--text-muted);">${r.username}</div>
        </div>
      </div>` },
    {
      title: 'Email / Phone', key: 'email', render: (v, r) => `
      <div>
        <div style="font-size:13px;">${v}</div>
        <div style="font-size:11px; color:var(--text-muted);">${r.profile?.phone || '-'}</div>
      </div>` },
    {
      title: 'Access Level', key: 'profile', render: (p) => `
      <div style="display:flex;align-items:center;gap:6px;">
        <span class="material-icons" style="font-size:16px;color:var(--text-muted)">${roleIcons[p?.role] || 'person'}</span>
        ${tag(roleLabel[p?.role] || p?.role, 'tag-blue')}
      </div>` },
    { title: 'Status', key: 'is_active', render: (v) => tag(v ? 'ACTIVE' : 'INACTIVE', v ? 'tag-green' : 'tag-red') },
    {
      title: 'Actions', key: 'id', render: (v, r) => `
      <div class="actions">
        <button class="btn btn-secondary btn-small" onclick="editUser(${r.id})" title="Edit Profile">
          <span class="material-icons" style="font-size:16px;color:var(--primary)">edit</span>
        </button>
        <button class="btn btn-secondary btn-small" onclick="openResetPwd(${r.id},'${escHtml(r.full_name)}')" title="Reset Password">
          <span class="material-icons" style="font-size:16px;color:var(--secondary)">vpn_key</span>
        </button>
        <button class="btn btn-secondary btn-small" onclick="deleteUser(${r.id},'${escHtml(r.full_name)}')" title="Delete User" style="color:var(--danger); border-color:rgba(239,68,68,0.2);">
          <span class="material-icons" style="font-size:18px;">delete_outline</span>
        </button>
      </div>` },
  ];

  const filtered = getFilteredUsers();

  document.getElementById('page-content').innerHTML = `
    <div>
      <div class="page-header">
        <div>
          <div class="page-title">User Management</div>
          <div class="page-subtitle">Control system access and permissions</div>
        </div>
        <button class="btn btn-primary btn-large" onclick="openUserModal()">
          <span class="material-icons">person_add</span> Add New User
        </button>
      </div>
      ${stats}
      <div class="filter-bar">
        <div class="filter-search-wrap">
          <span class="material-icons">search</span>
          <input type="text" placeholder="Search by name or username..." id="usr-search" value="${_usrFilters.search}"
            oninput="_usrFilters.search=this.value;renderUsers()"/>
        </div>
        <div style="margin-left:auto; color:var(--text-muted); font-size:13px; font-weight:500; white-space:nowrap;">
          Showing <strong>${filtered.length}</strong> Users
        </div>
      </div>
      <div class="table-wrap">
        ${buildTable(columns, filtered, 'No system users found')}
      </div>
    </div>`;
}

function openUserModal(user = null) {
  const isEdit = !!user;
  openModal({
    title: isEdit ? 'Edit User Profile' : 'Create New User',
    body: `
      <div class="form-grid-2">
        <div class="form-group">
          <label>First Name *</label>
          <input type="text" id="usr-fname" class="form-input" value="${escHtml(user?.first_name)}" placeholder="Ex: John"/>
        </div>
        <div class="form-group">
          <label>Last Name</label>
          <input type="text" id="usr-lname" class="form-input" value="${escHtml(user?.last_name)}" placeholder="Ex: Kumar"/>
        </div>
      </div>
      ${!isEdit ? `
      <div class="form-group">
        <label>Username *</label>
        <input type="text" id="usr-username" class="form-input" placeholder="Ex: john_k"/>
      </div>` : ''}
      <div class="form-grid-2">
        <div class="form-group">
          <label>Email Address *</label>
          <input type="email" id="usr-email" class="form-input" value="${escHtml(user?.email)}" placeholder="john@example.com"/>
        </div>
        <div class="form-group">
          <label>Phone Number</label>
          <input type="text" id="usr-phone" class="form-input" value="${escHtml(user?.profile?.phone)}" placeholder="9876543210"/>
        </div>
      </div>
      <div class="form-grid-2">
        <div class="form-group">
          <label>System Role *</label>
          <select id="usr-role" class="form-select">
            <option value="admin"     ${user?.profile?.role === 'admin' ? 'selected' : ''}>Administrator</option>
            <option value="manager"   ${user?.profile?.role === 'manager' || !user ? 'selected' : ''}>Manager</option>
            <option value="accountant"${user?.profile?.role === 'accountant' ? 'selected' : ''}>Accountant</option>
          </select>
        </div>
        <div class="form-group">
          <label>${isEdit ? 'Account Status' : 'Password *'}</label>
          ${isEdit ? `
          <select id="usr-active" class="form-select">
            <option value="1" ${user?.is_active ? 'selected' : ''}>Active</option>
            <option value="0" ${!user?.is_active ? 'selected' : ''}>Inactive</option>
          </select>` : `
          <input type="password" id="usr-password" class="form-input" placeholder="Min 6 characters"/>`}
        </div>
      </div>
      <div id="usr-error" class="alert alert-error" style="display:none; margin-top:16px;"></div>
    `,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveUser(${user?.id || 'null'})">
        <span class="material-icons">save</span> Save User
      </button>
    `,
  });
}

async function editUser(id) {
  const user = _users.find(u => u.id === id);
  openUserModal(user);
}

async function saveUser(id) {
  const errEl = document.getElementById('usr-error');
  errEl.style.display = 'none';

  const data = {
    first_name: document.getElementById('usr-fname').value.trim(),
    last_name: document.getElementById('usr-lname').value.trim(),
    email: document.getElementById('usr-email').value.trim(),
    phone: document.getElementById('usr-phone').value.trim(),
    role: document.getElementById('usr-role').value,
  };

  if (!data.first_name || !data.email || !data.role) {
    errEl.innerHTML = '<span class="material-icons">warning</span> Please fill all required fields';
    errEl.style.display = 'flex'; return;
  }

  if (!id) {
    data.username = document.getElementById('usr-username').value.trim();
    data.password = document.getElementById('usr-password').value;
    if (!data.username) { errEl.innerHTML = '<span class="material-icons">warning</span> Username is required'; errEl.style.display = 'flex'; return; }
    if (!data.password || data.password.length < 6) {
      errEl.innerHTML = '<span class="material-icons">warning</span> Password must be at least 6 characters'; errEl.style.display = 'flex'; return;
    }
  } else {
    data.is_active = parseInt(document.getElementById('usr-active').value);
  }

  try {
    if (id) {
      await UsersAPI.update(id, data);
      toast('User updated successfully!');
    } else {
      await UsersAPI.create(data);
      toast('User created successfully!');
    }
    closeModal();
    _users = await UsersAPI.list();
    renderUsers();
  } catch (err) {
    errEl.innerHTML = `<span class="material-icons">error</span> ${err.message || 'Failed to save user!'}`;
    errEl.style.display = 'flex';
  }
}

function openResetPwd(userId, name) {
  openModal({
    title: `Reset Password for ${name}`,
    body: `
      <div class="form-group">
        <label>New Password *</label>
        <input type="password" id="rp-new" class="form-input" placeholder="Min 6 characters"/>
      </div>
      <div class="form-group">
        <label>Confirm Password *</label>
        <input type="password" id="rp-confirm" class="form-input" placeholder="Re-enter password"/>
      </div>
      <div id="rp-error" class="alert alert-error" style="display:none; margin-top:16px;"></div>
    `,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="submitResetPwd(${userId})">
        <span class="material-icons">lock_reset</span> Reset Password
      </button>
    `,
  });
}

async function submitResetPwd(userId) {
  const newPwd = document.getElementById('rp-new').value;
  const confirm = document.getElementById('rp-confirm').value;
  const errEl = document.getElementById('rp-error');
  errEl.style.display = 'none';

  if (!newPwd || newPwd.length < 6) {
    errEl.innerHTML = '<span class="material-icons">warning</span> Password must be at least 6 characters'; errEl.style.display = 'flex'; return;
  }
  if (newPwd !== confirm) {
    errEl.innerHTML = '<span class="material-icons">warning</span> Passwords do not match'; errEl.style.display = 'flex'; return;
  }
  try {
    await UsersAPI.resetPassword(userId, newPwd);
    toast('Password has been reset!');
    closeModal();
  } catch (err) {
    errEl.innerHTML = `<span class="material-icons">error</span> ${err.message || 'Failed to reset!'}`;
    errEl.style.display = 'flex';
  }
}

async function deleteUser(id, name) {
  confirmDialog(`Are you sure you want to permanently delete user <strong>${name}</strong>?`, async () => {
    try {
      await UsersAPI.delete(id);
      toast('User account deleted');
      _users = await UsersAPI.list();
      renderUsers();
    } catch (err) { toast('Failed to delete!', 'error'); }
  });
}
