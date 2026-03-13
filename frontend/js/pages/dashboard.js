async function loadDashboard() {
  try {
    const stats = await InvoicesAPI.dashboard();
    renderDashboard(stats);
  } catch (err) {
    document.getElementById('page-content').innerHTML =
      `<div class="alert alert-error" style="margin:60px;">
        <span class="material-icons">error</span>
        <div>
          <strong>Failed to load dashboard!</strong><br/>
          <small>${err.message}</small>
        </div>
      </div>`;
  }
}

function renderDashboard(s) {
  const statusColor = {
    draft: '#94a3b8', sent: '#3b82f6', paid: '#10b981',
    overdue: '#ef4444', cancelled: '#b91c1c'
  };

  // Top stats
  let topStats = `<div class="stat-grid">`;
  [
    { label: 'Total Schools', value: s.total_schools, icon: 'school', color: '#00008B', bg: '#eff6ff' },
    { label: 'Total Invoices', value: s.total_invoices, icon: 'receipt_long', color: '#FF6D00', bg: '#fff7ed' },
    { label: 'Total Payments', value: s.total_payments, icon: 'payments', color: '#10b981', bg: '#ecfdf5' },
    { label: 'Total Revenue', value: fmtCurr(s.total_revenue), icon: 'trending_up', color: '#8b5cf6', bg: '#f5f3ff' },
  ].forEach(c => {
    topStats += `<div class="stat-card">
      <div class="stat-icon-wrap" style="background:${c.bg}; color:${c.color};">
        <span class="material-icons">${c.icon}</span>
      </div>
      <div class="stat-info">
        <div class="stat-value">${c.value}</div>
        <div class="stat-label">${c.label}</div>
      </div>
    </div>`;
  });
  topStats += `</div>`;

  // FY stats
  const fyStats = `<div class="card">
    <div class="card-title"><span class="material-icons" style="color:var(--primary)">calendar_today</span> Financial Year — ${s.fy_str}</div>
    <div class="fy-stat-row">
      <div class="fy-stat">
        <div class="fy-val" style="color:var(--primary);">${fmtCurr(s.fy_revenue)}</div>
        <div class="fy-lbl">FY Total Revenue</div>
      </div>
      <div class="fy-stat">
        <div class="fy-val" style="color:var(--success);">${fmtCurr(s.fy_paid)}</div>
        <div class="fy-lbl">FY Paid Amount</div>
      </div>
      <div class="fy-stat">
        <div class="fy-val" style="color:var(--secondary);">${fmtCurr(s.fy_revenue - s.fy_paid)}</div>
        <div class="fy-lbl">FY Pending</div>
      </div>
    </div>
  </div>`;

  // Monthly chart
  const chartCard = `<div class="card">
    <div class="card-title"><span class="material-icons" style="color:var(--primary)">bar_chart</span> Monthly Revenue (Last 12 Months)</div>
    <div class="chart-container" id="monthly-chart"></div>
  </div>`;

  // Status breakdown
  let statusCards = `<div class="card"><div class="card-title"><span class="material-icons" style="color:var(--primary)">pie_chart</span> Invoice Status Breakdown</div>
    <div class="status-breakdown">`;
  (s.status_data || []).forEach(st => {
    statusCards += `<div class="status-card" style="border-top:4px solid ${statusColor[st.status]};">
      <div style="margin-bottom:8px;">${tag(st.status.toUpperCase(), statusTagClass[st.status] || 'tag-grey')}</div>
      <div class="status-count">${st.count}</div>
      <div class="status-amount">${fmtCurr(st.amount)}</div>
    </div>`;
  });
  statusCards += `</div></div>`;

  document.getElementById('page-content').innerHTML =
    `<div>
       <div class="page-header">
         <div>
           <div class="page-title">Dashboard Overview</div>
           <div class="page-subtitle">
             <span style="opacity:0.7">${new Date().getHours() < 12 ? 'Good Morning' : (new Date().getHours() < 17 ? 'Good Afternoon' : 'Good Evening')},</span> 
             <strong>${userInfo.full_name}</strong>
           </div>
         </div>
       </div>
       ${topStats}${fyStats}${chartCard}${statusCards}
     </div>`;

  // Draw chart after DOM ready
  requestAnimationFrame(() => {
    drawBarChart('monthly-chart', s.monthly_data || [], 'month', 'revenue', '#00008B');
  });
}
