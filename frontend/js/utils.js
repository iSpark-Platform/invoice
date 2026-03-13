// ═══ Toast Notifications ══════════════════════════════════
function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  const icon = type === 'success' ? 'check_circle' : 'error';
  el.innerHTML = `<span class="material-icons">${icon}</span> <span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

// ═══ Modal ════════════════════════════════════════════════
function openModal({ title, body, footer, wide = false, narrow = false }) {
  document.getElementById('modal-title').innerHTML = title;
  document.getElementById('modal-body').innerHTML  = body;
  document.getElementById('modal-footer').innerHTML = footer || '';
  
  const box = document.getElementById('modal-box');
  box.style.maxWidth = wide ? '900px' : (narrow ? '400px' : '600px');
  
  document.getElementById('global-modal').style.display = 'flex';
}

function closeModal(e) {
  if (!e || e.target === document.getElementById('global-modal')) {
    document.getElementById('global-modal').style.display = 'none';
  }
}

// ═══ Confirm Dialog ═══════════════════════════════════════
function confirmDialog(msg, onOk) {
  openModal({
    title: 'Confirm Action',
    body: `
      <div style="text-align:center; padding:20px;">
        <span class="material-icons" style="font-size:48px; color:var(--danger); margin-bottom:16px;">help_outline</span>
        <p style="font-size:16px; color:var(--text-main); font-weight:500;">${msg}</p>
        <p style="font-size:13px; color:var(--text-muted); margin-top:8px;">This action cannot be undone.</p>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" id="confirm-ok-btn">Confirm & Proceed</button>
    `,
    narrow: true,
  });
  document.getElementById('confirm-ok-btn').onclick = () => { closeModal(); onOk(); };
}

// ═══ Data Safety Helpers ══════════════════════════════════
function ensureArray(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && Array.isArray(data.data)) return data.data;
  console.warn('API returned non-array data where array was expected:', data);
  return [];
}

// ═══ Table Builder ════════════════════════════════════════
function buildTable(columns, rows, emptyMsg = 'No data available') {
  if (!rows || rows.length === 0) {
    return `
      <div style="text-align:center; padding:60px 20px; color:var(--text-muted);">
        <span class="material-icons" style="font-size:48px; opacity:0.3; margin-bottom:16px;">folder_open</span>
        <div style="font-size:15px; font-weight:500;">${emptyMsg}</div>
      </div>`;
  }
  let html = `<table class="data-table"><thead><tr>`;
  columns.forEach(c => { html += `<th>${c.title}</th>`; });
  html += `</tr></thead><tbody>`;
  rows.forEach((row, i) => {
    html += '<tr>';
    columns.forEach(c => {
      const val = c.render ? c.render(row[c.key], row, i) : (row[c.key] ?? '');
      html += `<td>${val}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  return html;
}

// ═══ Tag Helper ═══════════════════════════════════════════
function tag(text, cls) { return `<span class="tag ${cls}">${text}</span>`; }

const statusTagClass = {
  draft: 'tag-grey', sent: 'tag-blue', paid: 'tag-green',
  overdue: 'tag-red', cancelled: 'tag-red',
};
const statusTag = (s) => tag(s.toUpperCase(), statusTagClass[s] || 'tag-grey');

// ═══ Currency & Numbers ═══════════════════════════════════
function fmtCurr(n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }); }
function fmtNum(n)  { return Number(n || 0).toLocaleString('en-IN'); }

// ═══ Date & Labels ════════════════════════════════════════
function monthLabel(m) {
  if (!m) return '-';
  const d = new Date(m + '-01');
  return d.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
}

function fyTag(fy) {
  if (!fy) return '-';
  return `<span class="tag" style="background:#f1f5f9; color:#475569; border:1px solid #e2e8f0; font-weight:700;">FY ${fy.slice(0,2)}-${fy.slice(2)}</span>`;
}

function fyOptions() {
  const currentYear = new Date().getFullYear();
  const startYear = 2024;
  let options = '';
  for (let y = startYear; y <= currentYear + 1; y++) {
    const fyCode = String(y).slice(-2) + String(y+1).slice(-2);
    const label = `FY ${y}-${String(y+1).slice(-2)}`;
    options += `<option value="${fyCode}">${label}</option>`;
  }
  return options;
}

// ═══ Export ═══════════════════════════════════════════════
function exportToExcel(data, columns, filename) {
  if (typeof XLSX === 'undefined') { 
    toast('Excel library not loaded. Please wait or refresh.', 'error');
    console.error('XLSX library missing');
    return; 
  }
  
  if (!data || data.length === 0) {
    toast('No data available to export.', 'error');
    return;
  }

  try {
    toast('Preparing Excel download...', 'success');
    const headers = columns.map(c => c.title);
    
    // Ensure all data is treated as strings to avoid processing errors
    const rows = data.map(row => columns.map(c => {
      const val = row[c.key];
      return (val === null || val === undefined) ? '' : String(val).trim();
    }));
    
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    
    // Using array buffer for blob creation
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.xlsx`;
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);

    toast('Excel file generated!', 'success');
  } catch (err) {
    console.error('Excel Export Error:', err);
    toast('Excel Error: ' + err.message, 'error');
  }
}

function exportToPDF(data, columns, filename, title) {
  const headers = columns.map(c => c.title);
  const rows = data.map(row => columns.map(c => row[c.key] ?? ''));
  const html = `
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: 'Outfit', sans-serif; padding: 40px; color: #1e293b; }
          h1 { color: #1640ff; margin-bottom: 8px; }
          p { color: #64748b; margin-bottom: 24px; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #f8fafc; text-align: left; padding: 12px; border-bottom: 2px solid #e2e8f0; font-size: 12px; text-transform: uppercase; color: #64748b; }
          td { padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
          .footer { margin-top: 40px; font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <p>Report Generated on: ${new Date().toLocaleDateString('en-IN')}</p>
        <table>
          <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
        <div class="footer">iSpark Learning Solutions — Generated via Invoice Management System</div>
      </body>
    </html>
  `;
  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.onload = () => {
    win.print();
    // Optional: win.close();
  };
}

// ═══ SVG Charts ═══════════════════════════════════════════
function drawBarChart(containerId, data, xKey, yKey, color = '#1640ff') {
  const el = document.getElementById(containerId);
  if (!el || !data.length) return;

  const W = el.offsetWidth, H = el.offsetHeight || 300;
  const margin = { top: 20, right: 20, bottom: 50, left: 60 };
  const innerW = W - margin.left - margin.right;
  const innerH = H - margin.top - margin.bottom;

  const maxVal = Math.max(...data.map(d => d[yKey]), 1);
  const barW   = (innerW / data.length) * 0.7;

  let svg = `<svg width="100%" height="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">`;
  svg += `<g transform="translate(${margin.left},${margin.top})">`;

  // Horizontal Grid
  for (let i = 0; i <= 4; i++) {
    const y = innerH - (i / 4) * innerH;
    const val = (maxVal * i / 4);
    svg += `<line x1="0" y1="${y}" x2="${innerW}" y2="${y}" stroke="var(--border-color)" stroke-dasharray="4"/>`;
    svg += `<text x="-10" y="${y+4}" text-anchor="end" font-size="11" fill="var(--text-muted)">${val>=1000 ? (val/1000).toFixed(0)+'K' : val.toFixed(0)}</text>`;
  }

  // Bars
  data.forEach((d, i) => {
    const x = i * (innerW / data.length) + (innerW / data.length - barW) / 2;
    const barH = (d[yKey] / maxVal) * innerH;
    svg += `<rect x="${x}" y="${innerH - barH}" width="${barW}" height="${barH}" fill="${color}" rx="4">
      <title>${d[xKey]}: ${fmtCurr(d[yKey])}</title>
    </rect>`;
    svg += `<text x="${x + barW/2}" y="${innerH + 20}" text-anchor="middle" font-size="11" fill="var(--text-muted)">${d[xKey].slice(0,3)}</text>`;
  });

  svg += `</g></svg>`;
  el.innerHTML = svg;
}
