---
alwaysApply: true
---

# Quikim MCP Server Integration Rules

You are an AI assistant that integrates with the Quikim MCP Server. Your role is to analyze user prompts, determine which Quikim tool to use, and execute the server's instructions.

## Introduction

The Quikim MCP Server provides tools for managing project artifacts (requirements, HLD, wireframes, ER diagrams, tasks) and code updates. Cursor decides which tool to call based on the user's prompt and project state. The server returns instructions, relevant files, code guidelines, and sample snippets.

**Key Principles:**

- Cursor decides which tool to call (not the server)
- Server returns instructions, files, guidelines, and snippets
- Execute instructions immediately without user confirmation
- Quikim MCP server is not required in chat mode (only in agent mode)

## Core Workflow

1. **AUTOMATIC_MCP_DETECTION**: When user provides any prompt in agent mode, automatically detect if Quikim MCP integration is needed
2. **TOOL_SELECTION**: Analyze user prompt and project state to determine which Quikim tool to call
3. **QUIKIM_CONTEXT_GATHERING**: Check for `.quikim/` directory and read relevant files based on selected tool
4. **MCP_TOOL_CALL**:
   - Call the appropriate Quikim MCP tool with relevant context
   - Receive XML response with instructions, files, guidelines, and snippets
   - Execute instructions immediately without user confirmation
   - If server requests more information, call tool again with updated context
   - Continue until server responds with action="complete"
5. **FINAL_RESPONSE**: When server sends action="complete", present the final response to user

## Quikim Directory Structure and Rules

### Directory Structure

```
.quikim/
├── v1/
│   ├── requirements.md
│   ├── hld.md
│   ├── lld/
│   │   ├── auth-service.md
│   │   ├── payment-module.md
│   │   └── user-api.md
│   ├── wireframes.md
│   ├── er-diagram.md
│   ├── tasks.md
│   └── diagrams/
│       ├── flowchart.md
│       └── sequence.md
├── v2/
│   ├── requirements.md
│   ├── hld.md
│   ├── lld/
│   │   └── auth-service.md
│   └── tasks.md
└── v3/
    └── requirements.md
```

### Versioning Rules

- Each version is a directory: `.quikim/v1/`, `.quikim/v2/`, etc.
- All artifacts for a version go in the same version directory
- Version numbers are consistent across all artifacts
- When updating ANY artifact, create new version directory
- All artifacts are stored in version directories: `.quikim/v*/requirements.md`, `.quikim/v*/hld.md`, `.quikim/v*/wireframes.md`, `.quikim/v*/er-diagram.md`, `.quikim/v*/tasks.md`

### File Selection Rules

**Only include relevant .quikim/ files based on the tool being called:**

- **Pull Requirements / Push Requirements**: Latest version `requirements.md` (and previous version if updating)
- **Pull HLD / Push HLD**: Latest version `requirements.md` (dependency) + latest version `hld.md` (and previous if updating)
- **Pull LLD / Push LLD**: Latest version `requirements.md` + `hld.md` (dependencies) + latest version `lld/*.md` files (if updating)
- **Pull wireframe / Push wireframes**: Latest version `requirements.md` + `hld.md` (dependencies) + latest version `wireframes.md` (if updating)
- **ER diagram pull / ER diagram push**: Latest version `requirements.md` + `hld.md` + `wireframes.md` (if exists) + latest version `er-diagram.md` (if updating)
- **Pull Tasks / Push Tasks**: Latest version `requirements.md` + `hld.md` + `wireframes.md` (if exists) + `er-diagram.md` (if exists) + latest version `tasks.md` (if updating)
- **Update code**: Latest version `requirements.md` + `hld.md` + `lld/*.md` (if exists) + `tasks.md` + Prisma schema + relevant source code files
- **Pull rules**: No .quikim/ files needed

## Quikim Tools

The MCP server provides the following tools:

### 1. Push Requirements

- **Purpose**: Update requirements on server from local requirements
- **When to use**: After creating/updating requirements locally
- **Returns**: Success confirmation

### 2. Pull Requirements

- **Purpose**: Fetch all requirements from server
- **When to use**: When user requests requirements or needs to sync from server
- **Returns**:
  - Update files as given, OR
  - Analyze and create/update requirement files, then ask user if requirement should be updated or proceed to design

### 3. Push HLD

- **Purpose**: Update high-level designs at server from local designs
- **When to use**: After creating/updating HLD locally
- **Returns**: Success confirmation

### 4. Pull HLD

- **Purpose**: Update local HLD from server high-level designs
- **When to use**: When user requests HLD or needs to sync from server
- **Returns**:
  - Update files as given, OR
  - Analyze and create/update HLD files, then ask user if HLD should be updated further or proceed to wireframe

### 5. Pull LLD

- **Purpose**: Fetch or generate Low-Level Design (LLD) for a specific component
- **When to use**: 
  - After HLD is complete and before implementation
  - When detailed component specifications are needed
  - Before implementing complex services, modules, or APIs
- **Component Types**: service, module, feature, api, ui, database
- **Returns**:
  - List of existing LLDs if no component specified
  - Detailed LLD template with sections for interfaces, data models, methods, sequence diagrams
- **File Structure**: `.quikim/v*/lld/{component-name}.md`
- **Example prompts**:
  - "Create LLD for authentication service"
  - "Generate low-level design for payment module"
  - "Pull LLD for user management API"

### 6. Push LLD

- **Purpose**: Sync local LLD files to server
- **When to use**: After creating/updating LLD locally
- **Returns**: Success confirmation with synced components list

### 7. Pull wireframe

- **Purpose**: Update local wireframes from server
- **When to use**: When user requests wireframes or needs to sync from server
- **Returns**:
  - Update files as given, OR
  - Analyze and create/update wireframe files, then ask user if wireframe should be updated further or proceed to tasks

### 8. Push wireframes

- **Purpose**: Update server wireframes from local and sync to Penpot
- **When to use**: After creating/updating wireframes locally
- **Returns**: Success confirmation with Penpot file URL

### 9. Sync wireframe from Penpot

- **Purpose**: Pull latest wireframe changes from Penpot back to Quikim
- **When to use**: 
  - After user modifies design in Penpot
  - Before generating code to ensure latest design
  - During design iteration cycles
- **Prerequisites**: Wireframe must be pushed to Penpot first
- **Returns**: Updated wireframe files with new version and change summary

### 10. Generate code from wireframe

- **Purpose**: Convert wireframe to production-ready React components
- **When to use**:
  - After wireframe is finalized
  - When ready to start development
  - To update code after design changes
- **Prerequisites**: Wireframe must exist, framework and styling preferences configured
- **Returns**: Generated React component files with integration instructions

### 11. List Penpot syncs

- **Purpose**: Show all Penpot sync states for project
- **When to use**:
  - To check sync status
  - To see which wireframes are synced
  - To identify conflicts or pending syncs
- **Returns**: List of sync states with status and last sync time

### 12. Push Tasks

- **Purpose**: Update tasks at server from local tasks
- **When to use**: After creating/updating tasks locally
- **Returns**: Success confirmation

### 13. Pull Tasks

- **Purpose**: Update local tasks from server tasks
- **When to use**: When user requests tasks or needs to sync from server
- **Returns**:
  - Update files as given, OR
  - Analyze and create/update task files, then ask user if tasks should be updated further or proceed to code modification

### 14. Update code

- **Purpose**: Take local code context to MCP server, server uses RAG pipeline to find relevant code snippets
- **When to use**: When user requests code implementation or modification
- **Returns**:
  - Code snippets
  - Code guidelines
  - Instructions to update code and task files

### 15. ER diagram pull

- **Purpose**: Update local ER diagram from server
- **When to use**: When user requests ER diagram or needs to sync from server
- **Returns**:
  - Update files as given, OR
  - Analyze and create/update ER diagram (mermaid) files, then ask user if ER diagram should be updated further or proceed to update/create Prisma database

### 16. ER diagram push

- **Purpose**: Push local ER diagram to server
- **When to use**: After creating/updating ER diagram locally
- **Returns**: Success confirmation

### 17. Pull rules

- **Purpose**: Update local Quikim cursor rules files
- **When to use**: When user requests rules sync or needs to update cursor rules
- **Returns**: Success confirmation

### 18. Pull mermaid

- **Purpose**: Fetch mermaid diagrams from server
- **When to use**: When user requests mermaid diagrams or needs to sync diagram artifacts
- **Diagram types supported**:
  - flowchart: Process flows and decision trees
  - sequence: Component interactions over time
  - classDiagram: Object-oriented structure
  - stateDiagram: State transitions
  - erDiagram: Database entity relationships
  - gantt: Project timelines
  - pie: Data distribution
  - mindmap: Hierarchical ideas
  - timeline: Chronological events
  - journey: User experience flows
- **Returns**:
  - Update files as given, OR
  - Create diagram files in `.quikim/v*/diagrams/` directory

### 19. Push mermaid

- **Purpose**: Push local mermaid diagrams to server
- **When to use**: After creating/updating mermaid diagrams locally
- **What it syncs**:
  - Dedicated diagram files in `.quikim/v*/diagrams/`
  - Embedded mermaid blocks from HLD and ER diagram files
- **Returns**: Success confirmation with sync results for each diagram

## Which Tool to Hit

**Decision Flow (Cursor checks files first, then decides which tool to use):**

**CRITICAL: After creating any artifact file, immediately re-check the file system before making the next tool call. Do NOT call the same pull tool again if the file was just created.**

1. **Check Requirements File First**:

   - Read `.quikim/v*/requirements.md` from latest version
   - **If requirements file exists and has content** → Proceed to step 2 (check HLD) - DO NOT call `pull_requirements` again
   - **If requirements file is missing or outdated** → Use `pull_requirements` tool
   - **After creating/updating requirements.md**: Immediately proceed to step 2 (check HLD) - DO NOT call `pull_requirements` again
   - Requirements must exist and have content before proceeding

2. **Check HLD File** (only if requirements exist and complete):

   - Read `.quikim/v*/hld.md` from latest version
   - **If HLD file exists and is up-to-date** → Proceed to step 3 (check other artifacts)
   - **If HLD file is missing or outdated** → Use `pull_hld` tool
     - **After creating/updating hld.md**: Immediately proceed to step 3 (check other artifacts) - DO NOT call `pull_hld` again
   - HLD must exist and be current before wireframes, ER-diagram, or code implementation

3. **Check Wireframes First** (only if requirements and HLD exist and are current):

   - Check wireframes: `.quikim/v*/wireframes.md`
   - **If wireframes file exists and is up-to-date** → Proceed to step 3b (check ER diagram)
   - **If wireframes file is missing or outdated** → Use `pull_wireframe` tool
   - **After creating wireframes.md**: Immediately proceed to step 3b - DO NOT call `pull_wireframe` again

3b. **Check ER Diagram** (only if requirements, HLD, and wireframes exist and are current):

- Check ER diagram: `.quikim/v*/er-diagram.md`
- **If ER diagram file exists and is up-to-date** → Proceed to step 3c (check tasks)
- **If ER diagram file is missing or outdated** → Use `er_diagram_pull` tool
- **After creating er-diagram.md**: Immediately proceed to step 3c - DO NOT call `er_diagram_pull` again

3c. **Check Tasks** (only if requirements, HLD, wireframes, and ER diagram exist and are current):

- Check tasks: `.quikim/v*/tasks.md`
- **If tasks file exists and is up-to-date** → Proceed to step 4 (code implementation)
- **If tasks file is missing or outdated** → Use `pull_tasks` tool
- **After creating tasks.md**: Immediately proceed to step 4 - DO NOT call `pull_tasks` again

4. **Code Implementation** (only if all artifacts exist and are current):
   - Use `update_code` tool for code implementation or modification

**Tool Selection Rules:**

- **New Feature Request**:
  - Check requirements file first → if missing/outdated → use `pull_requirements` tool
  - **After requirements.md is created**: Immediately check HLD → if missing/outdated → use `pull_hld` tool
  - **DO NOT call `pull_requirements` again after creating the file**
- **Code Implementation Request**:
  - Check requirements → if missing/outdated → use `pull_requirements` tool
  - **After requirements exist**: Check HLD → if missing/outdated → use `pull_hld` tool
  - **After HLD exists**: Check wireframes/ER/tasks → if missing/outdated → use appropriate Pull tool
  - If all exist and have content → use `update_code` tool
- **Update Requests**:
  - If user explicitly asks to "update requirements" → use `pull_requirements` or `push_requirements` tool
  - If user explicitly asks to "update HLD" → use `pull_hld` or `push_hld` tool
  - If user explicitly asks to "update code" → use `update_code` tool (after checking all prerequisites)
- **Sync Requests**: Use Pull tools to sync from server, Push tools to sync to server
- **Exception**: Bug fixes can use `update_code` tool directly without checking all prerequisites

## MCP Server Request Structure

### Tool Call Format

Each Quikim tool is called with:

```json
{
  "tool_name": "pull_requirements" | "push_requirements" | "pull_hld" | "push_hld" | "pull_wireframe" | "push_wireframes" | "pull_tasks" | "push_tasks" | "update_code" | "er_diagram_pull" | "er_diagram_push" | "pull_rules",
  "arguments": {
    "codebase": {
      "files": [
        {
          "path": ".quikim/v2/requirements.md",
          "content": "[FILE_CONTENT]"
        }
      ]
    },
    "user_prompt": "[USER'S ORIGINAL PROMPT]",
    "project_context": {
      "latest_version": 2,
      "has_requirements": true,
      "has_hld": true
    }
  }
}
```

### Request ID Management

- Generate unique request IDs: `req_[uuid]`
- Always use the same request_id when responding to a server request
- Track request IDs to prevent loops

## MCP Server Response Structure

The server responds with XML in this format:

```xml
<mcp_response>
    <request_id>[MATCHING_REQUEST_ID]</request_id>
    <action>[ACTION_TYPE]</action>
    <instructions>[DETAILED_INSTRUCTIONS]</instructions>

    <!-- For Pull tools and Update code -->
    <quikim_files>
        <file path=".quikim/v2/requirements.md"><![CDATA[[FILE_CONTENT]]]></file>
        <file path=".quikim/v2/hld.md"><![CDATA[[FILE_CONTENT]]]></file>
    </quikim_files>

    <!-- For Update code tool -->
    <code_guidelines>
        <guideline>[CODING_STANDARD_1]</guideline>
        <guideline>[CODING_STANDARD_2]</guideline>
    </code_guidelines>

    <sample_snippets>
        <snippet>
            <file_path>src/auth/index.ts</file_path>
            <content><![CDATA[[CODE_SNIPPET]]]></content>
            <description>[SNIPPET_DESCRIPTION]</description>
        </snippet>
    </sample_snippets>

    <parameters>
        <files>[file1.js,file2.py]</files>
        <command>[COMMAND_TO_RUN]</command>
        <content>[FILE_CONTENT_TO_WRITE]</content>
        <file_path>[PATH_FOR_NEW_FILE]</file_path>
    </parameters>

    <reasoning>[WHY_THIS_ACTION_WAS_CHOSEN]</reasoning>
    <final_response>[RESPONSE_FOR_USER_WHEN_ACTION_IS_COMPLETE]</final_response>
</mcp_response>
```

**Response Components:**

- **quikim_files**: Relevant .quikim/ files returned by Pull tools or Update code tool
- **code_guidelines**: Coding standards and guidelines (for Update code tool)
- **sample_snippets**: Relevant code snippets from RAG pipeline (for Update code tool)
- **instructions**: What to do with the files/guidelines/snippets
- **action**: `read_files`, `create_file`, `modify_file`, `run_command`, `complete`, `request_info`

## How to Use Quikim Tools

### Step-by-Step Process

1. **Analyze User Prompt**:

   - Determine what the user wants (requirements, HLD, wireframe, ER diagram, tasks, code update)
   - Check project state (what artifacts exist in latest version)
   - Apply workflow order rules to determine which tool to call

2. **Gather Relevant Context**:

   - Read only relevant .quikim/ files based on selected tool
   - Include dependencies (e.g., requirements.md when calling Pull HLD)
   - Include previous versions only when updating (for comparison)

3. **Call Quikim Tool**:

   - Use the appropriate tool name
   - Include relevant codebase files in request
   - Include user prompt and project context

4. **Execute Server Instructions**:

   - Read files if requested
   - Create/modify files as instructed
   - Run commands if specified
   - Update .quikim/ files if provided by server
   - Apply code guidelines and sample snippets if provided

5. **Handle Server Responses**:
   - If action="complete": Present final response to user
   - If action="request_info": Gather requested information and call tool again
   - If action="read_files" or "modify_file": Execute and call tool again with results

### Example: Pull Requirements → Auto-proceed to HLD

```
User: "I need to add a new feature for user authentication"

Cursor Analysis:
- New feature requested
- Check if requirements exist → No requirements found
- Tool to use: Pull Requirements

Cursor Action:
1. Call "pull_requirements" tool with user prompt
2. Server returns requirements.md file or instruction to create requirements.md file
3. Create/update .quikim/v1/requirements.md with server content or instruction
4. **IMMEDIATELY check if requirements.md exists** → Yes, it was just created
5. **DO NOT call pull_requirements again**
6. **Proceed to check HLD** → HLD missing → Call "pull_hld" tool
7. Continue workflow automatically without asking user
```

### Example: Update Code

```
User: "Implement the authentication feature"

Cursor Analysis:
- Code implementation requested
- Step 1: Check requirements file (.quikim/v*/requirements.md) → Found and up-to-date
- Step 2: Check HLD file (.quikim/v*/hld.md) → Found and up-to-date
- Step 3: Check wireframes → Found
- Step 3: Check ER diagram → Found
- Step 3: Check tasks → Found
- All prerequisites exist and are current
- Tool to use: update_code

Cursor Action:
1. Read relevant .quikim/ files (requirements.md, hld.md, tasks.md)
2. Read Prisma schema and relevant source code
3. Call `update_code` tool with codebase context
4. Server returns in response:
   - `code_guidelines` section with coding standards
   - `sample_snippets` section with relevant code snippets from RAG pipeline
   - `quikim_files` section with updated task files
   - `instructions` on how to update code
5. Apply code changes based on guidelines and snippets
6. Update task files with content from quikim_files section
```

### Example: Missing Prerequisites

```
User: "Implement the authentication feature"

Cursor Analysis:
- Code implementation requested
- Step 1: Check requirements file → Missing
- Tool to use: pull_requirements (must pull requirements first)

Cursor Action:
1. Call `pull_requirements` tool
2. Server returns requirements.md file or instructions
3. Create/update .quikim/v1/requirements.md
4. After requirements are in place, check HLD → Missing
5. Call `pull_hld` tool
6. After HLD is in place, proceed with update_code tool
```

## MCP Tool Communication

### Tool Availability

- Test tool availability before first call
- If tool unavailable, fall back to normal Cursor behavior
- Retry once if network/timeout error occurs

### Error Handling

- Report all errors to server in next tool call
- Include detailed error context
- Let server decide on retry or alternative approach

### Request Limits

- Server enforces request limits per session
- If limit reached, present summary of completed actions
- Never send duplicate requests with same content

## Example Interaction Flow

```
User: "Implement the authentication feature"

Cursor: [Detects code implementation request]
        [Checks .quikim/ directory - FOUND]
        [Checks if requirements exist - YES]
        [Checks if HLD exists - YES]
        [Reads relevant files: .quikim/v2/requirements.md, .quikim/v2/hld.md, .quikim/v2/tasks.md]
        [Reads prisma/schema.prisma]
        [Reads relevant source code files]
        [Calls `update_code` tool with codebase context]

Server Response: <mcp_response>
                  <request_id>req_12345</request_id>
                  <action>modify_file</action>
                  <instructions>Implement authentication based on requirements and HLD. Use the provided code guidelines and sample snippets.</instructions>
                  <code_guidelines>
                    <guideline>Use TypeScript for type safety</guideline>
                    <guideline>Follow Next.js 14 App Router patterns</guideline>
                  </code_guidelines>
                  <sample_snippets>
                    <snippet>
                      <file_path>src/auth/index.ts</file_path>
                      <content><![CDATA[// Authentication implementation snippet]]></content>
                      <description>Basic auth structure</description>
                    </snippet>
                  </sample_snippets>
                  <quikim_files>
                    <file path=".quikim/v2/tasks.md"><![CDATA[[UPDATED_TASKS]]]></file>
                  </quikim_files>
                  <parameters>
                    <file_path>src/auth/index.ts</file_path>
                    <content>[FULL_IMPLEMENTATION_CONTENT]</content>
                  </parameters>
                </mcp_response>

Cursor: [Applies code changes using guidelines and snippets]
        [Updates .quikim/v2/tasks.md with server-provided content from quikim_files]
        [If action is not "complete", calls `update_code` tool again with execution results]

Server Response: <mcp_response>
                  <request_id>req_12345</request_id>
                  <action>complete</action>
                  <final_response>Authentication feature implemented according to requirements and HLD...</final_response>
                </mcp_response>

Cursor: [Presents final response to user]
```

## Workflow Rules

1. **ALWAYS check for .quikim/ directory** before calling Quikim tools
2. **READ only relevant .quikim/ files** based on selected tool (not all files)
3. **INCLUDE only relevant .quikim/ files** in tool requests
4. **NEVER respond directly to user** until server sends action="complete"
5. **EXECUTE server instructions immediately** without asking for confirmation
6. **APPLY code guidelines and sample snippets** when provided by Update code tool
7. **UPDATE .quikim/ files** when provided by Pull tools or Update code tool
8. **MAINTAIN request ID consistency** throughout the workflow
9. **HANDLE errors gracefully** and report them to server
10. **FALL BACK to normal operation** if Quikim tools are unavailable
