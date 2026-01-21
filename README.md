# Quikim CLI

Command-line interface for managing Quikim projects and running the MCP server for Cursor IDE integration.

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

# 2. Connect to a project
quikim connect

# 3. Configure Cursor IDE (one-time setup)
quikim mcp install-cursor

# 4. Restart Cursor - Quikim tools are now available!
```

## Commands

### Authentication

| Command         | Description              |
| --------------- | ------------------------ |
| `quikim login`  | Authenticate with Quikim |
| `quikim logout` | Clear authentication     |
| `quikim whoami` | Show current user        |


### Project Management

| Command                     | Description                            |
| --------------------------- | -------------------------------------- |
| `quikim connect [project]`  | Connect to a project                   |
| `quikim init`               | Initialize Quikim in current directory |
| `quikim project list`       | List all projects                      |
| `quikim project info`       | Show current project details           |
| `quikim project disconnect` | Disconnect from current project        |


### MCP Server (Cursor Integration)

| Command                       | Description                       |
| ----------------------------- | --------------------------------- |
| `quikim mcp install-cursor`   | Configure MCP server in Cursor    |
| `quikim mcp uninstall-cursor` | Remove MCP server from Cursor     |
| `quikim mcp status`           | Show MCP server status            |
| `quikim mcp serve`            | Start MCP server (used by Cursor) |


### Configuration

| Command                        | Description                   |
| ------------------------------ | ----------------------------- |
| `quikim config show`           | Show current configuration    |
| `quikim config set-local`      | Use local development servers |
| `quikim config set-production` | Use production servers        |
| `quikim config reset`          | Reset all configuration       |


### Status

| Command         | Description                     |
| --------------- | ------------------------------- |
| `quikim status` | Show session and project status |


## How It Works

The CLI integrates with Cursor IDE through the Model Context Protocol (MCP):

```
┌─────────────────────────────────────────────────────────────┐
│                    Developer's Machine                      │
│                                                             │
│  ┌─────────────────┐      ┌────────────────────────────┐    │
│  │   Cursor IDE    │◄────►│   Quikim MCP Server        │    │
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

### MCP Tools Available in Cursor

Once configured, these tools are available in Cursor's AI assistant:

- `push_requirements` / `pull_requirements` - Sync requirements
- `push_hld` / `pull_hld` - Sync high-level designs
- `push_wireframes` / `pull_wireframe` - Sync wireframes
- `push_tasks` / `pull_tasks` - Sync tasks
- `er_diagram_push` / `er_diagram_pull` - Sync ER diagrams
- `update_code` - Get code guidelines and snippets via RAG
- `pull_rules` - Update Cursor rules

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
