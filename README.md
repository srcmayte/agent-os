<img width="1280" height="640" alt="agent-os-og" src="https://github.com/user-attachments/assets/f70671a2-66e8-4c80-8998-d4318af55d10" />

## Your system for spec-driven agentic development.

[Agent OS](https://buildermethods.com/agent-os) transforms AI coding agents from confused interns into productive developers. With structured workflows that capture your standards, your stack, and the unique details of your codebase, Agent OS gives your agents the specs they need to ship quality code on the first try—not the fifth.

Use it with:

✅ Claude Code, Cursor, or any other AI coding tool.

✅ New products or established codebases.

✅ Big features, small fixes, or anything in between.

✅ Any language or framework.

---

## Quick Start

### Prerequisites

- Node.js 18 or higher
- npm

### Installation

#### Via npm (recommended)

```bash
# Install globally
npm install -g agent-os

# Or use npx (no installation required)
npx agent-os --help
```

#### From source

```bash
# Clone the repository
git clone https://github.com/srcmayte/agent-os.git
cd agent-os

# Install dependencies
npm install

# Build the CLI
npm run build

# Link globally (optional)
npm link
```

### Base Installation

```bash
# Install Agent OS to ~/agent-os
agent-os install
```

### Project Setup

```bash
# Navigate to your project
cd /path/to/your/project

# Set up Agent OS in the project
agent-os project setup
```

---

## CLI Commands

### `agent-os install`

Installs Agent OS base installation to `~/agent-os`. Downloads profiles, workflows, and standards from the repository.

```bash
agent-os install [options]

Options:
  -v, --verbose    Show verbose output
```

Aliases: `init`, `setup`

### `agent-os project setup`

Sets up Agent OS in the current project directory.

```bash
agent-os project setup [options]

Options:
  --profile <profile>                Use specified profile
  --claude-code-commands [bool]      Install Claude Code commands
  --use-claude-code-subagents [bool] Use Claude Code subagents
  --agent-os-commands [bool]         Install agent-os commands
  --re-install                       Delete and reinstall Agent OS
  --overwrite-all                    Overwrite all existing files
  --dry-run                          Show what would be done without doing it
  -v, --verbose                      Show detailed output
```

Aliases: `install`, `init`

### `agent-os project sync`

Syncs/updates project files (standards, commands, agents) from the currently selected profile.

```bash
agent-os project sync [options]

Options:
  --profile <profile>                Use specified profile
  --overwrite-all                    Overwrite all existing files
  --overwrite-standards              Overwrite existing standards
  --overwrite-commands               Overwrite existing commands
  --overwrite-agents                 Overwrite existing agents
  --dry-run                          Show what would be done without doing it
  -v, --verbose                      Show detailed output
```

Aliases: `update`, `refresh`

### `agent-os profile create`

Creates a new Agent OS profile.

```bash
agent-os profile create [options]

Options:
  -n, --name <name>              Profile name
  -i, --inherits-from <profile>  Inherit from existing profile
  -c, --copy-from <profile>      Copy from existing profile
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AGENT_OS_REPO_URL` | Repository URL for installation | `https://github.com/srcmayte/agent-os` |
| `AGENT_OS_MAX_BACKUPS` | Maximum number of backups to keep | `10` |

---

## Development

### Setup

```bash
npm install
npm run build
```

### Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Build TypeScript to JavaScript |
| `npm run dev` | Run CLI with tsx (development) |
| `npm test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint issues |
| `npm run format` | Format code with Prettier |
| `npm run typecheck` | Run TypeScript type checking |

### Project Structure

```
src/
├── commands/           # CLI command handlers
│   ├── base/             # Base installation commands
│   │   ├── index.ts        # Base command exports
│   │   ├── install.ts      # Base install command
│   │   └── shared.ts       # Shared utilities
│   ├── profile/          # Profile commands
│   │   ├── index.ts        # Profile command group
│   │   └── create.ts       # Profile create command
│   ├── project/          # Project commands directory
│   │   ├── index.ts        # Project command group
│   │   ├── setup.ts        # Project setup command
│   │   ├── sync.ts         # Project sync command
│   │   └── shared.ts       # Shared utilities
│   └── index.ts          # Command exports
├── lib/                # Core business logic
│   ├── config.ts         # Configuration management
│   ├── installer.ts      # File installation logic
│   ├── profile.ts        # Profile loading and inheritance
│   ├── template.ts       # Template processing
│   └── index.ts          # Library exports
├── utils/              # Utility functions
│   ├── backup.ts         # Backup management
│   ├── filesystem.ts     # File operations
│   ├── output.ts         # Console output helpers
│   ├── yaml.ts           # YAML parsing
│   └── index.ts          # Utility exports
├── types/              # TypeScript interfaces
│   └── index.ts          # Type definitions
└── index.ts            # CLI entry point

tests/
├── e2e/                # End-to-end tests
│   └── cli.e2e.test.ts
└── integration/        # Integration tests
    └── project-install.integration.test.ts
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- --testPathPattern=backup

# Run in watch mode
npm run test:watch
```

---

## Documentation & Installation

Docs, installation, usage, & best practices 👉 [It's all here](https://buildermethods.com/agent-os)

---

## Follow updates & releases

Read the [changelog](CHANGELOG.md)

[Subscribe to be notified of major new releases of Agent OS](https://buildermethods.com/agent-os)

---

## Originally Created by Brian Casel @ Builder Methods

Originally created by Brian Casel, the creator of [Builder Methods](https://buildermethods.com), where Brian helps professional software developers and teams build with AI.

Get Brian's free resources on building with AI:
- [Builder Briefing newsletter](https://buildermethods.com)
- [YouTube](https://youtube.com/@briancasel)

Join [Builder Methods Pro](https://buildermethods.com/pro) for official support and connect with our community of AI-first builders.

---

## TypeScript CLI Fork

This fork by Steve Clarke converts the original shell scripts to a modern TypeScript CLI using commander.js, with comprehensive test coverage and full feature parity.
