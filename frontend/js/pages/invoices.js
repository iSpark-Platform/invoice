let _invoices = [];
let _invSchools = [];
let _invFilters = { school: '', type: '', fy: '' };

async function loadInvoices() {
  try {
    const [invs, schs] = await Promise.all([InvoicesAPI.list(), SchoolsAPI.list()]);
    _invoices = ensureArray(invs);
    _invSchools = ensureArray(schs);
    renderInvoices();
  } catch (err) {
    document.getElementById('page-content').innerHTML =
      `<div class="alert alert-error">
        <span class="material-icons">error</span>
        <div>
          <strong>Failed to load invoices!</strong><br/>
          <small>${err.message}</small>
        </div>
      </div>`;
  }
}

function getFilteredInvoices() {
  return _invoices.filter(inv => {
    const ms = _invFilters.school
      ? (inv.school_name || '').toLowerCase().includes(_invFilters.school.toLowerCase()) : true;
    const mt = _invFilters.type ? inv.invoice_type === _invFilters.type : true;
    const mf = _invFilters.fy   ? inv.financial_year === _invFilters.fy   : true;
    return ms && mt && mf;
  });
}

function renderInvoices() {
  const filtered = getFilteredInvoices();
  const totalRevenue  = _invoices.reduce((a, i) => a + Number(i.total), 0);
  const paidAmount    = _invoices.filter(i => i.status === 'paid').reduce((a, i) => a + Number(i.total), 0);
  const pendingAmount = _invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled').reduce((a, i) => a + Number(i.total), 0);

// Using global fyOptions and fyTag from utils.js

// ═══ Toast Notifications ══════════════════════════════════
  const stats = `<div class="stat-grid">
    <div class="stat-card">
      <div class="stat-icon-wrap" style="background:#eff6ff; color:var(--primary);">
        <span class="material-icons">receipt_long</span>
      </div>
      <div class="stat-info">
        <div class="stat-value">${_invoices.length}</div>
        <div class="stat-label">Total Invoices</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon-wrap" style="background:#f5f3ff; color:#8b5cf6;">
        <span class="material-icons">trending_up</span>
      </div>
      <div class="stat-info">
        <div class="stat-value">${fmtCurr(totalRevenue)}</div>
        <div class="stat-label">Total Revenue</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon-wrap" style="background:#ecfdf5; color:var(--success);">
        <span class="material-icons">check_circle</span>
      </div>
      <div class="stat-info">
        <div class="stat-value">${fmtCurr(paidAmount)}</div>
        <div class="stat-label">Paid Amount</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon-wrap" style="background:#fff7ed; color:var(--secondary);">
        <span class="material-icons">pending_actions</span>
      </div>
      <div class="stat-info">
        <div class="stat-value">${fmtCurr(pendingAmount)}</div>
        <div class="stat-label">Pending Amount</div>
      </div>
    </div>
  </div>`;

  const role = userInfo.role;

  const columns = [
    { title:'Invoice No', key:'invoice_number', render:(v, r) =>
      `<strong style="color:var(--primary);">${v}</strong>` },
    { title:'Type', key:'invoice_type', render:(v) => tag(v?.toUpperCase(), v==='monthly'?'tag-blue':'tag-purple') },
    { title:'School', key:'school_name', render:(v, r) =>
      `<div><div style="font-weight:600">${v}</div>${r.school_district ? `<div style="font-size:11px;color:var(--text-muted);display:flex;align-items:center;gap:4px;"><span class="material-icons" style="font-size:12px">place</span>${r.school_district}</div>` : ''}</div>` },
    { title:'Rate',     key:'rate',     render:(v) => `₹${v}` },
    { title:'Total',    key:'total',    render:(v) => `<strong>${fmtCurr(v)}</strong>` },
    { title:'FY',       key:'financial_year', render:(v) => fyTag(v) },
    { title:'For Month',key:'invoice_month',  render:(v) => v ? tag(monthLabel(v), 'tag-blue') : '-' },
    { title:'Status',   key:'status', render:(v, r) => `
      <select class="form-select" style="padding:6px 8px;font-size:12px;width:120px;"
        onchange="changeInvoiceStatus(${r.id}, this.value)">
        ${['draft','sent','paid','overdue','cancelled'].map(s =>
          `<option value="${s}" ${v===s?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`
        ).join('')}
      </select>` },
    { title:'Actions', key:'id', render:(v, r) => `
      <div class="actions">
        <button class="btn btn-secondary btn-small" onclick="viewInvoice(${r.id})" title="View Details">
          <span class="material-icons" style="font-size:16px;">visibility</span>
        </button>
        <button class="btn btn-secondary btn-small" onclick="editInvoice(${r.id})" title="Edit Invoice">
          <span class="material-icons" style="font-size:16px;color:var(--primary)">edit</span>
        </button>
        <button class="btn btn-primary btn-small" onclick="openInvoicePdf(${r.id})" title="View PDF">
          <span class="material-icons" style="font-size:16px;">picture_as_pdf</span>
        </button>
        <button class="btn btn-secondary btn-small" onclick="openEmailModal(${r.id})" title="Send via Email">
          <span class="material-icons" style="font-size:16px;">email</span>
        </button>
        ${['admin','accountant'].includes(role) ? `
          <button class="btn btn-secondary btn-small" onclick="deleteInvoice(${r.id},'${escHtml(r.invoice_number)}')" title="Delete" style="color:var(--danger); border-color:rgba(239,68,68,0.2);">
            <span class="material-icons" style="font-size:18px;">delete_outline</span>
          </button>` : ''}
      </div>` },
  ];

  document.getElementById('page-content').innerHTML = `
    <div>
      <div class="page-header">
        <div>
          <div class="page-title">Invoice Management</div>
          <div class="page-subtitle">Generate and track school invoices</div>
        </div>
        <div style="display:flex;gap:12px;">
          <button class="btn btn-secondary" onclick="invExcelExport()">
            <span class="material-icons" style="color:#1d6f42">file_download</span> Excel
          </button>
          <button class="btn btn-secondary" onclick="invPdfExport()">
            <span class="material-icons" style="color:var(--danger)">picture_as_pdf</span> PDF
          </button>
          <button class="btn btn-primary btn-large" onclick="openInvoiceModal()">
            <span class="material-icons">add</span> Generate Invoice
          </button>
        </div>
      </div>
      ${stats}
      <div class="filter-bar">
        <div class="filter-search-wrap">
          <span class="material-icons">search</span>
          <input type="text" placeholder="Search school name..." id="inv-search" value="${_invFilters.school}"
            oninput="_invFilters.school=this.value;renderInvoices()"/>
        </div>
        <div class="filter-group">
          <select onchange="_invFilters.type=this.value;renderInvoices()" style="width:160px;">
            <option value="" ${!_invFilters.type?'selected':''}>All Types</option>
            <option value="monthly"   ${_invFilters.type==='monthly'?'selected':''}>Monthly</option>
            <option value="quarterly" ${_invFilters.type==='quarterly'?'selected':''}>Quarterly</option>
          </select>
          <select onchange="_invFilters.fy=this.value;renderInvoices()" style="width:180px;">
            <option value="" ${!_invFilters.fy?'selected':''}>All Financial Years</option>
            ${typeof fyOptions === 'function' ? fyOptions() : ''}
          </select>
        </div>
        <div style="margin-left:auto; color:var(--text-muted); font-size:13px; font-weight:500; white-space:nowrap;">
          Showing <strong>${filtered.length}</strong> Invoices
        </div>
      </div>
      <div class="table-wrap">
        ${buildTable(columns, filtered, 'No invoices found')}
      </div>
    </div>`;
}

function openInvoiceModal(inv = null) {
  const isEdit = !!inv;
  const schoolOpts = _invSchools.map(s =>
    `<option value="${s.id}" ${inv?.school===s.id||inv?.school_id===s.id?'selected':''}>
      ${s.name}${s.district?` (${s.district})`:''}
     </option>`
  ).join('');

  openModal({
    title: isEdit ? 'Edit Invoice' : 'Generate New Invoice',
    wide: true,
    body: `
      <div class="form-group">
        <label>Invoice Type *</label>
        <select id="inv-type" class="form-select" onchange="invCalc()">
          <option value="monthly"   ${(!inv||inv.invoice_type==='monthly')?'selected':''}>Monthly — Due in 15 days</option>
          <option value="quarterly" ${inv?.invoice_type==='quarterly'?'selected':''}>Quarterly — Due in 30 days</option>
        </select>
      </div>
      <div class="form-grid-2">
        <div class="form-group">
          <label>Select School *</label>
          <select id="inv-school" class="form-select" onchange="invSchoolChange()">
            <option value="">-- Choose school to populate data --</option>
            ${schoolOpts}
          </select>
        </div>
        <div class="form-group">
          <label>Divided By (Months/Period)</label>
          <input type="number" id="inv-divisor" class="form-input" value="${inv?.divisor || 1}" oninput="invCalc()" placeholder="Ex: 9 for academic year"/>
        </div>
      </div>
      <div class="form-grid-2">
        <div class="form-group">
          <label>Invoice Date *</label>
          <input type="date" id="inv-date" class="form-input" value="${inv?.invoice_date || new Date().toISOString().slice(0,10)}"/>
        </div>
        <div class="form-group">
          <label>Invoice For (Month) *</label>
          <input type="month" id="inv-month" class="form-input"
            value="${inv?.invoice_month || new Date(new Date().setMonth(new Date().getMonth()-1)).toISOString().slice(0,7)}"/>
        </div>
      </div>
      <div class="form-grid-2">
        <div class="form-group">
          <label>Total Students *</label>
          <input type="number" id="inv-students" class="form-input" value="${inv?.students || ''}" oninput="invCalc()"/>
        </div>
        <div class="form-group">
          <label>Rate per Student (₹) *</label>
          <input type="number" id="inv-rate" class="form-input" value="${inv?.rate || ''}" placeholder="Ex: 200" oninput="invCalc()"/>
        </div>
      </div>
      
      <div style="background:#f8fafc; padding:24px; border-radius:12px; border:1px solid var(--border-color); margin-top:24px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);">
        <div style="font-weight:700; color:var(--text-main); font-size:16px; margin-bottom:20px; display:flex; align-items:center; gap:8px;">
          <span class="material-icons" style="color:var(--primary)">calculate</span> Final Payment Breakdown
        </div>
        <div class="form-grid-4" style="align-items: end;">
          <div class="form-group" style="margin-bottom:0">
            <label>Subtotal (₹)</label>
            <input type="text" id="inv-subtotal" class="form-input" readonly style="background:#fff; font-weight:600;"/>
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label>CGST 9% (₹)</label>
            <input type="text" id="inv-cgst" class="form-input" readonly style="background:#fff; color:var(--text-muted);"/>
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label>SGST 9% (₹)</label>
            <input type="text" id="inv-sgst" class="form-input" readonly style="background:#fff; color:var(--text-muted);"/>
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label style="color:var(--primary); font-weight:700;">Grand Total (₹)</label>
            <div id="inv-total-display" style="background:var(--primary); color:#fff; padding:10px 16px; border-radius:var(--radius-md); font-size:18px; font-weight:800; text-align:center; box-shadow: 0 4px 12px rgba(22,64,255,0.2);">
              ₹0.00
            </div>
            <input type="hidden" id="inv-total"/>
          </div>
        </div>
      </div>
      <div id="inv-error" class="alert alert-error" style="display:none; margin-top:16px;"></div>
    `,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveInvoice(${inv?.id || 'null'})">
        <span class="material-icons">publish</span> ${isEdit ? 'Update Invoice' : 'Generate Invoice'}
      </button>
    `,
  });

  // Initialize calculations
  invCalc();
}

function invSchoolChange() {
  const sid    = parseInt(document.getElementById('inv-school').value);
  const school = _invSchools.find(s => s.id === sid);
  if (school) {
    document.getElementById('inv-students').value = school.students;
    
    // Auto-divisor logic: Matric = 10, Others = 9
    const sname = (school.name || '').toLowerCase();
    document.getElementById('inv-divisor').value = sname.includes('matric') ? 10 : 9;
    
    invCalc();
  }
}

function invCalc() {
  const students = parseFloat(document.getElementById('inv-students').value) || 0;
  const rate     = parseFloat(document.getElementById('inv-rate').value)     || 0;
  const divisor  = parseFloat(document.getElementById('inv-divisor').value)  || 1;
  const subtotal = (students * rate) / (divisor || 1);
  const cgst     = Math.round(subtotal * 0.09 * 100) / 100;
  const sgst     = Math.round(subtotal * 0.09 * 100) / 100;
  const total    = Math.round(subtotal + cgst + sgst);
  document.getElementById('inv-subtotal').value = subtotal.toFixed(2);
  document.getElementById('inv-cgst').value     = cgst.toFixed(2);
  document.getElementById('inv-sgst').value     = sgst.toFixed(2);
  
  const totalStr = total.toFixed(2);
  document.getElementById('inv-total').value = totalStr;
  document.getElementById('inv-total-display').innerText = '₹' + Number(totalStr).toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

async function saveInvoice(id) {
  const errEl    = document.getElementById('inv-error');
  errEl.style.display = 'none';

  const school   = parseInt(document.getElementById('inv-school').value);
  const invType  = document.getElementById('inv-type').value;
  const invDate  = document.getElementById('inv-date').value;
  const invMonth = document.getElementById('inv-month').value;
  const students = parseInt(document.getElementById('inv-students').value);
  const rate     = parseFloat(document.getElementById('inv-rate').value);
  const divisor  = parseInt(document.getElementById('inv-divisor').value) || 1;

  if (!school || !invDate || !invMonth || !students || !rate) {
    errEl.innerHTML = '<span class="material-icons">warning</span> Please fill all required fields'; 
    errEl.style.display = 'flex'; return;
  }

  const payload = { school, invoice_type: invType, invoice_date: invDate, invoice_month: invMonth, students, rate, divisor };

  try {
    if (id) {
      await InvoicesAPI.update(id, payload);
      toast('Invoice updated successfully!');
    } else {
      await InvoicesAPI.create(payload);
      toast('Invoice created successfully!');
    }
    closeModal();
    _invoices = await InvoicesAPI.list();
    renderInvoices();
  } catch (err) {
    errEl.innerHTML = `<span class="material-icons">error</span> ${err.message || 'Failed to save invoice!'}`;
    errEl.style.display = 'flex';
  }
}

function editInvoice(id) {
  const inv = _invoices.find(i => i.id === id);
  openInvoiceModal(inv);
}

async function changeInvoiceStatus(id, status) {
  try {
    await InvoicesAPI.patch(id, { status });
    toast('Status updated!');
    const idx = _invoices.findIndex(i => i.id === id);
    if (idx >= 0) _invoices[idx].status = status;
  } catch (err) {
    toast('Failed to update status!', 'error');
  }
}

function openInvoicePdf(id) {
  window.open(InvoicesAPI.pdfUrl(id), '_blank');
}

async function deleteInvoice(id, invNum) {
  confirmDialog(`Are you sure you want to delete invoice <strong>${invNum}</strong>?`, async () => {
    try {
      await InvoicesAPI.delete(id);
      toast('Invoice deleted!');
      _invoices = await InvoicesAPI.list();
      renderInvoices();
    } catch (err) { toast('Failed to delete!', 'error'); }
  });
}

function viewInvoice(id) {
  const r = _invoices.find(i => i.id === id);
  if (!r) return;
  
  const subTotal = Number(r.subtotal || 0);
  const gstAmt   = Number(r.gst || 0);
  const totalRaw = subTotal + gstAmt;
  const grandTotal = Math.round(totalRaw);
  const roundOff   = grandTotal - totalRaw;

  openModal({
    title: `Invoice Preview: ${r.invoice_number}`,
    wide: true,
    body: `
      <div style="padding:10px;">
        <!-- Header Style -->
        <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:3px solid #f39c12; padding-bottom:12px; margin-bottom:20px;">
          <img src="../brand/iSpark.png" alt="Logo" style="height:45px;">
          <div style="text-align:right;">
            <div style="font-size:18px; font-weight:800; color:#1a3a5c; letter-spacing:1px;">TAX INVOICE</div>
            <div style="font-size:11px; color:#64748b; font-weight:600;">GSTIN: 33AAFCI5350R1Z6</div>
          </div>
        </div>

        <div class="inv-info-grid">
          <div class="inv-info-cell">
            <span class="info-label">Invoice To</span>
            <div class="info-value" style="color:var(--primary);">${r.school_name}</div>
            <div style="font-size:11px; color:#64748b; margin-top:2px;">${r.school_district || ''}</div>
          </div>
          <div class="inv-info-cell">
            <span class="info-label">Date & Month</span>
            <div class="info-value">${new Date(r.invoice_date).toLocaleDateString('en-IN')}</div>
            <div style="font-size:11px; color:#64748b; margin-top:2px;">${monthLabel(r.invoice_month)}</div>
          </div>
          <div class="inv-info-cell">
            <span class="info-label">Invoice Details</span>
            <div class="info-value">#${r.invoice_number}</div>
            <div style="font-size:11px; color:#64748b;">FY ${r.financial_year || ''} | ${r.invoice_type.toUpperCase()}</div>
          </div>
        </div>

        <div class="inv-amount-grid" style="margin-bottom:25px;">
          <div class="inv-amount-cell">
            <div class="amt-label">Taxable Value</div>
            <div class="amt-value" style="color:#64748b;">${fmtCurr(subTotal)}</div>
          </div>
          <div class="inv-amount-cell">
            <div class="amt-label">GST (18%)</div>
            <div class="amt-value" style="color:#64748b;">${fmtCurr(gstAmt)}</div>
          </div>
          <div class="inv-amount-cell">
            <div class="amt-label">Round Off</div>
            <div class="amt-value" style="color:#64748b;">${roundOff >= 0 ? '+' : ''}${roundOff.toFixed(2)}</div>
          </div>
          <div class="inv-amount-cell primary">
            <div class="amt-label">Grand Total</div>
            <div class="amt-value" style="font-size:22px;">${fmtCurr(grandTotal)}</div>
          </div>
        </div>

        <div class="pdf-preview">
          <div class="pdf-preview-header">
            <span class="material-icons">description</span> Final Print PDF Preview
          </div>
          <iframe src="${InvoicesAPI.pdfUrl(r.id)}" title="PDF Preview"></iframe>
        </div>
      </div>
    `,
    footer: `
      <div style="width:100%; display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; gap:10px;">
          <button class="btn btn-primary" onclick="openInvoicePdf(${r.id})">
            <span class="material-icons">print</span> Print Invoice
          </button>
          <button class="btn btn-secondary" onclick="closeModal(); openEmailModal(${r.id})">
            <span class="material-icons">send</span> Send via Email
          </button>
        </div>
        <button class="btn btn-secondary" onclick="closeModal()">Close</button>
      </div>
    `,
  });
}

function openEmailModal(id) {
  const inv = _invoices.find(i => i.id === id);
  if (!inv) return;
  const ml = inv.invoice_month ? monthLabel(inv.invoice_month) : '';
  openModal({
    title: `Send Email: ${inv.invoice_number}`,
    body: `
      <div class="form-group">
        <label>To*</label>
        <input type="email" id="em-to" class="form-input" value="${escHtml(inv.school_email)}" placeholder="school@example.com"/>
      </div>
      <div class="form-grid-2">
        <div class="form-group">
          <label>CC</label>
          <input type="email" id="em-cc" class="form-input" placeholder="cc@example.com"/>
        </div>
        <div class="form-group">
          <label>BCC</label>
          <input type="email" id="em-bcc" class="form-input" placeholder="bcc@example.com"/>
        </div>
      </div>
      <div class="form-group">
        <label>Email Subject *</label>
        <input type="text" id="em-subject" class="form-input" value="Invoice for ${ml} — iSpark Learning"/>
      </div>
      <div class="email-info-box">
        <div class="info-title"><span class="material-icons">info</span> Attachment Info</div>
        <div>The invoice PDF will be automatically attached to this email.</div>
        <div style="margin-top:4px"><strong>Billing Month:</strong> ${ml}</div>
      </div>
      <div id="em-error" class="alert alert-error" style="display:none; margin-top:16px;"></div>
    `,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="em-send-btn" onclick="sendInvoiceEmail(${id})">
        <span class="material-icons">send</span> Send Email
      </button>
    `,
  });
}

async function sendInvoiceEmail(id) {
  const errEl  = document.getElementById('em-error');
  const btn    = document.getElementById('em-send-btn');
  errEl.style.display = 'none';

  const to      = document.getElementById('em-to').value.trim();
  const cc      = document.getElementById('em-cc').value.trim();
  const bcc     = document.getElementById('em-bcc').value.trim();
  const subject = document.getElementById('em-subject').value.trim();

  if (!to || !subject) {
    errEl.innerHTML = '<span class="material-icons">warning</span> Email and subject are required';
    errEl.style.display = 'flex'; return;
  }
  
  btn.disabled = true; btn.innerHTML = '<span class="material-icons">sync</span> Sending...';
  try {
    await InvoicesAPI.sendEmail(id, { to_email: to, cc_email: cc, bcc_email: bcc, subject });
    toast('Email sent successfully!');
    closeModal();
  } catch (err) {
    errEl.innerHTML = `<span class="material-icons">error</span> ${err.message || 'Failed to send!'}`;
    errEl.style.display = 'flex';
    btn.disabled = false; btn.innerHTML = '<span class="material-icons">send</span> Send Email';
  }
}

const _invExportCols = [
  {title:'Invoice No',    key:'invoice_number'},
  {title:'School',        key:'school_name'},
  {title:'Bill Month',    key:'invoice_month'},
  {title:'Date',          key:'invoice_date'},
  {title:'Total Amount',  key:'total'},
  {title:'Status',        key:'status'},
];
function invExcelExport() { 
  console.log('invExcelExport clicked');
  exportToExcel(getFilteredInvoices(), _invExportCols, `Invoices_Export_${new Date().toISOString().slice(0,10)}`); 
}
function invPdfExport()   { exportToPDF(getFilteredInvoices(), _invExportCols, `Invoices_Export_${new Date().toISOString().slice(0,10)}`, 'Invoice Summary Report'); }