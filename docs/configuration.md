# Command Bridge Configuration

This document covers all configuration options for Command Bridge.

## Configuration Priority

Command Bridge loads configuration in this order (later sources override earlier):

1. **Default config** (`config/default.json`)
2. **Auto-detected gateway config** (`~/.openclaw/gateway.yaml` or `openclaw.json`)
3. **Environment variables** (`.env` or shell exports)
4. **Runtime arguments** (coming soon)

## Environment Variables

### Server Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3333` | HTTP server port |
| `NODE_ENV` | `production` | Node environment (`production` or `development`) |

### OpenClaw Gateway

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENCLAW_GATEWAY_URL` | `http://localhost:18789` | Gateway API endpoint |
| `OPENCLAW_GATEWAY_TOKEN` | *(auto-detected)* | Gateway auth token |
| `OPENCLAW_WORKSPACE` | `~/.openclaw/workspace` | Agent workspace path |
| `OPENCLAW_CONFIG_PATH` | *(auto-detected)* | Path to gateway config file |

### Example .env File

```bash
# Server
PORT=3333
NODE_ENV=production

# Gateway
OPENCLAW_GATEWAY_URL=http://localhost:18789
OPENCLAW_GATEWAY_TOKEN=sk-openclaw-abc123def456
OPENCLAW_WORKSPACE=/home/user/.openclaw/workspace

# Optional: Override config path
OPENCLAW_CONFIG_PATH=/etc/openclaw/gateway.yaml
```

## Gateway Auto-Detection

Command Bridge looks for gateway configuration in these locations (in order):

1. `$OPENCLAW_CONFIG_PATH` (if set)
2. `~/.openclaw/gateway.yaml`
3. `~/.openclaw/openclaw.json`
4. `/root/.openclaw/gateway.yaml`
5. `/root/.openclaw/openclaw.json`

### Gateway YAML Example

```yaml
address: http://localhost:18789
token: sk-openclaw-abc123def456
workspace: /home/user/.openclaw/workspace
```

### Gateway JSON Example

```json
{
  "gateway": {
    "address": "http://localhost:18789",
    "token": "sk-openclaw-abc123def456"
  },
  "token": "sk-openclaw-abc123def456",
  "workspace": "/home/user/.openclaw/workspace"
}
```

## Feature Detection

Command Bridge automatically detects available features based on your OpenClaw setup.

### Email & Calendar

**Requirements:**
- `gogcli` installed
- Google OAuth configured (`~/.config/gogcli/credentials.json`)

**Check if enabled:**
```bash
curl http://localhost:3333/api/config | jq '.features.email'
```

**Configure Google OAuth:**
```bash
gog auth
# Follow the OAuth flow
```

### Projects Tab

**Requirements:**
- `workspace/projects/` directory exists

**Auto-enabled** when projects folder is detected.

### Integrations

**Auto-detected:**
- Communication channels (Telegram, WhatsApp)
- Google services (Drive, Docs, Sheets, Calendar, Gmail)
- AI providers (Anthropic)
- Search engines (Brave)
- Paired nodes (Tailscale)

**State stored in:**
- `integrations-state.json` (per-integration enable/disable)

## Docker Configuration

### docker-compose.yml

```yaml
version: '3.8'

services:
  command-bridge:
    build: .
    container_name: command-bridge
    restart: unless-stopped
    
    # Port mapping
    ports:
      - "3333:3333"  # HOST:CONTAINER
    
    # Environment variables
    environment:
      - OPENCLAW_GATEWAY_URL=http://host.docker.internal:18789
      - OPENCLAW_GATEWAY_TOKEN=${OPENCLAW_GATEWAY_TOKEN}
      - OPENCLAW_WORKSPACE=/workspace
      - NODE_ENV=production
    
    # Volume mounts
    volumes:
      # Workspace (read-only)
      - ~/.openclaw/workspace:/workspace:ro
      # Persistent data (integrations state, etc.)
      - command-bridge-data:/app/data
    
    # Allow access to host network
    extra_hosts:
      - "host.docker.internal:host-gateway"

volumes:
  command-bridge-data:
```

### Docker Network Modes

**Default (Bridge Mode)**
```yaml
# Best for: Most users
environment:
  - OPENCLAW_GATEWAY_URL=http://host.docker.internal:18789  # macOS/Windows
  # OR
  - OPENCLAW_GATEWAY_URL=http://172.17.0.1:18789  # Linux
```

**Host Network Mode**
```yaml
# Best for: Linux, when gateway is on localhost
network_mode: host
environment:
  - OPENCLAW_GATEWAY_URL=http://localhost:18789
```

**Custom Network**
```yaml
# Best for: Running gateway in Docker too
networks:
  - openclaw-network

networks:
  openclaw-network:
    external: true
```

## Advanced Configuration

### Custom Workspace Paths

If your workspace is in a non-standard location:

```bash
export OPENCLAW_WORKSPACE=/mnt/data/openclaw/workspace
npm start
```

Or in Docker:

```yaml
volumes:
  - /mnt/data/openclaw/workspace:/workspace:ro
```

### Multiple Instances

Run multiple dashboards on different ports:

**Instance 1 (Local)**
```bash
PORT=3333 OPENCLAW_WORKSPACE=~/.openclaw/workspace npm start
```

**Instance 2 (Remote)**
```bash
PORT=4444 \
OPENCLAW_GATEWAY_URL=http://remote-server:18789 \
OPENCLAW_GATEWAY_TOKEN=remote-token \
npm start
```

### Reverse Proxy (Nginx)

```nginx
server {
  listen 80;
  server_name command.example.com;

  location / {
    proxy_pass http://localhost:3333;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}
```

### HTTPS/SSL

**Option 1: Use Nginx/Caddy**

```nginx
server {
  listen 443 ssl;
  server_name command.example.com;
  
  ssl_certificate /path/to/cert.pem;
  ssl_certificate_key /path/to/key.pem;
  
  location / {
    proxy_pass http://localhost:3333;
  }
}
```

**Option 2: Node.js HTTPS** (requires code changes)

See `server.js` for adding HTTPS support.

## Security Considerations

### Token Security

**Never commit tokens to git:**
```bash
echo ".env" >> .gitignore
echo "integrations-state.json" >> .gitignore
```

**Use environment variables in production:**
```bash
export OPENCLAW_GATEWAY_TOKEN=sk-openclaw-$(openssl rand -hex 16)
```

### Read-Only Workspace

The workspace is mounted read-only in Docker by default:

```yaml
volumes:
  - ~/.openclaw/workspace:/workspace:ro  # :ro = read-only
```

This prevents accidental modifications from the dashboard.

### Network Security

**Firewall rules:**
```bash
# Only allow local access
sudo ufw allow from 127.0.0.1 to any port 3333

# Or allow from specific subnet
sudo ufw allow from 192.168.1.0/24 to any port 3333
```

**Authentication** (coming soon):
- Basic auth
- OAuth integration
- API key authentication

## Troubleshooting Config Issues

### Check loaded configuration

```bash
curl http://localhost:3333/api/config
```

Returns:
```json
{
  "features": { ... },
  "workspace": "/root/.openclaw/workspace",
  "system": { ... }
}
```

### Check gateway connection

```bash
curl http://localhost:3333/health
```

### Enable debug logging

```bash
NODE_ENV=development npm start
```

This will show:
- Detected config paths
- Loaded gateway URL
- Workspace path
- Feature detection results

### Validate gateway.yaml

```bash
# Check syntax
cat ~/.openclaw/gateway.yaml

# Extract token
grep token ~/.openclaw/gateway.yaml

# Test gateway directly
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:18789/status
```

## Environment-Specific Configs

### Development

```bash
# .env.development
PORT=3333
NODE_ENV=development
OPENCLAW_GATEWAY_URL=http://localhost:18789
OPENCLAW_WORKSPACE=./test-workspace
```

### Production

```bash
# .env.production
PORT=3333
NODE_ENV=production
OPENCLAW_GATEWAY_URL=http://localhost:18789
# Token loaded from gateway.yaml
```

### Testing

```bash
# .env.test
PORT=4444
NODE_ENV=test
OPENCLAW_GATEWAY_URL=http://mock-gateway:18789
OPENCLAW_WORKSPACE=./fixtures/workspace
```

## Next Steps

- [Setup Guide](setup.md) for installation instructions
- [README](../README.md) for feature overview
- [CONTRIBUTING](../CONTRIBUTING.md) for development
