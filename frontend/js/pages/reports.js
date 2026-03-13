let _reportsData = null;
let _reportsFY   = '';

async function loadReports() {
  try {
    const data = await InvoicesAPI.reports();
    renderReports(data);
  } catch (err) {
    document.getElementById('page-content').innerHTML =
      `<div class="alert alert-error">
        <span class="material-icons">error</span>
        <div>
          <strong>Failed to load reports!</strong><br/>
          <small>${err.message}</small>
        </div>
      </div>`;
  }
}

async function fetchReports(fy = '') {
  _reportsFY   = fy;
  _reportsData = await InvoicesAPI.reports(fy);
  renderReportContent();
}

function renderReports(data) {
  _reportsData = data;
  document.getElementById('page-content').innerHTML = `
    <div>
      <div class="page-header">
        <div>
          <div class="page-title">Financial Reports</div>
          <div class="page-subtitle">Detailed business analytics and school-wise performance</div>
        </div>
        <div style="display:flex; align-items:center; gap:12px; background:#fff; padding:8px 16px; border-radius:12px; border:1px solid var(--border-color); box-shadow:var(--shadow-sm);">
          <span class="material-icons" style="color:var(--text-muted); font-size:18px;">filter_alt</span>
          <select onchange="fetchReports(this.value)" style="border:none; outline:none; font-size:14px; font-weight:600; cursor:pointer;">
            <option value="">All Financial Years</option>
            <option value="2425">FY 2024-25</option>
            <option value="2526">FY 2025-26</option>
          </select>
        </div>
      </div>
      <div id="reports-content"></div>
    </div>`;
  renderReportContent();
}

function renderReportContent() {
  const d = _reportsData;
  if (!d) return;

  // FY Summary
  const fyColumns = [
    { title:'Financial Year', key:'financial_year', render:(v) => fyTag(v) },
    { title:'Invoices', key:'count' },
    { title:'Total Billing',   key:'total',  render:(v) => `<strong>${fmtCurr(v)}</strong>` },
    { title:'Paid',    key:'paid',   render:(v) => `<span style="color:var(--success); font-weight:600;">${fmtCurr(v)}</span>` },
    { title:'Pending', key:'total',  render:(v, r) => `<span style="color:var(--secondary); font-weight:600;">${fmtCurr((r.total||0)-(r.paid||0))}</span>` },
  ];

  // School-wise
  const schoolColumns = [
    { title:'#',             key:'id', render:(v, r, i) => i + 1 },
    { title:'School Name',   key:'school__name',     render:(v) => `<strong style="color:var(--primary)">${v}</strong>` },
    { title:'District', key:'school__district', render:(v) => v ? tag(v, 'tag-blue') : '-' },
    { title:'Total Billing',    key:'total', render:(v) => `<strong>${fmtCurr(v)}</strong>` },
    { title:'Received',     key:'paid',  render:(v) => `<span style="color:var(--success); font-weight:500;">${fmtCurr(v)}</span>` },
    { title:'Outstanding',  key:'total', render:(v, r) => `<span style="color:var(--secondary); font-weight:500;">${fmtCurr((r.total||0)-(r.paid||0))}</span>` },
  ];

  // Monthly
  const monthlyColumns = [
    { title:'#',                key:'id', render:(v, r, i) => i + 1 },
    { title:'Billing Month',    key:'invoice_month', render:(v) => `<div style="font-weight:600">${monthLabel(v)}</div>` },
    { title:'Invoices', key:'count' },
    { title:'Total Amount',    key:'total', render:(v) => fmtCurr(v) },
    { title:'Paid',     key:'paid',  render:(v) => `<span style="color:var(--success);">${fmtCurr(v)}</span>` },
    { title:'Status',  key:'total', render:(v, r) => {
        const p = ((r.paid||0)/(r.total||1)*100).toFixed(0);
        return `<div style="width:100px; background:#f1f5f9; height:8px; border-radius:10px; overflow:hidden; margin-top:4px;">
                  <div style="width:${p}%; background:var(--success); height:100%;"></div>
                </div><div style="font-size:10px; color:var(--text-muted); margin-top:2px;">${p}% Collected</div>`;
      } 
    },
  ];

  document.getElementById('reports-content').innerHTML = `
    <div class="card">
      <div class="card-title"><span class="material-icons" style="color:var(--primary)">calendar_month</span> Financial Year Summary</div>
      <div class="table-wrap">
        ${buildTable(fyColumns, d.fy_summary || [], 'No data available for this period')}
      </div>
    </div>

    <div class="card">
      <div class="card-title"><span class="material-icons" style="color:var(--primary)">school</span> School-wise Performance Report</div>
      <div class="table-wrap">
        ${buildTable(schoolColumns, d.school_report || [], 'No school data found')}
      </div>
    </div>

    <div class="card">
      <div class="card-title" style="display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:8px;"><span class="material-icons" style="color:var(--primary)">bar_chart</span> Monthly Collection Trends</div>
        <div style="display:flex;gap:12px;">
          <button class="btn btn-secondary btn-small" onclick="monthlyExcelExport()">
            <span class="material-icons" style="font-size:16px; color:#1d6f42;">file_download</span> Excel
          </button>
          <button class="btn btn-secondary btn-small" onclick="monthlyPdfExport()">
            <span class="material-icons" style="font-size:16px; color:var(--danger);">picture_as_pdf</span> PDF
          </button>
        </div>
      </div>
      <div class="table-wrap">
        ${buildTable(monthlyColumns, d.monthly_report || [], 'No monthly data found')}
      </div>
    </div>`;
}

function monthlyExcelExport() {
  const cols = [{title:'Month',key:'invoice_month'},{title:'Invoices',key:'count'},{title:'Total Amount',key:'total'},{title:'Paid Amount',key:'paid'}];
  exportToExcel(_reportsData?.monthly_report||[], cols, `Monthly_Report_${new Date().toISOString().slice(0,10)}`);
}
function monthlyPdfExport() {
  const cols = [{title:'Month',key:'invoice_month'},{title:'Invoices',key:'count'},{title:'Total Amount',key:'total'},{title:'Paid Amount',key:'paid'}];
  exportToPDF(_reportsData?.monthly_report||[], cols, `Monthly_Report_${new Date().toISOString().slice(0,10)}`, 'Monthly Collection Report');
}
