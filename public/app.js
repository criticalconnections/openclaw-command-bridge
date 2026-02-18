// Command Bridge - Frontend
// Auto-configures based on detected OpenClaw features

let jobs = [];
let expandedJobs = new Set();
let currentPage = 'home';
let sessionFilter = 'all';
let sidebarCollapsed = false;
let currentFilePath = '/';
let selectedFilePath = null;
let appFeatures = {};

// ====== API HELPERS ======
async function api(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  
  if (body) {
    opts.body = JSON.stringify(body);
  }
  
  const res = await fetch('/api' + path, opts);
  return res.json();
}

function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + type;
  setTimeout(() => el.className = 'toast', 3000);
}

// ====== TIME FORMATTING ======
function timeAgo(ms) {
  if (!ms) return '—';
  const diff = Date.now() - ms;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  return Math.floor(diff / 86400000) + 'd ago';
}

function timeUntil(ms) {
  if (!ms) return '—';
  const diff = ms - Date.now();
  if (diff < 0) return 'overdue';
  if (diff < 60000) return 'in <1m';
  if (diff < 3600000) return 'in ' + Math.floor(diff / 60000) + 'm';
  if (diff < 86400000) return 'in ' + Math.floor(diff / 3600000) + 'h';
  return 'in ' + Math.floor(diff / 86400000) + 'd';
}

function formatDate(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleString();
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function humanCron(expr) {
  if (!expr) return '';
  const parts = expr.split(' ');
  if (parts.length !== 5) return expr;
  const [min, hr, dom, mon, dow] = parts;
  if (dom === '*' && mon === '*' && dow === '*') {
    if (hr === '*' && min === '*') return 'Every minute';
    if (hr === '*') return `Every hour at :${min.padStart(2,'0')}`;
    return `Daily at ${hr}:${min.padStart(2,'0')}`;
  }
  return expr;
}

function scheduleText(sched) {
  if (!sched) return '—';
  if (sched.kind === 'cron') return humanCron(sched.expr) + (sched.tz ? ` (${sched.tz})` : '');
  if (sched.kind === 'every') return `Every ${sched.interval}`;
  if (sched.kind === 'at') return `Once at ${formatDate(new Date(sched.at).getTime())}`;
  return JSON.stringify(sched);
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ====== INITIALIZATION ======
async function init() {
  // Load feature config
  try {
    const config = await api('/config');
    appFeatures = config.features || {};
    
    // Show/hide nav items based on features
    if (appFeatures.projects) {
      document.getElementById('navProjects').style.display = '';
      document.getElementById('filesProjPin').style.display = '';
    }
    
    console.log('[Command Bridge] Features:', appFeatures);
  } catch (e) {
    console.error('Failed to load features:', e);
  }
  
  // Check gateway status
  updateGatewayStatus();
  setInterval(updateGatewayStatus, 30000);
  
  // Update clock
  updateClock();
  setInterval(updateClock, 1000);
  
  // Load home page
  loadPageData('home');
}

async function updateGatewayStatus() {
  try {
    const data = await api('/services');
    const statusEl = document.getElementById('gatewayStatus');
    const textEl = document.getElementById('gatewayText');
    
    if (data.gateway) {
      statusEl.className = 'status-pill online';
      textEl.textContent = 'Gateway Online';
    } else {
      statusEl.className = 'status-pill offline';
      textEl.textContent = 'Gateway Offline';
    }
  } catch (e) {
    const statusEl = document.getElementById('gatewayStatus');
    const textEl = document.getElementById('gatewayText');
    statusEl.className = 'status-pill offline';
    textEl.textContent = 'Offline';
  }
}

function updateClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { 
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  document.getElementById('currentTime').textContent = timeStr;
}

// ====== NAVIGATION ======
function switchPage(pageName) {
  currentPage = pageName;
  
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.dataset.page === pageName) item.classList.add('active');
    else item.classList.remove('active');
  });
  
  document.querySelectorAll('.page').forEach(page => {
    if (page.id === `page-${pageName}`) page.classList.add('active');
    else page.classList.remove('active');
  });
  
  const iconMap = {
    home: 'home', cron: 'schedule', services: 'dns', sessions: 'forum',
    memory: 'psychology', files: 'folder', projects: 'folder_open',
    config: 'settings', integrations: 'extension',
  };
  
  const nameMap = {
    home: 'Home', cron: 'Cron Jobs', services: 'Services', sessions: 'Sessions',
    memory: 'Memory', files: 'Files', projects: 'Projects',
    config: 'Config', integrations: 'Integrations',
  };
  
  document.getElementById('pageTitleIcon').textContent = iconMap[pageName] || 'description';
  document.getElementById('pageTitleText').textContent = nameMap[pageName] || pageName;
  
  loadPageData(pageName);
  closeMobileMenu();
}

document.getElementById('sidebarToggle').addEventListener('click', () => {
  sidebarCollapsed = !sidebarCollapsed;
  const sidebar = document.getElementById('sidebar');
  if (sidebarCollapsed) {
    sidebar.classList.add('collapsed');
  } else {
    sidebar.classList.remove('collapsed');
  }
});

document.getElementById('mobileMenuBtn').addEventListener('click', () => {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('mobileOverlay');
  sidebar.classList.add('mobile-open');
  overlay.classList.add('active');
});

document.getElementById('mobileOverlay').addEventListener('click', closeMobileMenu);

function closeMobileMenu() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('mobileOverlay');
  sidebar.classList.remove('mobile-open');
  overlay.classList.remove('active');
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => switchPage(item.dataset.page));
});

// ====== PAGE LOADING ======
async function loadPageData(pageName) {
  switch (pageName) {
    case 'home': await loadHome(); break;
    case 'cron': await loadCronJobs(); break;
    case 'services': await loadServices(); break;
    case 'sessions': await loadSessions(); break;
    case 'memory': await loadMemory(); break;
    case 'files': await loadFiles('/'); break;
    case 'projects': await loadProjects(); break;
    case 'config': await loadConfig(); break;
    case 'integrations': await loadIntegrations(); break;
  }
}

// ====== HOME PAGE ======
async function loadHome() {
  await Promise.all([loadWelcomeHeader(), loadHomeStats()]);
}

async function loadWelcomeHeader() {
  const el = document.getElementById('welcomeHeader');
  
  try {
    const date = new Date();
    const hour = date.getHours();
    
    let greeting = 'Good morning';
    if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
    else if (hour >= 17) greeting = 'Good evening';
    
    const dateStr = date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    el.innerHTML = `
      <div class="welcome-content">
        <h2>${greeting}</h2>
        <div class="welcome-meta">
          <div class="welcome-date"><span class="material-icons-outlined" style="font-size:16px;vertical-align:middle">event</span> ${dateStr}</div>
        </div>
      </div>
    `;
  } catch (e) {
    el.innerHTML = `<div class="welcome-content"><h2>Welcome</h2></div>`;
  }
}

async function loadHomeStats() {
  try {
    const stats = await api('/home/stats');
    
    // Projects
    const projEl = document.querySelector('#statProjects .stat-value');
    if (stats.projects) {
      projEl.textContent = `${stats.projects.count} projects`;
    } else {
      projEl.textContent = '—';
    }
    
    // Cron
    const cronEl = document.querySelector('#statCron .stat-value');
    if (stats.cron && !stats.cron.error) {
      cronEl.innerHTML = `${stats.cron.active} active${stats.cron.lastRun ? '<br><small>' + timeAgo(stats.cron.lastRun) + '</small>' : ''}`;
    } else {
      cronEl.textContent = '—';
    }
    
    // Sessions
    const sessEl = document.querySelector('#statSessions .stat-value');
    if (stats.sessions && !stats.sessions.error) {
      sessEl.textContent = `${stats.sessions.active} active`;
    } else {
      sessEl.textContent = '—';
    }
    
    // System
    const sysEl = document.querySelector('#statSystem .stat-value');
    if (stats.system) {
      sysEl.innerHTML = `CPU ${stats.system.cpuLoad}<br><small>RAM ${stats.system.memPercent}%</small>`;
    } else {
      sysEl.textContent = '—';
    }
  } catch (e) {
    console.error('Failed to load stats:', e);
  }
}

// ====== CRON JOBS ======
function renderJobs() {
  const list = document.getElementById('jobList');
  const count = document.getElementById('jobCount');
  count.textContent = `${jobs.length} Job${jobs.length !== 1 ? 's' : ''}`;

  if (jobs.length === 0) {
    list.innerHTML = '<div class="empty"><div class="empty-icon">📋</div><p>No cron jobs yet</p></div>';
    return;
  }

  list.innerHTML = jobs.map(j => {
    const expanded = expandedJobs.has(j.id);
    const statusBadge = !j.enabled
      ? '<span class="badge badge-disabled">disabled</span>'
      : j.state?.lastStatus === 'ok'
        ? '<span class="badge badge-ok">ok</span>'
        : j.state?.lastStatus === 'error'
          ? '<span class="badge badge-error">error</span>'
          : '<span class="badge badge-ok">ready</span>';

    return `
      <div class="job-card">
        <div class="job-header">
          <div>
            <div style="display:flex;align-items:center;gap:8px">
              <span class="job-name">${esc(j.name)}</span>
              ${statusBadge}
            </div>
            <div class="job-schedule">${esc(scheduleText(j.schedule))}</div>
          </div>
          <div class="job-actions">
            <label class="toggle" title="${j.enabled ? 'Disable' : 'Enable'}">
              <input type="checkbox" ${j.enabled ? 'checked' : ''} onchange="toggleJob('${j.id}', this.checked)">
              <span class="toggle-slider"></span>
            </label>
            <button class="btn btn-secondary btn-sm" onclick="runJob('${j.id}')">▶ Run</button>
            <button class="btn btn-secondary btn-sm" onclick="toggleDetails('${j.id}')">${expanded ? '▲' : '▼'}</button>
          </div>
        </div>
        <div class="job-meta">
          <div class="job-meta-item">Last run: <strong>${timeAgo(j.state?.lastRunAtMs)}</strong></div>
          <div class="job-meta-item">Next run: <strong>${timeUntil(j.state?.nextRunAtMs)}</strong></div>
          <div class="job-meta-item">Session: <strong>${j.sessionTarget || '—'}</strong></div>
          ${j.state?.lastDurationMs ? `<div class="job-meta-item">Duration: <strong>${(j.state.lastDurationMs/1000).toFixed(1)}s</strong></div>` : ''}
        </div>
        <div class="job-details ${expanded ? 'open' : ''}" id="details-${j.id}">
          <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
            <button class="btn btn-secondary btn-sm" onclick="loadHistory('${j.id}')">📜 Load History</button>
            <button class="btn btn-secondary btn-sm" onclick="showEditSchedule('${j.id}')">✏️ Edit Schedule</button>
            <button class="btn btn-danger btn-sm" onclick="deleteJob('${j.id}')">🗑 Delete</button>
          </div>
          <div id="edit-${j.id}"></div>
          <div id="history-${j.id}"></div>
          <h4 style="font-size:12px;color:var(--md-on-surface-variant);margin-top:12px">Configuration</h4>
          <div class="config-block">${esc(JSON.stringify(j, null, 2))}</div>
        </div>
      </div>`;
  }).join('');
}

async function toggleJob(id, enabled) {
  const action = enabled ? 'enable' : 'disable';
  const res = await api(`/jobs/${id}/${action}`, 'POST');
  if (res.ok) { toast(`Job ${action}d`); loadCronJobs(); }
  else toast(res.error || 'Failed', 'error');
}

async function runJob(id) {
  toast('Running job...');
  const res = await api(`/jobs/${id}/run`, 'POST');
  if (res.ok) toast('Job triggered');
  else toast(res.error || 'Failed', 'error');
}

async function deleteJob(id) {
  if (!confirm('Delete this job?')) return;
  const res = await api(`/jobs/${id}`, 'DELETE');
  if (res.ok) { toast('Job deleted'); loadCronJobs(); }
  else toast(res.error || 'Failed', 'error');
}

function toggleDetails(id) {
  if (expandedJobs.has(id)) expandedJobs.delete(id);
  else expandedJobs.add(id);
  renderJobs();
}

async function loadHistory(id) {
  const el = document.getElementById('history-' + id);
  el.innerHTML = '<span class="spinner"></span> Loading...';
  const res = await api(`/jobs/${id}/runs`);
  if (res.raw) {
    el.innerHTML = `<div class="config-block">${esc(res.raw)}</div>`;
  } else if (res.runs && res.runs.length) {
    el.innerHTML = `<table class="history-table"><thead><tr><th>Time</th><th>Status</th><th>Duration</th></tr></thead><tbody>${
      res.runs.slice(0, 20).map(r => `<tr><td>${formatDate(r.startedAtMs || r.ts)}</td><td><span class="badge badge-${r.status === 'ok' ? 'ok' : 'error'}">${r.status}</span></td><td>${r.durationMs ? (r.durationMs/1000).toFixed(1)+'s' : '—'}</td></tr>`).join('')
    }</tbody></table>`;
  } else {
    el.innerHTML = `<div class="config-block">${esc(JSON.stringify(res, null, 2))}</div>`;
  }
}

function showEditSchedule(id) {
  const job = jobs.find(j => j.id === id);
  const el = document.getElementById('edit-' + id);
  const val = job.schedule?.expr || job.schedule?.interval || job.schedule?.at || '';
  el.innerHTML = `<div class="edit-row">
    <select id="editKind-${id}" style="width:100px;padding:6px;background:var(--md-surface-container-high);border:1px solid var(--md-outline-variant);border-radius:6px;color:var(--md-on-surface);font-size:13px">
      <option value="cron" ${job.schedule?.kind==='cron'?'selected':''}>Cron</option>
      <option value="every" ${job.schedule?.kind==='every'?'selected':''}>Interval</option>
      <option value="at" ${job.schedule?.kind==='at'?'selected':''}>One-shot</option>
    </select>
    <input id="editVal-${id}" value="${esc(val)}" placeholder="Schedule value" style="flex:1;padding:6px;background:var(--md-surface-container-high);border:1px solid var(--md-outline-variant);border-radius:6px;color:var(--md-on-surface);font-size:13px">
    <button class="btn btn-primary btn-sm" onclick="saveSchedule('${id}')">Save</button>
    <button class="btn btn-secondary btn-sm" onclick="document.getElementById('edit-${id}').innerHTML=''">Cancel</button>
  </div>`;
}

async function saveSchedule(id) {
  const kind = document.getElementById('editKind-' + id).value;
  const val = document.getElementById('editVal-' + id).value;
  const res = await api(`/jobs/${id}`, 'PATCH', { scheduleKind: kind, scheduleValue: val });
  if (res.ok) { toast('Schedule updated'); loadCronJobs(); }
  else toast(res.error || 'Failed', 'error');
}

function openCreateModal() { document.getElementById('createModal').classList.add('open'); }
function closeCreateModal() { document.getElementById('createModal').classList.remove('open'); }

async function createJob() {
  const body = {
    name: document.getElementById('newName').value,
    scheduleKind: document.getElementById('newSchedKind').value,
    scheduleValue: document.getElementById('newSchedValue').value,
    tz: document.getElementById('newTz').value,
    sessionTarget: document.getElementById('newSession').value,
    payloadKind: document.getElementById('newPayloadKind').value,
    payloadText: document.getElementById('newPayloadText').value,
    enabled: document.getElementById('newEnabled').checked,
  };
  if (!body.name || !body.scheduleValue || !body.payloadText) {
    toast('Fill in all required fields', 'error'); return;
  }
  const res = await api('/jobs', 'POST', body);
  if (res.ok) {
    toast('Job created!');
    closeCreateModal();
    ['newName','newSchedValue','newPayloadText'].forEach(id => document.getElementById(id).value = '');
    loadCronJobs();
  } else toast(res.error || 'Failed', 'error');
}

async function loadCronJobs() {
  const bar = document.getElementById('refreshBar');
  bar.className = 'refresh-bar loading';
  try {
    const res = await api('/jobs');
    if (res.jobs) jobs = res.jobs;
    else if (Array.isArray(res)) jobs = res;
    renderJobs();
  } catch (e) {
    toast('Failed to load jobs', 'error');
  }
  bar.className = 'refresh-bar done';
  setTimeout(() => bar.className = 'refresh-bar', 300);
}

// ====== SERVICES ======
async function loadServices() {
  const el = document.getElementById('servicesContent');
  el.innerHTML = '<div class="spinner" style="margin:40px auto"></div>';
  
  try {
    const data = await api('/services');
    
    let html = '<div class="stats-grid">';
    
    html += `<div class="stat-card">
      <h3>Gateway</h3>
      <div class="stat-row"><span>Address</span><span>${esc(data.gateway?.address || '—')}</span></div>
      <div class="stat-row"><span>Uptime</span><span>${formatUptime(data.gateway?.uptime || 0)}</span></div>
      <div class="stat-row"><span>Version</span><span>${esc(data.gateway?.version || '—')}</span></div>
    </div>`;
    
    html += `<div class="stat-card">
      <h3>System Resources</h3>
      <div class="stat-row"><span>CPU Load (1/5/15m)</span><span>${data.system?.loadAvg1 || '?'} / ${data.system?.loadAvg5 || '?'} / ${data.system?.loadAvg15 || '?'}</span></div>
      <div class="stat-row"><span>Memory</span><span>${data.system?.usedMem || '?'} / ${data.system?.totalMem || '?'} (${data.system?.memPercent || '?'}%)</span></div>
      <div class="stat-row"><span>Disk</span><span>${data.system?.diskUsed || '?'} / ${data.system?.diskTotal || '?'}</span></div>
      <div class="stat-row"><span>Uptime</span><span>${formatUptime(data.system?.uptime || 0)}</span></div>
    </div>`;
    
    html += '</div>';
    
    html += '<h3 style="margin-top:24px;margin-bottom:12px">Channels</h3>';
    html += '<div class="stats-grid">';
    if (data.channels && data.channels.length > 0) {
      data.channels.forEach(ch => {
        const status = ch.state === 'OK' || ch.state === 'ok' ? 'ok' : 'error';
        html += `<div class="stat-card">
          <h3>${ch.channel || '?'} <span class="badge badge-${status}">${ch.state || '?'}</span></h3>
          <div class="stat-row"><span>Detail</span><span>${esc(ch.detail || '—')}</span></div>
        </div>`;
      });
    } else {
      html += '<div class="stat-card"><p>No channels found</p></div>';
    }
    html += '</div>';
    
    html += '<h3 style="margin-top:24px;margin-bottom:12px">Paired Nodes</h3>';
    html += '<div class="stats-grid">';
    if (data.nodes && data.nodes.length > 0) {
      data.nodes.forEach(node => {
        html += `<div class="stat-card">
          <h3>${esc(node.displayName || 'Unknown')} <span class="badge badge-${node.connected ? 'ok' : 'disabled'}">${node.connected ? 'connected' : 'offline'}</span></h3>
          <div class="stat-row"><span>Platform</span><span>${esc(node.platform || '?')}</span></div>
          <div class="stat-row"><span>IP</span><span>${esc(node.remoteIp || '?')}</span></div>
        </div>`;
      });
    } else {
      html += '<div class="stat-card"><p>No nodes paired</p></div>';
    }
    html += '</div>';
    
    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><p>${esc(e.message)}</p></div>`;
  }
}

// ====== SESSIONS ======
function filterSessions(filter) {
  sessionFilter = filter;
  loadSessions();
}

async function loadSessions() {
  const el = document.getElementById('sessionsContent');
  el.innerHTML = '<div class="spinner" style="margin:40px auto"></div>';
  
  try {
    const query = sessionFilter === 'all' ? '' : `?kind=${sessionFilter}`;
    const data = await api('/sessions' + query);
    
    if (!data.sessions || data.sessions.length === 0) {
      el.innerHTML = '<div class="empty"><div class="empty-icon">📊</div><p>No sessions found</p></div>';
      return;
    }
    
    let html = '<div class="sessions-list">';
    data.sessions.forEach(s => {
      const tokenPercent = s.contextTokens ? ((s.totalTokens || 0) / s.contextTokens * 100).toFixed(0) : 0;
      const kind = s.key.includes(':cron:') ? 'cron' : s.key.includes(':subagent:') ? 'subagent' : s.kind || 'direct';
      
      html += `<div class="stat-card">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
          <div>
            <div class="job-name" style="font-size:12px">${esc(s.key)}</div>
            <div class="job-schedule">Model: ${esc(s.model || '?')}</div>
          </div>
          <span class="badge badge-ok">${kind}</span>
        </div>
        <div class="stat-row"><span>Age</span><span>${timeAgo(s.updatedAt)}</span></div>
        <div class="stat-row"><span>Tokens</span><span>${(s.totalTokens || 0).toLocaleString()} / ${(s.contextTokens || 0).toLocaleString()} (${tokenPercent}%)</span></div>
      </div>`;
    });
    html += '</div>';
    
    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><p>${esc(e.message)}</p></div>`;
  }
}

// ====== MEMORY ======
async function searchMemory() {
  const query = document.getElementById('memorySearch').value;
  if (!query) {
    loadMemory();
    return;
  }
  
  const el = document.getElementById('memoryContent');
  el.innerHTML = '<div class="spinner" style="margin:40px auto"></div>';
  
  try {
    const data = await api('/memory/search?q=' + encodeURIComponent(query));
    
    if (!data.results || data.results.length === 0) {
      el.innerHTML = '<div class="empty"><div class="empty-icon">🔍</div><p>No matches found</p></div>';
      return;
    }
    
    let html = '<div class="memory-list">';
    data.results.forEach(r => {
      html += `<div class="stat-card" onclick="viewMemoryFile('${r.path}')">
        <div class="job-name">${esc(r.file)}</div>
        <div style="margin-top:8px">`;
      r.matches.forEach(m => {
        html += `<div class="job-schedule" style="margin-bottom:4px">Line ${m.lineNumber}: ${esc(m.line.substring(0, 100))}</div>`;
      });
      html += `</div></div>`;
    });
    html += '</div>';
    
    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><p>${esc(e.message)}</p></div>`;
  }
}

async function loadMemory() {
  const el = document.getElementById('memoryContent');
  el.innerHTML = '<div class="spinner" style="margin:40px auto"></div>';
  
  try {
    const data = await api('/memory');
    
    if (!data.files || data.files.length === 0) {
      el.innerHTML = '<div class="empty"><div class="empty-icon">🧠</div><p>No memory files</p></div>';
      return;
    }
    
    let html = '<div class="memory-list">';
    data.files.forEach(f => {
      html += `<div class="stat-card" onclick="viewMemoryFile('${f.path}')">
        <div class="job-name">${esc(f.name)} ${f.isRoot ? '<span class="badge badge-ok">root</span>' : ''}</div>
        <div class="stat-row"><span>Size</span><span>${(f.size / 1024).toFixed(1)} KB</span></div>
        <div class="stat-row"><span>Modified</span><span>${timeAgo(new Date(f.modified).getTime())}</span></div>
      </div>`;
    });
    html += '</div>';
    
    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><p>${esc(e.message)}</p></div>`;
  }
}

async function viewMemoryFile(path) {
  const el = document.getElementById('memoryViewer');
  el.style.display = 'block';
  el.innerHTML = '<div class="spinner" style="margin:40px auto"></div>';
  
  try {
    const data = await api('/memory/' + path);
    el.innerHTML = `
      <div class="memory-viewer-header">
        <h3>${esc(path)}</h3>
        <button class="btn btn-secondary btn-sm" onclick="closeMemoryViewer()">Close</button>
      </div>
      <div class="config-block" style="white-space:pre-wrap;max-height:600px;overflow-y:auto">${esc(data.content)}</div>
    `;
  } catch (e) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><p>${esc(e.message)}</p></div>`;
  }
}

function closeMemoryViewer() {
  document.getElementById('memoryViewer').style.display = 'none';
}

// ====== FILES ======
async function loadFiles(path) {
  currentFilePath = path;
  const el = document.getElementById('fileList');
  el.innerHTML = '<div class="spinner" style="margin:40px auto"></div>';
  
  try {
    const data = await api('/files?path=' + encodeURIComponent(path));
    
    // Update breadcrumb
    const breadcrumb = document.getElementById('fileBreadcrumb');
    const parts = data.currentPath.split('/').filter(Boolean);
    let breadcrumbHtml = '<span class="breadcrumb-item" onclick="navigateToPath(\'/\')">workspace</span>';
    let currentPath = '';
    parts.forEach((part, idx) => {
      currentPath += '/' + part;
      const pathCopy = currentPath;
      breadcrumbHtml += `<span class="breadcrumb-sep"></span><span class="breadcrumb-item" onclick="navigateToPath('${pathCopy}')">${esc(part)}</span>`;
    });
    breadcrumb.innerHTML = breadcrumbHtml;
    
    // Render files
    if (!data.files || data.files.length === 0) {
      el.innerHTML = '<div class="empty"><div class="empty-icon">📁</div><p>Empty directory</p></div>';
      return;
    }
    
    let html = '';
    data.files.forEach(f => {
      const selected = selectedFilePath === f.path ? 'selected' : '';
      html += `<div class="file-item ${selected}" onclick="selectFile('${f.path}', ${f.isDirectory})">
        <div class="file-name">
          <span class="file-icon">${f.icon}</span>
          <span class="file-name-text">${esc(f.name)}</span>
        </div>
        <div class="file-size">${f.sizeFormatted}</div>
        <div class="file-date">${timeAgo(new Date(f.modified).getTime())}</div>
      </div>`;
    });
    
    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><p>${esc(e.message)}</p></div>`;
  }
}

function navigateToPath(path) {
  loadFiles(path);
  closePreview();
}

async function selectFile(path, isDir) {
  selectedFilePath = path;
  
  // Re-render to show selection
  loadFiles(currentFilePath);
  
  if (isDir) {
    // Navigate into directory on double-click or wait for navigation
    navigateToPath(path);
  } else {
    // Preview file
    await previewFile(path);
  }
}

async function previewFile(path) {
  const panel = document.getElementById('filePreview');
  const content = document.getElementById('previewContent');
  const filename = document.getElementById('previewFileName');
  
  panel.style.display = 'block';
  filename.textContent = path.split('/').pop();
  content.innerHTML = '<div class="spinner" style="margin:40px auto"></div>';
  
  try {
    const data = await api('/files/read?path=' + encodeURIComponent(path));
    
    if (data.type === 'image') {
      content.innerHTML = `<img src="${data.content}" alt="${esc(data.name)}" style="max-width:100%">`;
    } else if (data.type === 'text') {
      if (data.extension === '.md') {
        // Render markdown
        content.innerHTML = marked.parse(data.content);
      } else {
        content.innerHTML = `<pre>${esc(data.content)}</pre>`;
      }
    } else {
      content.innerHTML = '<p>Cannot preview this file type</p>';
    }
  } catch (e) {
    content.innerHTML = `<p style="color:var(--md-error)">${esc(e.error || e.message)}</p>`;
  }
}

function closePreview() {
  document.getElementById('filePreview').style.display = 'none';
  selectedFilePath = null;
  // Re-render to clear selection
  loadFiles(currentFilePath);
}

// ====== PROJECTS (Generic) ======
async function loadProjects() {
  const el = document.getElementById('projectsContent');
  el.innerHTML = '<div class="spinner" style="margin:40px auto"></div>';
  
  try {
    const data = await api('/projects');
    
    if (!data.projects || data.projects.length === 0) {
      el.innerHTML = '<div class="empty"><div class="empty-icon">📁</div><p>No projects found</p></div>';
      return;
    }
    
    let html = '<div class="stats-grid">';
    data.projects.forEach(p => {
      html += `<div class="stat-card" onclick="navigateToPath('${p.path}'); switchPage('files')">
        <h3>${esc(p.name)}</h3>
        <p style="font-size:13px;color:var(--md-on-surface-variant);margin:8px 0">${esc(p.description)}</p>
        <div class="stat-row"><span>Last modified</span><span>${timeAgo(new Date(p.lastActivity).getTime())}</span></div>
      </div>`;
    });
    html += '</div>';
    
    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><p>${esc(e.message)}</p></div>`;
  }
}

// ====== CONFIG ======
async function loadConfig() {
  const el = document.getElementById('configContent');
  el.innerHTML = '<div class="spinner" style="margin:40px auto"></div>';
  
  try {
    const data = await api('/config');
    
    let html = '<div class="stats-grid">';
    
    html += `<div class="stat-card">
      <h3>System Info</h3>
      <div class="stat-row"><span>Hostname</span><span>${esc(data.system?.hostname || '?')}</span></div>
      <div class="stat-row"><span>Platform</span><span>${esc(data.system?.platform || '?')}</span></div>
      <div class="stat-row"><span>Architecture</span><span>${esc(data.system?.arch || '?')}</span></div>
      <div class="stat-row"><span>Node.js</span><span>${esc(data.system?.nodeVersion || '?')}</span></div>
      <div class="stat-row"><span>Memory</span><span>${esc(data.system?.totalMemory || '?')}</span></div>
      <div class="stat-row"><span>Uptime</span><span>${formatUptime(data.system?.uptime || 0)}</span></div>
    </div>`;
    
    html += `<div class="stat-card">
      <h3>Features</h3>`;
    Object.keys(data.features).forEach(key => {
      const status = data.features[key] ? 'ok' : 'disabled';
      html += `<div class="stat-row"><span>${esc(key)}</span><span class="badge badge-${status}">${data.features[key] ? 'enabled' : 'disabled'}</span></div>`;
    });
    html += `</div>`;
    
    html += '</div>';
    
    html += '<h3 style="margin-top:24px;margin-bottom:12px">Workspace</h3>';
    html += `<div class="config-block">${esc(data.workspace)}</div>`;
    
    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><p>${esc(e.message)}</p></div>`;
  }
}

// ====== INTEGRATIONS ======
async function loadIntegrations() {
  const el = document.getElementById('integrationsContent');
  el.innerHTML = '<div class="spinner" style="margin:40px auto"></div>';
  
  try {
    const data = await api('/integrations');
    
    if (!data.integrations || data.integrations.length === 0) {
      el.innerHTML = '<div class="empty"><div class="empty-icon">🔌</div><p>No integrations found</p></div>';
      return;
    }
    
    const categories = {
      communication: { title: 'Communication Channels', icon: '💬', items: [] },
      google: { title: 'Google Ecosystem', icon: '🔵', items: [] },
      ai: { title: 'AI / LLM', icon: '🤖', items: [] },
      search: { title: 'Search & Web', icon: '🔍', items: [] },
      nodes: { title: 'Node Connections', icon: '💻', items: [] },
    };
    
    data.integrations.forEach(int => {
      if (categories[int.category]) {
        categories[int.category].items.push(int);
      }
    });
    
    let html = '';
    
    Object.keys(categories).forEach(catKey => {
      const cat = categories[catKey];
      if (cat.items.length === 0) return;
      
      html += `<div class="integration-category">
        <h3 class="integration-category-title">${cat.icon} ${cat.title}</h3>
        <div class="integration-grid">`;
      
      cat.items.forEach(int => {
        const statusClass = int.status === 'connected' ? 'status-connected' : 
                           int.status === 'degraded' ? 'status-degraded' : 'status-disconnected';
        const statusText = int.status;
        const isEnabled = int.enabled !== false;
        const cardClass = isEnabled ? '' : 'integration-disabled';
        
        html += `<div class="integration-card ${cardClass}" data-id="${int.id}">
          <div class="integration-header">
            <div class="integration-icon">${int.icon}</div>
            <div class="integration-info">
              <div class="integration-name">${esc(int.name)}</div>
              <div class="integration-desc">${esc(int.description)}</div>
            </div>
          </div>
          <div class="integration-status">
            <span class="integration-status-badge ${statusClass}">${statusText}</span>
            <label class="toggle" title="${isEnabled ? 'Disable' : 'Enable'}">
              <input type="checkbox" ${isEnabled ? 'checked' : ''} onchange="toggleIntegration('${int.id}', this.checked)">
              <span class="toggle-slider"></span>
            </label>
          </div>
          <details class="integration-details">
            <summary>Details</summary>
            <div class="integration-details-content">`;
        
        Object.keys(int.details).forEach(key => {
          if (int.details[key]) {
            html += `<div class="stat-row">
              <span>${esc(key)}</span>
              <span>${esc(String(int.details[key]))}</span>
            </div>`;
          }
        });
        
        html += `</div></details></div>`;
      });
      
      html += `</div></div>`;
    });
    
    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><p>${esc(e.message)}</p></div>`;
  }
}

async function toggleIntegration(id, enabled) {
  try {
    const res = await api(`/integrations/${id}/toggle`, 'POST');
    if (res.ok) {
      toast(enabled ? `${id} enabled` : `${id} disabled`);
      const card = document.querySelector(`.integration-card[data-id="${id}"]`);
      if (card) {
        if (enabled) {
          card.classList.remove('integration-disabled');
        } else {
          card.classList.add('integration-disabled');
        }
      }
    } else {
      toast(res.error || 'Failed to toggle', 'error');
      loadIntegrations();
    }
  } catch (e) {
    toast('Failed to toggle: ' + e.message, 'error');
    loadIntegrations();
  }
}

// ====== STARTUP ======
document.addEventListener('DOMContentLoaded', init);
