let _payments = [];
let _payInvoices = [];
let _payFilters = { search: '' };

async function loadPayments() {
  try {
    const [pays, invs] = await Promise.all([PaymentsAPI.list(), InvoicesAPI.list()]);
    _payments = ensureArray(pays);
    _payInvoices = ensureArray(invs);
    renderPayments();
  } catch (err) {
    document.getElementById('page-content').innerHTML =
      `<div class="alert alert-error">
        <span class="material-icons">error</span>
        <div>
          <strong>Failed to load payments!</strong><br/>
          <small>${err.message}</small>
        </div>
      </div>`;
  }
}

const modeColor = { bank_transfer:'tag-blue', cheque:'tag-purple', upi:'tag-green', cash:'tag-orange' };
const modeIcon  = { bank_transfer:'account_balance', cheque:'receipt', upi:'qr_code_2', cash:'payments' };
const modeLabel = { bank_transfer:'Bank Transfer', cheque:'Cheque', upi:'UPI', cash:'Cash' };

function getFilteredPayments() {
  return _payments.filter(p => {
    return _payFilters.search
      ? (p.school_name || '').toLowerCase().includes(_payFilters.search.toLowerCase()) || 
        (p.invoice_number || '').toLowerCase().includes(_payFilters.search.toLowerCase()) ||
        (p.reference || '').toLowerCase().includes(_payFilters.search.toLowerCase())
      : true;
  });
}

function renderPayments() {
  const role = userInfo.role;
  const totalCollected = _payments.filter(p=>p.status==='completed').reduce((a,p)=>a+Number(p.net_amount||p.amount),0);
  const pendingCount   = _payments.filter(p=>p.status==='pending').length;

  const stats = `<div class="stat-grid">
    <div class="stat-card">
      <div class="stat-icon-wrap" style="background:#eff6ff; color:var(--primary);">
        <span class="material-icons">payments</span>
      </div>
      <div class="stat-info">
        <div class="stat-value">${_payments.length}</div>
        <div class="stat-label">Total Payments</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon-wrap" style="background:#ecfdf5; color:var(--success);">
        <span class="material-icons">account_balance_wallet</span>
      </div>
      <div class="stat-info">
        <div class="stat-value">${fmtCurr(totalCollected)}</div>
        <div class="stat-label">Net Collected</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon-wrap" style="background:#fff7ed; color:var(--secondary);">
        <span class="material-icons">history</span>
      </div>
      <div class="stat-info">
        <div class="stat-value">${pendingCount}</div>
        <div class="stat-label">Pending Reviews</div>
      </div>
    </div>
  </div>`;

  // Mode cards
  let modeCards = `<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:24px; margin-bottom:32px;">`;
  ['bank_transfer','cheque','upi','cash'].forEach(mode => {
    const cnt   = _payments.filter(p => p.mode === mode).length;
    const total = _payments.filter(p => p.mode === mode).reduce((a, p) => a + Number(p.net_amount||p.amount), 0);
    modeCards += `<div class="stat-card" style="padding:16px 20px;">
      <div class="stat-icon-wrap" style="width:40px; height:40px; border-radius:10px; font-size:20px; background:var(--bg-color); color:var(--text-muted);">
        <span class="material-icons">${modeIcon[mode]}</span>
      </div>
      <div class="stat-info">
        <div style="font-weight:700; font-size:16px;">${fmtCurr(total)}</div>
        <div style="font-size:12px; color:var(--text-muted)">${modeLabel[mode]} (${cnt})</div>
      </div>
    </div>`;
  });
  modeCards += `</div>`;

  const columns = [
    { title:'#',             key:'id', render:(v, r, i) => i + 1 },
    { title:'Invoice No',    key:'invoice_number', render:(v) => `<strong style="color:var(--primary);">${v}</strong>` },
    { title:'School',        key:'school_name', render:(v, r) =>
      `<div><div style="font-weight:600">${v}</div>${r.school_district?`<div style="font-size:11px;color:var(--text-muted);display:flex;align-items:center;gap:4px;"><span class="material-icons" style="font-size:12px">place</span>${r.school_district}</div>`:''}` },
    { title:'Gross Amount',  key:'amount',     render:(v) => fmtCurr(v) },
    { title:'Deductions',    key:'tds_amount', render:(v, r) =>
      r.tds_deducted ? `<span style="color:var(--danger); font-weight:500;">- ${fmtCurr(v)} (TDS)</span>` : `<span style="color:var(--text-muted)">No TDS</span>` },
    { title:'Net Received',  key:'net_amount', render:(v, r) =>
      `<strong style="color:var(--success); font-size:15px;">${fmtCurr(r.tds_deducted ? v : r.amount)}</strong>` },
    { title:'Method',        key:'mode', render:(v) => `
      <div style="display:flex;align-items:center;gap:6px;">
        <span class="material-icons" style="font-size:16px;color:var(--text-muted)">${modeIcon[v]||'payment'}</span>
        ${tag(modeLabel[v] || v, modeColor[v] || 'tag-grey')}
      </div>` },
    { title:'Ref / Date',    key:'reference', render:(v, r) => `
      <div>
        <div style="font-weight:500;">${v || '-'}</div>
        <div style="font-size:12px;color:var(--text-muted)">${r.date}</div>
      </div>` },
    { title:'Status',        key:'status', render:(v) => tag(v.toUpperCase(), v==='completed'?'tag-green':'tag-orange') },
    { title:'Actions', key:'id', render:(v, r) => `
      <div class="actions">
        <button class="btn btn-secondary btn-small" onclick="editPayment(${r.id})" title="Edit Details">
          <span class="material-icons" style="font-size:16px;color:var(--primary)">edit</span>
        </button>
        ${['admin','accountant'].includes(role) ? `
          <button class="btn btn-secondary btn-small" onclick="deletePayment(${r.id},'${fmtCurr(r.amount)}','${escHtml(r.invoice_number)}')" title="Delete" style="color:var(--danger); border-color:rgba(239,68,68,0.2);">
            <span class="material-icons" style="font-size:18px;">delete_outline</span>
          </button>` : ''}
      </div>` },
  ];

  const filtered = getFilteredPayments();

  document.getElementById('page-content').innerHTML = `
    <div>
      <div class="page-header">
        <div>
          <div class="page-title">Payment Tracking</div>
          <div class="page-subtitle">Track receipts and TDS deductions</div>
        </div>
        <div style="display:flex;gap:12px;">
          <button class="btn btn-secondary" onclick="payExcelExport()">
            <span class="material-icons" style="color:#1d6f42">file_download</span> Excel
          </button>
          <button class="btn btn-secondary" onclick="payPdfExport()">
            <span class="material-icons" style="color:var(--danger)">picture_as_pdf</span> PDF
          </button>
          <button class="btn btn-primary btn-large" onclick="openPaymentModal()">
            <span class="material-icons">add_card</span> Record Payment
          </button>
        </div>
      </div>
      ${stats}${modeCards}
      <div class="filter-bar">
        <div class="filter-search-wrap">
          <span class="material-icons">search</span>
          <input type="text" placeholder="Search by school, invoice or reference..." id="pay-search" value="${_payFilters.search}"
            oninput="_payFilters.search=this.value;renderPayments()"/>
        </div>
        <div style="margin-left:auto; color:var(--text-muted); font-size:13px; font-weight:500; white-space:nowrap;">
          Showing <strong>${filtered.length}</strong> Payments
        </div>
      </div>
      <div class="table-wrap">
        ${buildTable(columns, filtered, 'No payments found')}
      </div>
    </div>`;
}

function openPaymentModal(pay = null) {
  const isEdit = !!pay;
  const invOpts = _payInvoices.map(i =>
    `<option value="${i.id}" ${pay?.invoice===i.id||pay?.invoice_id===i.id?'selected':''}>
      ${i.invoice_number} — ${i.school_name}${i.school_district?' ('+i.school_district+')':''}
     </option>`
  ).join('');

  openModal({
    title: isEdit ? 'Edit Payment Record' : 'Record New Payment',
    body: `
      <div class="form-group">
        <label>Select Invoice *</label>
        <select id="pay-invoice" class="form-select" onchange="payInvoiceChange()">
          <option value="">-- Choose invoice --</option>
          ${invOpts}
        </select>
      </div>
      <div class="form-group">
        <label>Invoice Amount (₹)</label>
        <input type="number" id="pay-amount" class="form-input" readonly style="background:#f8fafc;"
          value="${pay?.amount || ''}"/>
      </div>
      <div style="background:#f0f9ff; padding:16px; border-radius:8px; margin-bottom:20px; border:1px solid #bae6fd;">
        <label class="checkbox-label">
          <input type="checkbox" id="pay-tds" ${(pay?.tds_deducted||!pay)?'checked':''} onchange="payTDSChange()"/>
          <strong style="color:#0369a1">Enable TDS Deduction @ 10%</strong>
        </label>
      </div>
      <div class="form-grid-2">
        <div class="form-group">
          <label>TDS Amount (₹)</label>
          <input type="text" id="pay-tds-amt" class="form-input" readonly
            style="background:#fff7ed;color:#c2410c;font-weight:700;" value="${pay?.tds_amount||''}"/>
        </div>
        <div class="form-group">
          <label>Net Received (₹)</label>
          <input type="text" id="pay-net-amt" class="form-input" readonly
            style="background:#ecfdf5;color:#047857;font-weight:700;" value="${pay?.net_amount||''}"/>
        </div>
      </div>
      <div class="form-group">
        <label>Payment Method *</label>
        <select id="pay-mode" class="form-select">
          <option value="">-- Select Method --</option>
          <option value="bank_transfer" ${pay?.mode==='bank_transfer'?'selected':''}>Bank Transfer</option>
          <option value="cheque"        ${pay?.mode==='cheque'?'selected':''}>Cheque</option>
          <option value="upi"           ${pay?.mode==='upi'?'selected':''}>UPI Transaction</option>
          <option value="cash"          ${pay?.mode==='cash'?'selected':''}>Cash Payment</option>
        </select>
      </div>
      <div class="form-group">
        <label>Reference Number</label>
        <input type="text" id="pay-ref" class="form-input" value="${pay?.reference||''}"
          placeholder="Ex: TXN123456 / Cheque No / UPI ID"/>
      </div>
      <div class="form-group">
        <label>Payment Date *</label>
        <input type="date" id="pay-date" class="form-input" value="${pay?.date||new Date().toISOString().slice(0,10)}"/>
      </div>
      <div id="pay-error" class="alert alert-error" style="display:none; margin-top:16px;"></div>
    `,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="savePayment(${pay?.id||'null'})">
        <span class="material-icons">check_circle</span> ${isEdit?'Update Record':'Record Payment'}
      </button>
    `,
  });
}

function payInvoiceChange() {
  const invId  = parseInt(document.getElementById('pay-invoice').value);
  const inv    = _payInvoices.find(i => i.id === invId);
  if (!inv) return;
  const total  = Number(inv.total);
  const sub    = Number(inv.subtotal);
  const tds    = parseFloat((sub * 0.10).toFixed(2));
  const net    = parseFloat((total - tds).toFixed(2));
  document.getElementById('pay-amount').value  = total;
  document.getElementById('pay-tds-amt').value = tds;
  document.getElementById('pay-net-amt').value = net;
}

function payTDSChange() {
  const checked = document.getElementById('pay-tds').checked;
  const total   = Number(document.getElementById('pay-amount').value || 0);
  const invId   = parseInt(document.getElementById('pay-invoice').value);
  const inv     = _payInvoices.find(i => i.id === invId);
  if (checked && inv) {
    const tds = parseFloat((Number(inv.subtotal) * 0.10).toFixed(2));
    const net = parseFloat((total - tds).toFixed(2));
    document.getElementById('pay-tds-amt').value = tds;
    document.getElementById('pay-net-amt').value = net;
  } else {
    document.getElementById('pay-tds-amt').value = 0;
    document.getElementById('pay-net-amt').value = total;
  }
}

function editPayment(id) {
  const pay = _payments.find(p => p.id === id);
  if (!pay) return;
  openPaymentModal(pay);
}

async function savePayment(id) {
  const errEl = document.getElementById('pay-error');
  errEl.style.display = 'none';

  const invoice     = parseInt(document.getElementById('pay-invoice').value);
  const amount      = Number(document.getElementById('pay-amount').value);
  const tdsDeducted = document.getElementById('pay-tds').checked;
  const tdsAmount   = Number(document.getElementById('pay-tds-amt').value || 0);
  const netAmount   = Number(document.getElementById('pay-net-amt').value || 0);
  const mode        = document.getElementById('pay-mode').value;
  const reference   = document.getElementById('pay-ref').value.trim();
  const date        = document.getElementById('pay-date').value;

  if (!invoice || !mode || !date) {
    errEl.innerHTML = '<span class="material-icons">warning</span> Please fill all required fields'; 
    errEl.style.display = 'flex'; return;
  }
  const payload = { invoice, amount, tds_deducted: tdsDeducted, tds_amount: tdsDeducted ? tdsAmount : 0,
    net_amount: tdsDeducted ? netAmount : amount, mode, reference, date, status: 'completed' };

  try {
    if (id) {
      await PaymentsAPI.update(id, payload);
      toast('Payment updated!');
    } else {
      await PaymentsAPI.create(payload);
      toast('Payment recorded!');
    }
    closeModal();
    _payments = await PaymentsAPI.list();
    renderPayments();
  } catch (err) {
    errEl.innerHTML = `<span class="material-icons">error</span> ${err.message || 'Failed to save payment!'}`;
    errEl.style.display = 'flex';
  }
}

async function deletePayment(id, amount, invNum) {
  confirmDialog(`Are you sure you want to delete payment of <strong>${amount}</strong> for <strong>${invNum}</strong>?`, async () => {
    try {
      await PaymentsAPI.delete(id);
      toast('Payment deleted!');
      _payments = await PaymentsAPI.list();
      renderPayments();
    } catch (err) { toast('Failed to delete!', 'error'); }
  });
}

function payExcelExport() { 
  const cols = [
    {title:'Invoice NO', key:'invoice_number'},
    {title:'School',     key:'school_name'},
    {title:'Amount',     key:'amount'},
    {title:'TDS',        key:'tds_amount'},
    {title:'Net Received',key:'net_amount'},
    {title:'Date',        key:'date'},
    {title:'Mode',        key:'mode'}
  ];
  exportToExcel(_payments, cols, `Payments_Export_${new Date().toISOString().slice(0,10)}`); 
}
function payPdfExport() {
  const cols = [
    {title:'Invoice NO', key:'invoice_number'},
    {title:'School',     key:'school_name'},
    {title:'Amount',     key:'amount'},
    {title:'TDS',        key:'tds_amount'},
    {title:'Net Received',key:'net_amount'},
    {title:'Date',        key:'date'},
    {title:'Mode',        key:'mode'}
  ];
  exportToPDF(_payments, cols, `Payments_Export_${new Date().toISOString().slice(0,10)}`, 'Payment Transactions Report');
}
