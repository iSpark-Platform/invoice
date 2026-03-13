// ═══ AUTH ══════════════════════════════════════════════════

async function doLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  const btn      = document.getElementById('login-btn');

  errEl.style.display = 'none';
  if (!username || !password) {
    errEl.textContent = 'Please enter username and password';
    errEl.style.display = 'block';
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Signing in...';

  try {
    const data = await AuthAPI.login(username, password);
    localStorage.setItem('access_token', data.access);
    localStorage.setItem('user_info', JSON.stringify(data.user));
    initApp();
  } catch (err) {
    errEl.textContent = 'Invalid username or password';
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}

function doLogout() {
  AuthAPI.logout().catch(() => {});
  localStorage.removeItem('access_token');
  localStorage.removeItem('user_info');
  document.getElementById('app-layout').style.display = 'none';
  document.getElementById('login-page').style.display = 'block';
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
}

function openChangePwd() {
  openModal({
    title: '<span class="material-icons" style="font-size:18px;vertical-align:middle;margin-right:8px;">vpn_key</span>Change My Password',
    body: `
      <div class="change-pwd-info">Change your account password below.</div>
      <div class="form-group">
        <label>Current Password</label>
        <input type="password" id="cpwd-old" class="form-input" placeholder="Enter current password"/>
      </div>
      <div class="form-group">
        <label>New Password</label>
        <input type="password" id="cpwd-new" class="form-input" placeholder="Min 6 characters"/>
      </div>
      <div class="form-group">
        <label>Confirm New Password</label>
        <input type="password" id="cpwd-confirm" class="form-input" placeholder="Re-enter new password"/>
      </div>
      <div id="cpwd-error" class="alert alert-error" style="display:none;"></div>
    `,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="submitChangePwd()">Change Password</button>
    `,
    narrow: true,
  });
}

async function submitChangePwd() {
  const old     = document.getElementById('cpwd-old').value;
  const newPwd  = document.getElementById('cpwd-new').value;
  const confirm = document.getElementById('cpwd-confirm').value;
  const errEl   = document.getElementById('cpwd-error');

  errEl.style.display = 'none';
  if (!old || !newPwd) {
    errEl.textContent = 'All fields are required'; errEl.style.display = 'block'; return;
  }
  if (newPwd.length < 6) {
    errEl.textContent = 'Password must be at least 6 characters'; errEl.style.display = 'block'; return;
  }
  if (newPwd !== confirm) {
    errEl.textContent = 'Passwords do not match'; errEl.style.display = 'block'; return;
  }
  try {
    await AuthAPI.changePassword(old, newPwd);
    toast('Password changed successfully!');
    closeModal();
  } catch (err) {
    errEl.textContent = err.message || 'Failed to change password';
    errEl.style.display = 'block';
  }
}
