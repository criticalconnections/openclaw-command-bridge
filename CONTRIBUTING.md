# Contributing to Command Bridge

Thanks for your interest in contributing! Command Bridge is a community project and we welcome contributions of all kinds.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/command-bridge.git
   cd command-bridge
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Start the dev server**:
   ```bash
   npm run dev
   ```

## Development Workflow

### Making Changes

1. **Create a branch** for your feature/fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**:
   - Follow existing code style
   - Add comments for complex logic
   - Test your changes manually

3. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

   We use [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` new feature
   - `fix:` bug fix
   - `docs:` documentation changes
   - `style:` formatting, missing semicolons, etc.
   - `refactor:` code restructuring
   - `test:` adding tests
   - `chore:` maintenance tasks

4. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Open a Pull Request** on GitHub

### Code Style

- **JavaScript**: Use modern ES6+ syntax
- **Indentation**: 2 spaces
- **Semicolons**: Optional (be consistent)
- **Strings**: Single quotes preferred
- **Comments**: Explain "why", not "what"

### File Structure

```
command-bridge/
├── server.js          # Express backend, OpenClaw API proxy
├── public/            # Frontend assets
│   ├── index.html     # Main HTML (Material Design 3)
│   ├── style.css      # Material Design 3 dark theme
│   └── app.js         # Frontend JavaScript
├── config/            # Default configuration
├── docs/              # Documentation
└── Dockerfile         # Docker setup
```

### Testing

Currently manual testing. Before submitting a PR:

1. **Test the build**:
   ```bash
   docker build -t command-bridge .
   ```

2. **Test basic functionality**:
   - Start the server
   - Navigate through all tabs
   - Create/edit/delete a cron job
   - Browse files and memory
   - Check integrations status

3. **Test with a clean OpenClaw install** (if possible)

### Adding Features

When adding new features:

1. **Check feature availability** via `/api/config` endpoint
2. **Hide UI elements** if feature is not available
3. **Add error handling** for API failures
4. **Update documentation**
5. **Add example config** if needed

Example:

```javascript
// In app.js
async function init() {
  const config = await api('/config');
  if (config.features.email) {
    showEmailTab();
  }
}
```

## Pull Request Guidelines

### Before Submitting

- [ ] Code follows existing style
- [ ] No personal data or hardcoded credentials
- [ ] Feature works with default OpenClaw setup
- [ ] Documentation updated (if needed)
- [ ] No console errors or warnings
- [ ] Tested on latest Node.js LTS

### PR Description

Include:

1. **What** does this PR do?
2. **Why** is this change needed?
3. **How** did you implement it?
4. **Testing** steps to verify it works
5. **Screenshots** (for UI changes)

Example:

```markdown
## What
Adds a dark/light theme toggle

## Why
Users requested the ability to switch themes

## How
- Added theme state to localStorage
- Created CSS variables for both themes
- Added toggle button in header

## Testing
1. Click theme toggle in header
2. Verify theme switches
3. Reload page - theme persists

## Screenshots
[Before/After images]
```

## Reporting Issues

### Bug Reports

Use the [Bug Report template](https://github.com/openclaw/command-bridge/issues/new?template=bug_report.md) and include:

- **Version**: Command Bridge version, Node.js version, OS
- **Steps to reproduce**
- **Expected behavior**
- **Actual behavior**
- **Logs/screenshots**

### Feature Requests

Use the [Feature Request template](https://github.com/openclaw/command-bridge/issues/new?template=feature_request.md) and include:

- **Use case**: What problem does this solve?
- **Proposed solution**: How should it work?
- **Alternatives**: Other ways to solve this?

## Code of Conduct

Be respectful and constructive. We're all here to build something useful.

- **Be kind** to other contributors
- **Assume good intent**
- **Focus on the code**, not the person
- **Help newcomers**

## Questions?

- **GitHub Issues**: For bugs and features
- **GitHub Discussions**: For questions and ideas

---

Thanks for contributing! 🦝
