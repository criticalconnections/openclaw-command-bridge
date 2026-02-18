# ⚡ Command Bridge

**The web dashboard for OpenClaw.**

Command Bridge gives you a beautiful, Material Design web interface to monitor and manage your OpenClaw AI agent. See your cron jobs, connected services, sessions, memory files, and more — all from one place.

![Material Design 3 Dark Theme](docs/screenshots/placeholder.png)

## Features

- 🏠 **Home Dashboard** — Quick stats and system overview
- ⏰ **Cron Manager** — Create, edit, enable/disable, and trigger cron jobs
- 🔌 **Services** — Monitor all connected channels and system resources
- 📊 **Sessions** — View active sessions and sub-agent runs
- 🧠 **Memory** — Browse and search your agent's memory files
- 📁 **Projects** — Quick access to all your workspace projects
- 🗂️ **File Manager** — Browse workspace with markdown preview
- 🔧 **Config** — View gateway configuration and system info
- 🔌 **Integrations** — Toggle and monitor API connections

## Quick Start

### Docker (Recommended)

```bash
git clone https://github.com/openclaw/command-bridge.git
cd command-bridge
cp .env.example .env
# Edit .env with your gateway token (optional - auto-detects from ~/.openclaw/gateway.yaml)
docker-compose up -d
```

Visit **http://localhost:3333**

### Manual Install

```bash
git clone https://github.com/openclaw/command-bridge.git
cd command-bridge
npm install
npm start
```

## Configuration

Command Bridge auto-detects your OpenClaw installation. It looks for:

1. **Gateway config**: `~/.openclaw/gateway.yaml` or `~/.openclaw/openclaw.json`
2. **Environment variables**: `OPENCLAW_GATEWAY_URL`, `OPENCLAW_GATEWAY_TOKEN`
3. **Workspace**: `~/.openclaw/workspace` or `$OPENCLAW_WORKSPACE`

### Environment Variables

Create a `.env` file (see `.env.example`):

```bash
PORT=3333
OPENCLAW_GATEWAY_URL=http://localhost:18789
OPENCLAW_GATEWAY_TOKEN=your-gateway-token-here
OPENCLAW_WORKSPACE=~/.openclaw/workspace
```

**Note:** If you're running OpenClaw locally, the dashboard will auto-detect your configuration from `~/.openclaw/gateway.yaml`. Environment variables are optional unless you want to override the defaults.

See [Configuration Docs](docs/configuration.md) for details.

## Requirements

- **Node.js 18+** (or Docker)
- **OpenClaw gateway running**
- That's it!

## Docker Deployment

The included `docker-compose.yml` mounts your workspace read-only and connects to the gateway on the host:

```yaml
volumes:
  - ~/.openclaw/workspace:/workspace:ro
environment:
  - OPENCLAW_GATEWAY_URL=http://host.docker.internal:18789
```

### Health Check

The container includes a health check endpoint at `/health`. Docker will monitor it automatically:

```bash
docker ps  # Check STATUS for health
curl http://localhost:3333/health
```

## Features Auto-Detection

Command Bridge automatically detects which features are available based on your OpenClaw setup:

- **Google services** (Gmail, Calendar, Drive) — requires `gogcli` OAuth configured
- **Projects tab** — shows if `workspace/projects/` exists
- **Integrations** — discovers connected channels, nodes, and APIs

Tabs and features will only appear if they're available. No configuration needed!

## Development

```bash
npm install
npm run dev
```

The server will start on port 3333 (or `$PORT`).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT — see [LICENSE](LICENSE)

## Credits

Built with 🦝 energy by the OpenClaw community.

Inspired by modern dashboards like Vercel, Railway, and Material Design 3.

---

## Troubleshooting

### "Gateway Offline"

- Check that `openclaw gateway start` is running
- Verify `OPENCLAW_GATEWAY_URL` points to the correct address
- Check firewall/network settings if running in Docker

### "No features available"

- Make sure OpenClaw is properly installed (`openclaw status`)
- Verify workspace path is correct (`~/.openclaw/workspace`)
- Check `~/.openclaw/gateway.yaml` exists and is readable

### Docker: "Cannot connect to gateway"

- Use `OPENCLAW_GATEWAY_URL=http://host.docker.internal:18789` for macOS/Windows
- Use `OPENCLAW_GATEWAY_URL=http://172.17.0.1:18789` for Linux (or host network mode)

### Port already in use

```bash
PORT=4444 npm start  # Use a different port
```

## Screenshots

*Coming soon!*

## Roadmap

- [ ] Real-time updates via WebSocket
- [ ] Email compose/read interface (requires Google OAuth)
- [ ] Calendar event management
- [ ] Pipeline monitoring
- [ ] Custom dashboard widgets
- [ ] Dark/light theme toggle
- [ ] Multi-user support with auth

---

**Support:** [GitHub Issues](https://github.com/openclaw/command-bridge/issues)

**Docs:** [docs/](docs/)
