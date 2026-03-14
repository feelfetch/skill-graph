# skill-graph

A graph-aware second brain MCP server for AI agents. Works with any folder of markdown files on disk. Obsidian is optional — when running, it upgrades the experience with live graph view and search.

## Quick Start

```bash
# Interactive setup — creates vault, detects Obsidian, prompts for API key
npx skill-graph init

# Or just run — auto-creates a starter vault if none exists
npx skill-graph
```

The `init` command walks you through:
1. Choosing a vault location (default: `~/Documents/Agents`)
2. Seeding a starter skill graph with methodology notes
3. Detecting Obsidian and prompting for the Local REST API key
4. Printing the `mcp.json` config ready to paste

## Cursor Configuration

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "skill-graph": {
      "command": "npx",
      "args": ["-y", "skill-graph"],
      "env": {
        "SKILL_GRAPH_PATH": "~/Documents/Agents",
        "OBSIDIAN_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

The `OBSIDIAN_API_KEY` is optional — without it, the server works via direct filesystem access.

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SKILL_GRAPH_PATH` | `~/Documents/Agents` | Path to the vault folder |
| `OBSIDIAN_API_KEY` | — | Enables Obsidian REST API backend |
| `OBSIDIAN_HOST` | `http://127.0.0.1:27123` | Obsidian API host |

## Tools

The server exposes 8 tools that implement **progressive disclosure** — start broad, go deep only when relevant.

### Read Tools

| Tool | Purpose |
|---|---|
| `skill_graph_index` | Entry point. Returns the index note + all cluster descriptions. |
| `skill_graph_scan` | Scan a cluster. Returns note names and YAML descriptions only. |
| `skill_graph_read` | Read one note's full content. |
| `skill_graph_follow` | Follow wikilinks from a note. Shows targets' descriptions + context. |
| `skill_graph_search` | Full-text search across all notes. |

### Write Tools

| Tool | Purpose |
|---|---|
| `skill_graph_create` | Create a new note with frontmatter. Warns on dangling wikilinks. |
| `skill_graph_update` | Update content, append text, or change a note's description. |

### Learning Tools

| Tool | Purpose |
|---|---|
| `skill_graph_learn` | Capture a learning. Routes to an existing note if the topic matches, or creates a new note in `learnings/`. |

### Prompts

| Prompt | Purpose |
|---|---|
| `skill_graph_reflect` | End-of-session reflection. Asks the agent to review the conversation and call `skill_graph_learn` for anything worth remembering. |

## Learning Loop

Inspired by [Acontext](https://acontext.io), skill-graph can capture learnings from real conversations and store them as skill nodes in the graph.

When the agent calls `skill_graph_learn`:
1. **Routing** — the graph is searched for existing notes matching the topic (by name, description, and tags). If a strong match is found, the learning is appended to that note under a `## Learnings` section.
2. **Creation** — if no match, a new note is created in `learnings/` with the learning as content.
3. **MOC update** — the `learnings/learnings.md` map of content is updated with a link to the new or updated note.

Three outcome types: `success` (what worked), `failure` (what to avoid), `preference` (user preferences).

At the end of a session, invoke the `skill_graph_reflect` prompt to have the agent review the conversation and capture anything worth preserving.

## How It Works

Each markdown file in the vault is a **skill node** with:
- **YAML frontmatter** `description` — one-line summary agents scan before reading
- **Wikilinks in prose** — `[[links]]` embedded in sentences that carry traversal context
- **Standalone content** — each file is a complete, self-contained concept

The server builds an in-memory graph from these files on startup, enabling instant lookups, wikilink resolution, and full-text search.

## Obsidian Integration (Optional)

If Obsidian is running with the [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) plugin, the server automatically detects it and uses the API for reading and writing notes. This means notes you create from Cursor appear live in Obsidian's graph view.

During `npx skill-graph init`, the setup detects Obsidian on your system and prompts for the API key. It verifies the connection before saving the key to your config.

Without Obsidian, everything works via direct filesystem access — no dependencies required.

## Development

```bash
npm install
npm run build
npm run dev  # runs via tsx without compiling
```

## License

MIT
