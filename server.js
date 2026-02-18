const express = require('express');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const multer = require('multer');

const app = express();

// ====== CONFIGURATION ======
// Auto-detect OpenClaw gateway configuration
function detectOpenClawConfig() {
  const configPaths = [
    process.env.OPENCLAW_CONFIG_PATH,
    path.join(os.homedir(), '.openclaw/gateway.yaml'),
    path.join(os.homedir(), '.openclaw/openclaw.json'),
    '/root/.openclaw/gateway.yaml',
    '/root/.openclaw/openclaw.json',
  ].filter(Boolean);

  let config = {
    gatewayUrl: process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:18789',
    gatewayToken: process.env.OPENCLAW_GATEWAY_TOKEN || '',
    workspace: process.env.OPENCLAW_WORKSPACE || path.join(os.homedir(), '.openclaw/workspace'),
    port: process.env.PORT || 3333,
  };

  // Try to load gateway.yaml or openclaw.json
  for (const configPath of configPaths) {
    try {
      if (fs.existsSync(configPath)) {
        console.log(`[Config] Found config at: ${configPath}`);
        
        if (configPath.endsWith('.yaml')) {
          // Parse YAML manually (simple key: value pairs)
          const content = fs.readFileSync(configPath, 'utf8');
          const lines = content.split('\n');
          for (const line of lines) {
            if (line.includes('address:') || line.includes('url:')) {
              const match = line.match(/:\s*(.+)/);
              if (match) config.gatewayUrl = match[1].trim();
            }
            if (line.includes('token:')) {
              const match = line.match(/:\s*(.+)/);
              if (match && !config.gatewayToken) config.gatewayToken = match[1].trim();
            }
          }
        } else if (configPath.endsWith('.json')) {
          const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          if (data.gateway?.address) config.gatewayUrl = data.gateway.address;
          if (data.gateway?.token && !config.gatewayToken) config.gatewayToken = data.gateway.token;
          if (data.token && !config.gatewayToken) config.gatewayToken = data.token;
        }
      }
    } catch (e) {
      console.warn(`[Config] Failed to parse ${configPath}:`, e.message);
    }
  }

  // Validate workspace
  if (!fs.existsSync(config.workspace)) {
    console.warn(`[Config] Workspace not found at ${config.workspace}, using fallback`);
    config.workspace = process.cwd();
  }

  console.log(`[Config] Gateway URL: ${config.gatewayUrl}`);
  console.log(`[Config] Workspace: ${config.workspace}`);
  console.log(`[Config] Port: ${config.port}`);

  return config;
}

const CONFIG = detectOpenClawConfig();
const PORT = CONFIG.port;
const WORKSPACE = CONFIG.workspace;

// ====== FEATURE DETECTION ======
// Detect which features are available based on system configuration
function detectFeatures() {
  const features = {
    cron: true,
    sessions: true,
    memory: true,
    files: true,
    services: true,
    integrations: true,
    email: false,
    calendar: false,
    projects: fs.existsSync(path.join(WORKSPACE, 'projects')),
  };

  // Check for Google OAuth (email/calendar)
  try {
    const gogCredsPath = path.join(os.homedir(), '.config/gogcli/credentials.json');
    if (fs.existsSync(gogCredsPath)) {
      const creds = JSON.parse(fs.readFileSync(gogCredsPath, 'utf8'));
      if (creds.client_id) {
        features.email = true;
        features.calendar = true;
      }
    }
  } catch (e) {
    // Email/calendar not available
  }

  return features;
}

// ====== MIDDLEWARE ======
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ====== OPENCLAW CLI HELPER ======
function cli(cmd) {
  try {
    const out = execSync(`openclaw ${cmd}`, { encoding: 'utf8', timeout: 30000 });
    return out;
  } catch (e) {
    throw new Error(e.stderr || e.message);
  }
}

function runCommand(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 10000 });
  } catch (e) {
    return e.stderr || e.message || '';
  }
}

// ====== HEALTH CHECK (for Docker) ======
app.get('/health', (req, res) => {
  try {
    // Quick health check - verify gateway is reachable
    const status = cli('status --json 2>/dev/null || echo {}');
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      workspace: WORKSPACE,
      features: detectFeatures(),
    });
  } catch (e) {
    res.status(503).json({ 
      status: 'degraded', 
      error: e.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// ====== FEATURE AVAILABILITY API ======
app.get('/api/config', (req, res) => {
  try {
    const features = detectFeatures();
    
    // System info
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    
    res.json({
      features,
      workspace: WORKSPACE,
      system: {
        hostname: os.hostname(),
        platform: `${os.platform()} ${os.release()}`,
        arch: os.arch(),
        nodeVersion: process.version,
        cpuCount: cpus.length,
        totalMemory: (totalMem / 1024 / 1024 / 1024).toFixed(1) + ' GB',
        uptime: Math.floor(os.uptime()),
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ====== CRON API ======
app.get('/api/jobs', (req, res) => {
  try {
    const out = cli('cron list --json');
    res.json(JSON.parse(out));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/status', (req, res) => {
  try {
    const out = cli('cron status --json');
    res.json(JSON.parse(out));
  } catch (e) {
    try {
      const out2 = cli('cron status');
      res.json({ raw: out2 });
    } catch (e2) {
      res.status(500).json({ error: e2.message });
    }
  }
});

app.post('/api/jobs/:id/enable', (req, res) => {
  try {
    cli(`cron enable ${req.params.id}`);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/jobs/:id/disable', (req, res) => {
  try {
    cli(`cron disable ${req.params.id}`);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/jobs/:id/run', (req, res) => {
  try {
    cli(`cron run ${req.params.id}`);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/jobs/:id/runs', (req, res) => {
  try {
    const out = cli(`cron runs --id ${req.params.id} --json`);
    res.json(JSON.parse(out));
  } catch (e) {
    try {
      const out2 = cli(`cron runs --id ${req.params.id}`);
      res.json({ raw: out2 });
    } catch (e2) {
      res.status(500).json({ error: e2.message });
    }
  }
});

app.delete('/api/jobs/:id', (req, res) => {
  try {
    cli(`cron rm ${req.params.id}`);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/jobs/:id', (req, res) => {
  try {
    const { scheduleKind, scheduleValue, tz } = req.body;
    let flags = '';
    if (scheduleKind === 'cron') flags += ` --cron "${scheduleValue}"`;
    else if (scheduleKind === 'every') flags += ` --every "${scheduleValue}"`;
    else if (scheduleKind === 'at') flags += ` --at "${scheduleValue}"`;
    if (tz) flags += ` --tz "${tz}"`;
    if (flags) {
      cli(`cron edit ${req.params.id}${flags}`);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/jobs', (req, res) => {
  try {
    const { name, scheduleKind, scheduleValue, tz, sessionTarget, payloadKind, payloadText, enabled } = req.body;
    let cmd = `cron add --name "${name}"`;
    if (scheduleKind === 'cron') cmd += ` --cron "${scheduleValue}"`;
    else if (scheduleKind === 'every') cmd += ` --every "${scheduleValue}"`;
    else if (scheduleKind === 'at') cmd += ` --at "${scheduleValue}"`;
    if (tz) cmd += ` --tz "${tz}"`;
    cmd += ` --session ${sessionTarget || 'isolated'}`;
    if (payloadKind === 'systemEvent') cmd += ` --system-event "${payloadText.replace(/"/g, '\\"')}"`;
    else cmd += ` --message "${payloadText.replace(/"/g, '\\"')}"`;
    if (enabled === false) cmd += ' --disabled';
    const out = cli(cmd);
    res.json({ ok: true, output: out });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ====== SERVICES API ======
app.get('/api/services', (req, res) => {
  try {
    const status = cli('status --json');
    const statusData = JSON.parse(status);
    
    // System resources
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercent = ((usedMem / totalMem) * 100).toFixed(1);
    
    // Disk usage
    const dfOut = runCommand('df -h / | tail -1');
    const dfParts = dfOut.split(/\s+/);
    const diskUsed = dfParts[2] || '?';
    const diskTotal = dfParts[1] || '?';
    const diskPercent = dfParts[4] || '?';
    
    // Load average
    const loadavg = os.loadavg();
    
    res.json({
      channels: statusData.channels || [],
      nodes: statusData.nodes || [],
      gateway: {
        uptime: statusData.gateway?.uptime || os.uptime(),
        version: statusData.version || 'unknown',
        address: statusData.gateway?.address || 'unknown',
      },
      system: {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        cpuCount: cpus.length,
        cpuModel: cpus[0]?.model || 'unknown',
        loadAvg1: loadavg[0].toFixed(2),
        loadAvg5: loadavg[1].toFixed(2),
        loadAvg15: loadavg[2].toFixed(2),
        totalMem: (totalMem / 1024 / 1024 / 1024).toFixed(1) + ' GB',
        usedMem: (usedMem / 1024 / 1024 / 1024).toFixed(1) + ' GB',
        memPercent,
        diskUsed,
        diskTotal,
        diskPercent,
        uptime: os.uptime(),
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ====== SESSIONS API ======
app.get('/api/sessions', (req, res) => {
  try {
    const { kind } = req.query;
    const out = cli('sessions list --json');
    let sessions = JSON.parse(out);
    
    if (sessions.sessions) {
      sessions = sessions.sessions;
    }
    
    if (kind && Array.isArray(sessions)) {
      sessions = sessions.filter(s => s.kind === kind || (kind === 'cron' && s.key.includes(':cron:')));
    }
    
    res.json({ sessions: Array.isArray(sessions) ? sessions : [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ====== MEMORY API ======
app.get('/api/memory', (req, res) => {
  try {
    const memoryDir = path.join(WORKSPACE, 'memory');
    const rootFiles = ['MEMORY.md', 'SOUL.md', 'USER.md', 'IDENTITY.md', 'AGENTS.md', 'TOOLS.md'];
    
    let files = [];
    
    // Root files
    for (const file of rootFiles) {
      const filePath = path.join(WORKSPACE, file);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        files.push({
          name: file,
          path: file,
          size: stats.size,
          modified: stats.mtime,
          isRoot: true,
        });
      }
    }
    
    // Memory directory
    if (fs.existsSync(memoryDir)) {
      const memFiles = fs.readdirSync(memoryDir)
        .filter(f => f.endsWith('.md') || f.endsWith('.json'))
        .map(f => {
          const stats = fs.statSync(path.join(memoryDir, f));
          return {
            name: f,
            path: `memory/${f}`,
            size: stats.size,
            modified: stats.mtime,
            isRoot: false,
          };
        })
        .sort((a, b) => b.modified - a.modified);
      
      files = files.concat(memFiles);
    }
    
    res.json({ files });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/memory/:filename(*)', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(WORKSPACE, filename);
    
    if (!filePath.startsWith(WORKSPACE)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    res.json({ content });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/memory/search', (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.json({ results: [] });
    
    const memoryDir = path.join(WORKSPACE, 'memory');
    const rootFiles = ['MEMORY.md', 'SOUL.md', 'USER.md', 'IDENTITY.md', 'AGENTS.md', 'TOOLS.md'];
    
    let results = [];
    
    // Search root files
    for (const file of rootFiles) {
      const filePath = path.join(WORKSPACE, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.toLowerCase().includes(query.toLowerCase())) {
          const lines = content.split('\n');
          const matchedLines = lines
            .map((line, idx) => ({ line, idx }))
            .filter(({ line }) => line.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 3);
          
          results.push({
            file,
            path: file,
            matches: matchedLines.map(m => ({ line: m.line, lineNumber: m.idx + 1 })),
          });
        }
      }
    }
    
    // Search memory files
    if (fs.existsSync(memoryDir)) {
      const files = fs.readdirSync(memoryDir).filter(f => f.endsWith('.md'));
      for (const file of files) {
        const filePath = path.join(memoryDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.toLowerCase().includes(query.toLowerCase())) {
          const lines = content.split('\n');
          const matchedLines = lines
            .map((line, idx) => ({ line, idx }))
            .filter(({ line }) => line.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 3);
          
          results.push({
            file,
            path: `memory/${file}`,
            matches: matchedLines.map(m => ({ line: m.line, lineNumber: m.idx + 1 })),
          });
        }
      }
    }
    
    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ====== PROJECTS API (Generic) ======
app.get('/api/projects', (req, res) => {
  try {
    const projectsDir = path.join(WORKSPACE, 'projects');
    
    if (!fs.existsSync(projectsDir)) {
      return res.json({ projects: [] });
    }
    
    const projects = [];
    const dirs = fs.readdirSync(projectsDir);
    
    for (const dir of dirs) {
      const projPath = path.join(projectsDir, dir);
      const stats = fs.statSync(projPath);
      
      if (stats.isDirectory()) {
        // Look for README.md to get description
        let description = '';
        const readmePath = path.join(projPath, 'README.md');
        if (fs.existsSync(readmePath)) {
          const content = fs.readFileSync(readmePath, 'utf8');
          // Extract first line that isn't a header
          const lines = content.split('\n');
          for (const line of lines) {
            if (line && !line.startsWith('#')) {
              description = line.substring(0, 100);
              break;
            }
          }
        }
        
        projects.push({
          id: dir,
          name: dir.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          description: description || `Project: ${dir}`,
          lastActivity: stats.mtime,
          path: `projects/${dir}`,
        });
      }
    }
    
    res.json({ projects: projects.sort((a, b) => b.lastActivity - a.lastActivity) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ====== INTEGRATIONS API ======
const INTEGRATIONS_STATE_PATH = path.join(__dirname, 'integrations-state.json');

function loadIntegrationsState() {
  try {
    if (fs.existsSync(INTEGRATIONS_STATE_PATH)) {
      return JSON.parse(fs.readFileSync(INTEGRATIONS_STATE_PATH, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load integrations state:', e);
  }
  return {};
}

function saveIntegrationsState(state) {
  try {
    fs.writeFileSync(INTEGRATIONS_STATE_PATH, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('Failed to save integrations state:', e);
  }
}

function maskToken(token) {
  if (!token || token.length < 8) return '***';
  return '...' + token.slice(-4);
}

app.get('/api/integrations', (req, res) => {
  try {
    const state = loadIntegrationsState();
    const integrations = [];
    
    // Check gateway status for channels
    let gatewayStatus = {};
    try {
      const statusOut = cli('status --json');
      gatewayStatus = JSON.parse(statusOut);
    } catch (e) {
      console.error('Failed to get gateway status:', e);
    }
    
    // Check auth profiles
    let authProfiles = {};
    try {
      const authPath = path.join(os.homedir(), '.openclaw/agents/main/agent/auth-profiles.json');
      if (fs.existsSync(authPath)) {
        authProfiles = JSON.parse(fs.readFileSync(authPath, 'utf8'));
      }
    } catch (e) {
      console.error('Failed to read auth profiles:', e);
    }
    
    // Check gog config
    let gogCreds = {};
    try {
      const gogPath = path.join(os.homedir(), '.config/gogcli/credentials.json');
      if (fs.existsSync(gogPath)) {
        gogCreds = JSON.parse(fs.readFileSync(gogPath, 'utf8'));
      }
    } catch (e) {}
    
    // Check nodes
    let nodesStatus = [];
    try {
      const nodesOut = cli('nodes status --json');
      const nodesParsed = JSON.parse(nodesOut);
      nodesStatus = nodesParsed.nodes || [];
    } catch (e) {
      console.error('Failed to get nodes status:', e);
    }
    
    // === COMMUNICATION CHANNELS ===
    
    // Telegram
    const telegramConnected = gatewayStatus.channels?.some(ch => ch.channel === 'telegram') || false;
    integrations.push({
      id: 'telegram',
      category: 'communication',
      icon: '📱',
      name: 'Telegram',
      description: 'Bot messaging channel',
      status: telegramConnected ? 'connected' : 'disconnected',
      enabled: state.telegram !== false,
      details: {
        auth: 'Bot token',
        note: 'Configured via gateway',
      },
    });
    
    // WhatsApp
    const whatsappChannel = gatewayStatus.channels?.find(ch => ch.channel === 'whatsapp');
    let whatsappStatus = 'disconnected';
    if (whatsappChannel) {
      whatsappStatus = whatsappChannel.state === 'OK' || whatsappChannel.state === 'ok' ? 'connected' : 'degraded';
    }
    integrations.push({
      id: 'whatsapp',
      category: 'communication',
      icon: '💬',
      name: 'WhatsApp',
      description: 'Messaging channel',
      status: whatsappStatus,
      enabled: state.whatsapp !== false,
      details: {
        auth: 'Phone link',
        note: 'Configured via gateway',
      },
    });
    
    // === GOOGLE ECOSYSTEM ===
    
    const hasGoogleAuth = !!gogCreds.client_id;
    const googleBaseDetails = {
      auth: 'OAuth2 refresh token',
      clientId: gogCreds.client_id ? maskToken(gogCreds.client_id) : 'not configured',
    };
    
    integrations.push({
      id: 'google-drive',
      category: 'google',
      icon: '📁',
      name: 'Google Drive',
      description: 'File storage and folder management',
      status: hasGoogleAuth ? 'connected' : 'disconnected',
      enabled: state['google-drive'] !== false,
      details: googleBaseDetails,
    });
    
    integrations.push({
      id: 'gmail',
      category: 'google',
      icon: '📧',
      name: 'Gmail',
      description: 'Email sending with attachments',
      status: hasGoogleAuth ? 'connected' : 'disconnected',
      enabled: state.gmail !== false,
      details: googleBaseDetails,
    });
    
    integrations.push({
      id: 'google-calendar',
      category: 'google',
      icon: '📅',
      name: 'Google Calendar',
      description: 'Calendar events and scheduling',
      status: hasGoogleAuth ? 'connected' : 'disconnected',
      enabled: state['google-calendar'] !== false,
      details: googleBaseDetails,
    });
    
    // === AI / LLM ===
    
    const anthropicProfile = authProfiles.profiles?.['anthropic:default'];
    integrations.push({
      id: 'anthropic',
      category: 'ai',
      icon: '🤖',
      name: 'Anthropic API',
      description: 'Primary LLM provider (Claude)',
      status: anthropicProfile ? 'connected' : 'disconnected',
      enabled: state.anthropic !== false,
      details: {
        auth: 'API key',
        token: anthropicProfile ? maskToken(anthropicProfile.token) : 'not configured',
      },
    });
    
    // === SEARCH & WEB ===
    
    const hasBraveKey = runCommand('env | grep BRAVE').includes('BRAVE');
    integrations.push({
      id: 'brave-search',
      category: 'search',
      icon: '🔍',
      name: 'Brave Search',
      description: 'Web search tool',
      status: hasBraveKey ? 'connected' : 'disconnected',
      enabled: state['brave-search'] !== false,
      details: {
        auth: 'API key',
        status: hasBraveKey ? 'configured' : 'not configured',
      },
    });
    
    // === NODE CONNECTIONS ===
    
    for (const node of nodesStatus) {
      if (!node || !node.displayName) continue;
      const nodeConnected = node.connected === true;
      const nodeName = node.displayName || 'Unknown Node';
      const nodeId = `node-${nodeName.toLowerCase().replace(/\s+/g, '-')}`;
      integrations.push({
        id: nodeId,
        category: 'nodes',
        icon: '💻',
        name: nodeName,
        description: `${node.platform || 'Node'} via Tailscale`,
        status: nodeConnected ? 'connected' : 'disconnected',
        enabled: state[nodeId] !== false,
        details: {
          ip: node.remoteIp || 'unknown',
          paired: node.paired ? 'Yes' : 'No',
        },
      });
    }
    
    res.json({ integrations });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/integrations/:id/toggle', (req, res) => {
  try {
    const { id } = req.params;
    const state = loadIntegrationsState();
    
    // Toggle the state
    state[id] = state[id] === false;
    
    saveIntegrationsState(state);
    
    res.json({ ok: true, enabled: state[id] !== false });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ====== HOME API (Generic Stats) ======
app.get('/api/home/stats', (req, res) => {
  try {
    const stats = {};
    
    // Project stats (generic)
    try {
      const projectsDir = path.join(WORKSPACE, 'projects');
      if (fs.existsSync(projectsDir)) {
        const projects = fs.readdirSync(projectsDir).filter(f => {
          return fs.statSync(path.join(projectsDir, f)).isDirectory();
        });
        stats.projects = { count: projects.length };
      }
    } catch (e) {}
    
    // Cron jobs count
    try {
      const cronOut = cli('cron list --json');
      const cronData = JSON.parse(cronOut);
      const jobs = cronData.jobs || [];
      const activeJobs = jobs.filter(j => j.enabled !== false);
      let lastRun = null;
      for (const job of jobs) {
        if (job.lastRun && (!lastRun || job.lastRun > lastRun)) {
          lastRun = job.lastRun;
        }
      }
      stats.cron = { active: activeJobs.length, total: jobs.length, lastRun };
    } catch (e) {
      stats.cron = { error: e.message };
    }
    
    // Sessions count
    try {
      const sessionsOut = cli('sessions list --json');
      const sessionsData = JSON.parse(sessionsOut);
      const sessions = sessionsData.sessions || [];
      stats.sessions = { active: sessions.length };
    } catch (e) {
      stats.sessions = { error: e.message };
    }
    
    // System stats
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercent = ((usedMem / totalMem) * 100).toFixed(0);
    const loadavg = os.loadavg();
    stats.system = {
      cpuLoad: loadavg[0].toFixed(1),
      memPercent: parseInt(memPercent),
    };
    
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ====== FILES API ======
function sanitizePath(requestedPath) {
  if (!requestedPath) requestedPath = '/';
  const normalized = path.normalize(requestedPath).replace(/^(\.\.[\/\\])+/, '');
  const fullPath = path.join(WORKSPACE, normalized);
  if (!fullPath.startsWith(WORKSPACE)) {
    throw new Error('Access denied: path outside workspace');
  }
  return fullPath;
}

function getFileIcon(filename, isDir) {
  if (isDir) return '📁';
  const ext = path.extname(filename).toLowerCase();
  const icons = {
    '.md': '📝', '.txt': '📄', '.json': '📊', '.yaml': '🔧', '.yml': '🔧',
    '.js': '📜', '.ts': '📜', '.html': '🌐', '.css': '🎨',
    '.png': '🖼️', '.jpg': '🖼️', '.jpeg': '🖼️', '.gif': '🖼️', '.svg': '🖼️',
    '.pdf': '📕', '.zip': '📦', '.tar': '📦', '.gz': '📦',
  };
  return icons[ext] || '📄';
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
}

app.get('/api/files', (req, res) => {
  try {
    const requestedPath = req.query.path || '/';
    const fullPath = sanitizePath(requestedPath);
    
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Path not found' });
    }
    
    const stats = fs.statSync(fullPath);
    
    if (!stats.isDirectory()) {
      return res.status(400).json({ error: 'Path is not a directory' });
    }
    
    const items = fs.readdirSync(fullPath);
    const files = [];
    
    for (const item of items) {
      if (item.startsWith('.') && item !== '.gitignore') continue;
      
      try {
        const itemPath = path.join(fullPath, item);
        const itemStats = fs.statSync(itemPath);
        const isDir = itemStats.isDirectory();
        
        files.push({
          name: item,
          path: path.relative(WORKSPACE, itemPath),
          isDirectory: isDir,
          size: isDir ? null : itemStats.size,
          sizeFormatted: isDir ? '-' : formatSize(itemStats.size),
          modified: itemStats.mtime,
          icon: getFileIcon(item, isDir),
        });
      } catch (e) {
        console.error(`Failed to stat ${item}:`, e.message);
      }
    }
    
    files.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
    
    res.json({
      currentPath: path.relative(WORKSPACE, fullPath) || '/',
      files,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/files/read', (req, res) => {
  try {
    const requestedPath = req.query.path;
    if (!requestedPath) {
      return res.status(400).json({ error: 'Path parameter required' });
    }
    
    const fullPath = sanitizePath(requestedPath);
    
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const stats = fs.statSync(fullPath);
    
    if (stats.isDirectory()) {
      return res.status(400).json({ error: 'Path is a directory' });
    }
    
    if (stats.size > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'File too large for preview (>5MB)' });
    }
    
    const ext = path.extname(fullPath).toLowerCase();
    const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext);
    
    if (isImage) {
      const buffer = fs.readFileSync(fullPath);
      const base64 = buffer.toString('base64');
      const mimeTypes = {
        '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
      };
      const mimeType = mimeTypes[ext] || 'application/octet-stream';
      
      res.json({
        type: 'image',
        content: `data:${mimeType};base64,${base64}`,
        name: path.basename(fullPath),
      });
    } else {
      const content = fs.readFileSync(fullPath, 'utf8');
      res.json({
        type: 'text',
        content,
        name: path.basename(fullPath),
        extension: ext,
      });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ====== START SERVER ======
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║   ⚡ Command Bridge for OpenClaw     ║
╠═══════════════════════════════════════╣
║  Server running on port ${PORT}        ║
║  Workspace: ${WORKSPACE.substring(0, 25)}...  ║
║  Gateway: ${CONFIG.gatewayUrl}         ║
╚═══════════════════════════════════════╝
  `);
});
