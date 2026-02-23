# Quikim CLI

Command-line interface for managing Quikim projects and running the MCP server for IDE integration (Cursor, Kiro, Windsurf, Zed, VS Code, Claude Code, Claude Desktop).

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
# For other editors: install-kiro, install-windsurf, install-zed, install-vscode, install-claude-code, install-claude-desktop

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

| Command                             | Description                                                                                     |
| ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| `quikim mcp install-cursor`         | Configure MCP server in Cursor                                                                  |
| `quikim mcp install-kiro`           | Configure MCP server in Kiro                                                                    |
| `quikim mcp install-windsurf`       | Configure MCP server in Windsurf                                                                |
| `quikim mcp install-zed`            | Configure MCP server in Zed                                                                     |
| `quikim mcp install-vscode`         | Configure MCP server in VS Code                                                                 |
| `quikim mcp install-claude-code`    | Configure MCP server in Claude Code                                                             |
| `quikim mcp install-claude-desktop` | Configure MCP server in Claude Desktop app (writes auth token and project dir to config env)    |
| `quikim mcp install-claude-local`   | Configure Claude Desktop in **local-only mode** — no Quikim account or internet required        |
| `quikim mcp uninstall-<editor>`     | Remove MCP server from the specified editor                                                     |
| `quikim mcp status`                 | Show MCP server status and configuration for all editors                                        |
| `quikim mcp serve`                  | Start MCP server (used internally by all editors)                                               |

#### Local-Only Mode (No Account Required)

`quikim mcp install-claude-local` sets up Claude Desktop to use Quikim's MCP tools without a Quikim account or internet connection. Artifacts are saved only to `.quikim/` in your project directory.

```bash
# Run from your project root
quikim mcp install-claude-local

# Or specify a project directory and name
quikim mcp install-claude-local --project-dir /path/to/project --project-name "My App"

# Force overwrite existing config
quikim mcp install-claude-local --force
```

What works in local mode:
- ✅ All `generate_*` tools (requirements, hld, lld, tasks, mermaid, wireframes, context)
- ✅ All `pull_*` tools (reads from local `.quikim/` files)
- ✅ All `local_*` filesystem tools and git tools
- ✅ Plan file management
- ⚠️ `pull_*` with `force: true` — requires server, fails gracefully
- ⚠️ Workflow/queue tools — require server, return a friendly error

#### Options for `install-claude-desktop` and `install-claude-local`

| Option                    | Description                                           |
| ------------------------- | ----------------------------------------------------- |
| `-f, --force`             | Overwrite existing configuration                      |
| `--project-dir <path>`    | Project root path (default: current directory)        |
| `--project-name <name>`   | Display name for local project (local mode only)      |

All other `install-*` commands support `-f, --force` to overwrite existing configuration.


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
| `quikim edit <type> <identifier>`              | Edit an artifact's name and/or spec name                         |
| `quikim migrate-artifacts --from-version-dirs` | Migrate from old `.quikim/v*/` to new `.quikim/artifacts/` structure |

**Artifact Types:**
- `requirement` - Requirements documents
- `context` - Project context
- `code_guideline` - Code guidelines
- `hld` - High-level designs
- `lld` - Low-level designs
- `wireframe_files` - Wireframes
- `flow_diagram` - Flow diagrams (Mermaid)
- `er_diagram` - Entity-relationship diagrams
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

# Edit artifact metadata (rename or move to a different spec)
quikim edit requirement auth-requirements --name new-auth-reqs --spec core
```

**Options:**
- `--spec <n>` - Filter by spec name
- `--name <n>` - Filter by artifact name
- `--dry-run` - Show what would be done without making changes
- `--force` - Force operation even if no changes detected
- `--verbose` - Show detailed output

For `quikim spec <spec_name> <operation>`:
- `--type <type>` - Filter by artifact type within the spec


### Wireframe Management

Direct wireframe operations against the Quikim server (requires authentication and a connected project).

| Command                                          | Description                                           |
| ------------------------------------------------ | ----------------------------------------------------- |
| `quikim wireframe list`                          | List all wireframes for the connected project         |
| `quikim wireframe download --wireframe-id <id>`  | Download a wireframe by ID to a local JSON file       |
| `quikim wireframe update --wireframe-id <id>`    | Update wireframe name and/or content via file         |
| `quikim wireframe modify --wireframe-id <id> --prompt <text>` | Modify a wireframe using an LLM prompt |

```bash
# List wireframes
quikim wireframe list
quikim wireframe list --json

# Download a wireframe
quikim wireframe download --wireframe-id abc123
quikim wireframe download --wireframe-id abc123 --output ./my-wireframe.json

# Update wireframe name or content
quikim wireframe update --wireframe-id abc123 --name "New Name"
quikim wireframe update --wireframe-id abc123 --file ./updated-wireframe.json

# Modify wireframe with an LLM prompt
quikim wireframe modify --wireframe-id abc123 --prompt "Add a search bar to the header"
```

**Options (all wireframe subcommands):**
- `--org-id <id>` - Organization ID (overrides current session)
- `--project-id <id>` - Project ID (overrides connected project)


### Test Artifact Management

| Command            | Description                                                          |
| ------------------ | -------------------------------------------------------------------- |
| `quikim test sync` | Pull test artifacts from server to `.quikim/artifacts/<spec>/tests_*.md` |

```bash
# Sync all tests for the default spec
quikim test sync

# Sync tests for a specific spec
quikim test sync --spec payment-module

# Output test list as JSON (no files written)
quikim test sync --json

# Override project ID
quikim test sync --project-id proj_abc123
```


### Status

| Command                | Description                          |
| ---------------------- | ------------------------------------ |
| `quikim status`        | Show current session and project status |
| `quikim status --json` | Output status as JSON                |


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

**Artifact Generation & Sync Tools:**
- `generate_requirements` / `pull_requirements` — Generate and sync requirements
- `generate_hld` / `pull_hld` — Generate and sync high-level designs
- `generate_lld` / `pull_lld` — Generate and sync low-level designs
- `generate_wireframes` / `pull_wireframe` — Generate and sync wireframes
- `generate_tasks` / `pull_tasks` — Generate and sync tasks
- `generate_mermaid` / `pull_mermaid` — Generate and sync flow diagrams
- `er_diagram_push` / `er_diagram_pull` — Sync ER diagrams
- `generate_code_guideline` / `pull_code_guideline` — Sync code guidelines
- `generate_context` / `pull_context` — Sync project context
- `generate_tests` / `pull_tests` — Sync test artifacts

**Workflow Tools:**
- `get_workflow_instruction` — Get the next step in the workflow
- `report_workflow_progress` — Advance workflow state after generating an artifact
- `get_skill` / `pull_skills` — Read skill instructions for workflow nodes
- `skip_workflow_step` — Skip an optional workflow step
- `get_llm_queue` / `poll_queue` / `update_queue_item` / `complete_queue_task` — LLM generation queue

**Codebase & File Tools:**
- `local_list_directory` / `local_read_file` / `local_write_file` / `local_str_replace` / `local_delete_file` — Local filesystem operations
- `cloud_list_directory` / `cloud_read_file` / `cloud_search_codebase` / `cloud_get_ast` — Cloud workspace operations
- `local_search_codebase` — Search local codebase with ripgrep
- `parse_codebase_ast` — Parse local codebase into AST summaries
- `update_code` — Get code guidelines and snippets via RAG

**Git Worktree Tools:**
- `git_worktree_list` / `git_worktree_add` / `git_worktree_remove` — Manage git worktrees
- `git_worktree_status` / `git_worktree_commit` / `git_worktree_diff` — Worktree operations
- `git_worktree_set_active` / `git_worktree_get_active` — Active worktree management
- `git_merge_to_dev` / `git_merge_dev_to_main` — Branch merging
- `git_log` / `git_show` / `git_blame` / `git_diff` — Git history and diffs

**Project & Planning Tools:**
- `pull_rules` — Update IDE rules
- `save_plan_file` / `read_plan_file` / `list_plan_files` / `delete_plan_file` — Plan document management
- `get_working_directory` / `list_working_directory` — Workspace info
- `bash_exec` — Run shell commands

**Change Tracking Tools:**
- `detect_change` / `analyze_impact` / `generate_propagation_plan` / `execute_propagation` — Change impact analysis
- `acquire_lock` / `release_lock` — Artifact locking for concurrent edits

**Note:** All MCP tools use the same underlying sync service as CLI commands, ensuring consistency between CLI and IDE workflows.


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
        ├── er_diagram_<artifact_name>.md
        ├── tasks_<artifact_name>.md
        └── tests_<artifact_id>.md
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

| Variable                      | Description                              |
| ----------------------------- | ---------------------------------------- |
| `QUIKIM_API_BASE_URL`         | Override API base URL                    |
| `QUIKIM_API_KEY`              | Override authentication token            |
| `QUIKIM_PROJECT_DIR`          | Override project root directory (MCP)    |
| `QUIKIM_LOCAL_ONLY`           | Set to `1` to disable all server calls   |
| `QUIKIM_WORKFLOW_SERVICE_URL` | Override workflow service URL (local dev)|
| `QUIKIM_MCP_SILENT`           | Set to `1` to suppress MCP startup logs  |


## Requirements

- Node.js >= 18.0.0

## Development

```bash
# Build
npm run build

# Watch mode
npm run dev

# Start MCP server directly
npm run mcp

# Inspect MCP tools interactively
npm run mcp-inspector

# Run tests
npm test

# Lint
npm run lint

# Clean build output
npm run clean
```

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

Copyright (c) 2026 Quikim Pvt. Ltd.
