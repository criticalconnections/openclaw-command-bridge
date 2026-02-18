# Command Bridge Setup Guide

This guide walks you through setting up Command Bridge for your OpenClaw installation.

## Prerequisites

1. **OpenClaw installed and running**
   ```bash
   openclaw status  # Should show gateway running
   ```

2. **Node.js 18+** (if not using Docker)
   ```bash
   node --version  # Should be 18.0.0 or higher
   ```

## Installation Methods

### Method 1: Docker (Recommended)

**Pros:** Isolated, easy to update, works everywhere  
**Cons:** Requires Docker installed

```bash
# Clone the repository
git clone https://github.com/openclaw/command-bridge.git
cd command-bridge

# Copy environment template
cp .env.example .env

# Edit .env if needed (optional - auto-detects gateway.yaml)
nano .env

# Start with Docker Compose
docker-compose up -d

# Check logs
docker-compose logs -f

# Open in browser
open http://localhost:3333
```

### Method 2: Manual Installation

**Pros:** No Docker needed, easier to develop  
**Cons:** Requires Node.js installed

```bash
# Clone the repository
git clone https://github.com/openclaw/command-bridge.git
cd command-bridge

# Install dependencies
npm install

# Copy environment template (optional)
cp .env.example .env

# Start the server
npm start

# Open in browser
open http://localhost:3333
```

### Method 3: NPM Global Install (Coming Soon)

Once published to NPM:

```bash
# Install globally
npm install -g command-bridge

# Run from anywhere
command-bridge
```

## Configuration

### Auto-Detection (Default)

Command Bridge automatically detects your OpenClaw setup by checking:

1. `~/.openclaw/gateway.yaml` for gateway URL and token
2. `~/.openclaw/openclaw.json` as fallback
3. Environment variables `OPENCLAW_GATEWAY_URL` and `OPENCLAW_GATEWAY_TOKEN`

**Most users don't need to configure anything!**

### Manual Configuration

If auto-detection doesn't work or you want custom settings:

**Option 1: Environment Variables**

```bash
export OPENCLAW_GATEWAY_URL=http://localhost:18789
export OPENCLAW_GATEWAY_TOKEN=your-token-here
export OPENCLAW_WORKSPACE=~/.openclaw/workspace
export PORT=3333

npm start
```

**Option 2: .env File**

Create `.env` in the project root:

```bash
PORT=3333
OPENCLAW_GATEWAY_URL=http://localhost:18789
OPENCLAW_GATEWAY_TOKEN=your-token-here
OPENCLAW_WORKSPACE=~/.openclaw/workspace
NODE_ENV=production
```

### Finding Your Gateway Token

1. **From gateway.yaml**:
   ```bash
   cat ~/.openclaw/gateway.yaml | grep token
   ```

2. **From openclaw.json**:
   ```bash
   cat ~/.openclaw/openclaw.json | jq '.gateway.token'
   ```

3. **Create a new token** (if needed):
   ```bash
   openclaw gateway token --generate
   ```

## Docker-Specific Setup

### Custom Workspace Path

If your OpenClaw workspace is in a non-standard location:

Edit `docker-compose.yml`:

```yaml
volumes:
  - /path/to/your/workspace:/workspace:ro
```

### Remote Gateway

If the gateway is on another machine:

```yaml
environment:
  - OPENCLAW_GATEWAY_URL=http://192.168.1.100:18789
  - OPENCLAW_GATEWAY_TOKEN=your-token-here
```

### Custom Port

```yaml
ports:
  - "4444:3333"  # Access on port 4444
```

Or use `.env`:

```bash
PORT=4444
```

Then `docker-compose up -d` will use port 4444.

## Verifying Installation

1. **Check health endpoint**:
   ```bash
   curl http://localhost:3333/health
   ```

   Should return:
   ```json
   {
     "status": "healthy",
     "timestamp": "2025-02-18T20:00:00.000Z",
     "workspace": "/root/.openclaw/workspace",
     "features": { ... }
   }
   ```

2. **Check gateway connection**:
   ```bash
   curl http://localhost:3333/api/services
   ```

   Should return gateway status and channels.

3. **Open the UI**:
   ```bash
   open http://localhost:3333
   ```

   You should see the Command Bridge dashboard with:
   - Gateway status: "Online" (green)
   - Home page with stats
   - Sidebar navigation

## Troubleshooting

### "Gateway Offline" in UI

**Check gateway is running:**
```bash
openclaw status
# If not running:
openclaw gateway start
```

**Check gateway URL is correct:**
```bash
echo $OPENCLAW_GATEWAY_URL
# Should match gateway.yaml address
```

**Check token is valid:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:18789/status
```

### "Cannot find workspace"

**Check workspace path:**
```bash
ls ~/.openclaw/workspace
# Should show memory/, projects/, etc.
```

**Set explicit path:**
```bash
export OPENCLAW_WORKSPACE=/path/to/workspace
npm start
```

### Docker: "Connection refused"

**For macOS/Windows:**
```yaml
OPENCLAW_GATEWAY_URL=http://host.docker.internal:18789
```

**For Linux:**
```yaml
OPENCLAW_GATEWAY_URL=http://172.17.0.1:18789
# Or use host network mode:
network_mode: host
```

### Port already in use

**Check what's using the port:**
```bash
lsof -i :3333
```

**Use a different port:**
```bash
PORT=4444 npm start
```

### Permission errors (Docker)

If workspace files aren't readable:

```yaml
volumes:
  - ~/.openclaw/workspace:/workspace:ro  # :ro = read-only
```

Make sure the user inside Docker can read the files:

```bash
ls -la ~/.openclaw/workspace
# Should be readable by user/group
```

## Next Steps

- [Configuration Guide](configuration.md) for advanced settings
- [README](../README.md) for feature overview
- [Contributing Guide](../CONTRIBUTING.md) to help develop

## Getting Help

- **GitHub Issues**: Report bugs or request features
- **Logs**: Check `docker-compose logs` or console output
- **Health check**: Visit `/health` endpoint for diagnostics
