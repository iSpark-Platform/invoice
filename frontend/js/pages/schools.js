let _schools = [];
let _schFilters = { search: '' };

async function loadSchools() {
  try {
    const data = await SchoolsAPI.list();
    _schools = ensureArray(data);
    renderSchools();
  } catch (err) {
    document.getElementById('page-content').innerHTML =
      `<div class="alert alert-error">
        <span class="material-icons">error</span>
        <div>
          <strong>Failed to load schools!</strong><br/>
          <small>${err.message}</small>
        </div>
      </div>`;
  }
}

function getFilteredSchools() {
  return _schools.filter(s => {
    return _schFilters.search
      ? (s.name || '').toLowerCase().includes(_schFilters.search.toLowerCase())
      : true;
  });
}

function renderSchools() {
  const totalStudents = _schools.reduce((a, s) => a + Number(s.students || 0), 0);
  const activeCount   = _schools.filter(s => s.status === 'Active').length;

  const stats = `<div class="stat-grid">
    <div class="stat-card">
      <div class="stat-icon-wrap" style="background:#eff6ff; color:var(--primary);">
        <span class="material-icons">school</span>
      </div>
      <div class="stat-info">
        <div class="stat-value">${_schools.length}</div>
        <div class="stat-label">Total Schools</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon-wrap" style="background:#ecfdf5; color:var(--success);">
        <span class="material-icons">groups</span>
      </div>
      <div class="stat-info">
        <div class="stat-value">${fmtNum(totalStudents)}</div>
        <div class="stat-label">Total Students</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon-wrap" style="background:#fff7ed; color:var(--secondary);">
        <span class="material-icons">check_circle</span>
      </div>
      <div class="stat-info">
        <div class="stat-value">${activeCount}</div>
        <div class="stat-label">Active Schools</div>
      </div>
    </div>
  </div>`;

  const columns = [
    { title:'#',           key:'id', render:(v, r, i) => i + 1 },
    { title:'School Name', key:'name', render:(v) => `<strong style="color:var(--primary);">${v}</strong>` },
    { title:'District',    key:'district', render:(v) => v ? tag(v, 'tag-blue') : '-' },
    { title:'Contact',     key:'contact' },
    { title:'Phone',       key:'phone' },
    { title:'Students',    key:'students', render:(v) => tag(v, 'tag-blue') },
    { title:'Status',      key:'status',   render:(v) => tag(v, v === 'Active' ? 'tag-green' : 'tag-red') },
    { title:'Actions',     key:'id', render:(v, row) =>
      `<div class="actions">
         <button class="btn btn-secondary btn-small" onclick="editSchool(${row.id})" title="Edit">
           <span class="material-icons" style="font-size:16px; color:var(--primary);">edit</span>
         </button>
         <button class="btn btn-secondary btn-small" onclick="deleteSchool(${row.id}, '${escHtml(row.name)}')" title="Delete" style="color:var(--danger); border-color:rgba(239,68,68,0.2);">
           <span class="material-icons" style="font-size:18px;">delete_outline</span>
         </button>
       </div>`
    },
  ];

  const filtered = getFilteredSchools();

  document.getElementById('page-content').innerHTML = `
    <div>
      <div class="page-header">
        <div>
          <div class="page-title">Schools Management</div>
          <div class="page-subtitle">Manage all your partner schools efficiently</div>
        </div>
        <button class="btn btn-primary btn-large" onclick="openSchoolModal()">
          <span class="material-icons">add</span> Add New School
        </button>
      </div>
      ${stats}
      <div class="filter-bar">
        <div class="filter-search-wrap">
          <span class="material-icons">search</span>
          <input type="text" placeholder="Search school name..." id="sch-search" value="${_schFilters.search}"
            oninput="_schFilters.search=this.value;renderSchools()"/>
        </div>
        <div style="margin-left:auto; color:var(--text-muted); font-size:13px; font-weight:500; white-space:nowrap;">
          Showing <strong>${filtered.length}</strong> Schools
        </div>
      </div>
      <div class="table-wrap">
        ${buildTable(columns, filtered, 'No schools found')}
      </div>
    </div>`;
}

function escHtml(str) { return String(str || '').replace(/'/g, "\\'"); }

function openSchoolModal(school = null) {
  const isEdit = !!school;
  openModal({
    title: isEdit ? 'Edit School' : 'Add New School',
    body: `
      <div class="form-group">
        <label>School Name *</label>
        <input type="text" id="sch-name" class="form-input" value="${escHtml(school?.name)}"
          placeholder="Ex: Equitas Gurukul Matriculation School"/>
      </div>
      <div class="form-group">
        <label>Address</label>
        <textarea id="sch-address" class="form-textarea" rows="2"
          placeholder="Ex: No.5, Main Road, Anna Nagar">${school?.address || ''}</textarea>
      </div>
      <div class="form-grid-3">
        <div class="form-group">
          <label>District *</label>
          <input type="text" id="sch-district" class="form-input" value="${escHtml(school?.district)}" placeholder="Ex: Chennai"/>
        </div>
        <div class="form-group">
          <label>State *</label>
          <input type="text" id="sch-state" class="form-input" value="${escHtml(school?.state)}" placeholder="Ex: Tamil Nadu"/>
        </div>
        <div class="form-group">
          <label>Pincode</label>
          <input type="text" id="sch-pincode" class="form-input" value="${escHtml(school?.pincode)}" maxlength="6" placeholder="600001"/>
        </div>
      </div>
      <div class="form-grid-2">
        <div class="form-group">
          <label>Contact Person *</label>
          <input type="text" id="sch-contact" class="form-input" value="${escHtml(school?.contact)}" placeholder="Ex: Mr. Kumar"/>
        </div>
        <div class="form-group">
          <label>Phone *</label>
          <input type="text" id="sch-phone" class="form-input" value="${escHtml(school?.phone)}" placeholder="9876543210"/>
        </div>
      </div>
      <div class="form-grid-2">
        <div class="form-group">
          <label>Email *</label>
          <input type="email" id="sch-email" class="form-input" value="${escHtml(school?.email)}" placeholder="school@gmail.com"/>
        </div>
        <div class="form-group">
          <label>Number of Students *</label>
          <input type="number" id="sch-students" class="form-input" value="${school?.students || ''}" placeholder="450"/>
        </div>
      </div>
      <div id="sch-error" class="alert alert-error" style="display:none;"></div>
    `,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveSchool(${school?.id || 'null'})">
        <span class="material-icons">save</span> Save School
      </button>
    `,
    wide: true,
  });
}

async function editSchool(id) {
  const school = _schools.find(s => s.id === id);
  openSchoolModal(school);
}

async function saveSchool(id) {
  const errEl = document.getElementById('sch-error');
  errEl.style.display = 'none';

  const data = {
    name:     document.getElementById('sch-name').value.trim(),
    address:  document.getElementById('sch-address').value.trim(),
    district: document.getElementById('sch-district').value.trim(),
    state:    document.getElementById('sch-state').value.trim(),
    pincode:  document.getElementById('sch-pincode').value.trim(),
    contact:  document.getElementById('sch-contact').value.trim(),
    phone:    document.getElementById('sch-phone').value.trim(),
    email:    document.getElementById('sch-email').value.trim(),
    students: parseInt(document.getElementById('sch-students').value) || 0,
    status:   'Active',
  };

  if (!data.name || !data.contact || !data.email || !data.phone || !data.district || !data.state) {
    errEl.innerHTML = '<span class="material-icons">warning</span> Please fill all required fields'; 
    errEl.style.display = 'flex'; return;
  }

  try {
    if (id) {
      await SchoolsAPI.update(id, data);
      toast('School updated!');
    } else {
      await SchoolsAPI.create(data);
      toast('School added!');
    }
    closeModal();
    _schools = await SchoolsAPI.list();
    renderSchools();
  } catch (err) {
    errEl.innerHTML = `<span class="material-icons">error</span> ${err.message || 'Failed to save!'}`;
    errEl.style.display = 'flex';
  }
}

async function deleteSchool(id, name) {
  confirmDialog(`Are you sure you want to delete <strong>${name}</strong>?`, async () => {
    try {
      await SchoolsAPI.delete(id);
      toast('School deleted!');
      _schools = await SchoolsAPI.list();
      renderSchools();
    } catch (err) {
      toast('Failed to delete!', 'error');
    }
  });
}
