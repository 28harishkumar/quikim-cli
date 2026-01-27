# Quikim CLI

Command-line interface for managing Quikim projects and running the MCP server for IDE integration (Cursor, Kiro, Windsurf, Zed, VS Code, Claude Code).

## Installation

```bash
npm install -g @quikim/cli
```

Or install from source:

```bash
cd cli
npm install
npm run build
npm link
```

## Quick Start

```bash
# 1. Authenticate with Quikim
quikim login

# 2. Initialize Quikim (installs IDE rules & connects to project)
quikim init

# 3. Configure MCP Server (one-time setup)
# For Cursor:
quikim mcp install-cursor
# For other editors: install-kiro, install-windsurf, install-zed, install-vscode, install-claude-code

# 4. Restart your IDE - Quikim tools are now available!

# 5. (Optional) Migrate existing artifacts to new structure
quikim migrate-artifacts --from-version-dirs

# 6. Sync artifacts with server
quikim artifacts pull  # Download latest from server
quikim artifacts push  # Upload local changes to server
quikim artifacts sync  # Push then pull (full sync)
```

**Note:** `quikim init` automatically detects your IDE (Cursor, Kiro, Windsurf, VS Code, Zed, or Claude Code) and installs the appropriate cursor rules. Use `quikim init --all` to install rules for all supported IDEs.

## Commands

### Authentication

| Command         | Description              |
| --------------- | ------------------------ |
| `quikim login`  | Authenticate with Quikim |
| `quikim logout` | Clear authentication     |
| `quikim whoami` | Show current user        |


### Project Management

| Command                     | Description                                              |
| --------------------------- | -------------------------------------------------------- |
| `quikim connect [project]`  | Connect to a project                                     |
| `quikim init`               | Initialize Quikim (install IDE rules & connect project)  |
| `quikim init --all`         | Initialize with rules for all supported IDEs             |
| `quikim init --force`       | Force overwrite existing IDE rules                       |
| `quikim project list`       | List all projects                                        |
| `quikim project info`       | Show current project details                             |
| `quikim project disconnect` | Disconnect from current project                          |


### IDE Rules Management

| Command                  | Description                               |
| ------------------------ | ----------------------------------------- |
| `quikim rules install`   | Install IDE cursor rules (detected IDEs)  |
| `quikim rules install --all` | Install rules for all supported IDEs  |
| `quikim rules install --force` | Force overwrite existing rules      |
| `quikim rules check`     | Check which IDE rules are installed       |
| `quikim rules list`      | List all supported IDEs                   |


### MCP Server (IDE Integration)

| Command                          | Description                              |
| -------------------------------- | ---------------------------------------- |
| `quikim mcp install-cursor`      | Configure MCP server in Cursor           |
| `quikim mcp install-kiro`        | Configure MCP server in Kiro             |
| `quikim mcp install-windsurf`    | Configure MCP server in Windsurf         |
| `quikim mcp install-zed`         | Configure MCP server in Zed              |
| `quikim mcp install-vscode`      | Configure MCP server in VS Code          |
| `quikim mcp install-claude-code` | Configure MCP server in Claude Code      |
| `quikim mcp uninstall-<editor>`  | Remove MCP server from specified editor |
| `quikim mcp status`              | Show MCP server status for all editors  |
| `quikim mcp serve`               | Start MCP server (used by all editors)  |


### Configuration

| Command                        | Description                   |
| ------------------------------ | ----------------------------- |
| `quikim config show`           | Show current configuration    |
| `quikim config set-local`      | Use local development servers |
| `quikim config set-production` | Use production servers        |
| `quikim config reset`          | Reset all configuration       |


### Artifact Management

| Command                                        | Description                                                      |
| -----------------------------------------------| ---------------------------------------------------------------- |
| `quikim <artifact_type> <push\|pull\|sync>`    | Sync a specific artifact type (requirement, hld, lld, etc.)     |
| `quikim artifacts <push\|pull\|sync>`          | Sync all artifacts                                               |
| `quikim spec <spec_name> <push\|pull\|sync>`   | Sync all artifacts for a specific spec (e.g., "payment-module") |
| `quikim migrate-artifacts --from-version-dirs` | Migrate from old `.quikim/v*/` to new `.quikim/artifacts/` structure |

**Artifact Types:**
- `requirement` - Requirements documents
- `context` - Project context
- `code_guideline` - Code guidelines
- `hld` - High-level designs
- `lld` - Low-level designs
- `wireframe_files` - Wireframes
- `flow_diagram` - Flow diagrams (ER diagrams)
- `tasks` - Task lists

**Examples:**
```bash
# Push all requirements to server
quikim requirement push

# Pull all artifacts for a specific spec
quikim spec payment-module pull

# Sync all artifacts (push then pull)
quikim artifacts sync

# Push with filters
quikim requirement push --spec payment-module --name auth-requirements

# Dry run to see what would happen
quikim artifacts push --dry-run
```

**Options:**
- `--spec <name>` - Filter by spec name
- `--name <name>` - Filter by artifact name
- `--dry-run` - Show what would be done without making changes
- `--force` - Force operation even if no changes detected
- `--verbose` - Show detailed output

### Status

| Command         | Description                     |
| --------------- | ------------------------------- |
| `quikim status` | Show session and project status |


## Supported IDEs

Quikim automatically installs cursor rules for detected IDEs during `quikim init`:

| IDE                  | Rules Location                | Auto-detected |
| -------------------- | ----------------------------- | ------------- |
| Cursor               | `.cursor/rules/quikim.mdc`    | ✓             |
| Windsurf (Codeium)   | `.windsurfrules/quikim.md`    | ✓             |
| Kiro                 | `.kiro/steering/quikim.md`    | ✓             |
| VS Code              | `.vscode/rules/quikim.md`     | ✓             |
| Zed                  | `.zed/rules/quikim.md`        | ✓             |
| Claude Code          | `.claude/rules/quikim.md`     | ✓             |

### Manual IDE Rules Installation

If you want to manually manage IDE rules:

```bash
# Install rules for detected IDEs only
quikim rules install

# Install rules for all supported IDEs
quikim rules install --all

# Force overwrite existing rules
quikim rules install --force

# Check installation status
quikim rules check

# List all supported IDEs
quikim rules list
```


## How It Works

The CLI integrates with supported IDEs through the Model Context Protocol (MCP):

```
┌─────────────────────────────────────────────────────────────┐
│                    Developer's Machine                      │
│                                                             │
│  ┌─────────────────┐      ┌────────────────────────────┐    │
│  │   Your IDE      │◄────►│   Quikim MCP Server        │    │
│  │  (MCP Host)     │      │   (quikim mcp serve)       │    │
│  └─────────────────┘      │                            │    │
│                           │  Uses CLI's stored auth    │    │
│                           │  token automatically       │    │
│                           └──────────────┬─────────────┘    │
└──────────────────────────────────────────┼──────────────────┘
                                           │ HTTPS
                                           ▼
                          ┌────────────────────────────────┐
                          │      Quikim Platform Server    │
                          │  (api.quikim.com or local)     │
                          └────────────────────────────────┘
```

### MCP Tools Available in Supported IDEs

Once configured, these tools are available in your IDE's AI assistant:

**Artifact Sync Tools:**
- `push_requirements` / `pull_requirements` - Sync requirements
- `push_hld` / `pull_hld` - Sync high-level designs
- `push_lld` / `pull_lld` - Sync low-level designs
- `push_wireframes` / `pull_wireframe` - Sync wireframes
- `push_tasks` / `pull_tasks` - Sync tasks
- `er_diagram_push` / `er_diagram_pull` - Sync ER diagrams
- `push_code_guideline` / `pull_code_guideline` - Sync code guidelines
- `push_context` / `pull_context` - Sync project context

**Other Tools:**
- `update_code` - Get code guidelines and snippets via RAG
- `pull_rules` - Update Cursor rules

**Note:** MCP tools use the same underlying sync service as CLI commands, ensuring consistency between CLI and IDE workflows.

## Configuration

### Local Development

For local development with separate services:

```bash
quikim config set-local
```

This configures:
- User service: `http://localhost:8001`
- Project service: `http://localhost:8002`

### Production

For production (default):

```bash
quikim config set-production
```

This uses: `https://api.quikim.com`

### Config File Location

The CLI stores configuration in:
- macOS/Linux: `~/.config/quikim-cli/config.json`
- Windows: `%APPDATA%/quikim-cli/config.json`

## Project Configuration

When you connect to a project, the CLI creates `.quikim/project.json` in your project directory:

```json
{
  "projectId": "proj_xxx",
  "organizationId": "org_xxx",
  "userId": "user_xxx",
  "name": "My Project",
  "slug": "my-project",
  "latestVersion": 1,
  "connectedAt": "2026-01-21T00:00:00.000Z"
}
```

This file is read by the MCP server to know which project to sync with.

## Artifact Directory Structure

Artifacts are stored locally in `.quikim/artifacts/` with the following structure:

```
.quikim/
├── project.json
└── artifacts/
    └── <spec_name>/
        ├── requirement_<artifact_name>.md
        ├── context_<artifact_name>.md
        ├── code_guideline_<artifact_name>.md
        ├── hld_<artifact_name>.md
        ├── lld_<artifact_name>.md
        ├── wireframe_files_<artifact_name>.md
        ├── flow_diagram_<artifact_name>.md
        └── tasks_<artifact_name>.md
```

**Key Points:**
- Each spec (e.g., "payment-module", "auth-service") has its own directory
- Artifacts are named as `<type>_<name>.md`
- Only the latest version is stored locally
- Version history is maintained on the server
- Default spec name is "default" if not specified

**Migration from Old Structure:**

If you have artifacts in the old `.quikim/v*/` structure, run:

```bash
quikim migrate-artifacts --from-version-dirs
```

This will automatically migrate your artifacts to the new structure.

## Environment Variables

| Variable              | Description                   |
| --------------------- | ----------------------------- |
| `QUIKIM_API_BASE_URL` | Override API base URL         |
| `QUIKIM_API_KEY`      | Override authentication token |


## Requirements

- Node.js >= 18.0.0

## Contributing

This project requires a Contributor License Agreement (CLA).
By submitting a pull request, you agree to the CLA.

## License

This project is licensed under the AGPL-3.0.
AGPL-3.0 - See [LICENSE](../LICENSE) for details.

For commercial use without AGPL obligations (including
offering proprietary SaaS or closed-source modifications),
a commercial license is available.

Contact: admin@quikim.com

Copyright (c) 2026 Quikim Inc.
