import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { join } from "node:path";
import ora from "ora";
import chalk from "chalk";
import { createVaultIO } from "./vault-io.js";
import { GraphCache } from "./graph.js";
import { autoInit } from "./init.js";
import { skillGraphIndex } from "./tools/index-tool.js";
import { skillGraphScan } from "./tools/scan.js";
import { skillGraphRead } from "./tools/read.js";
import { skillGraphFollow } from "./tools/follow.js";
import { skillGraphSearch } from "./tools/search.js";
import { skillGraphCreate } from "./tools/create.js";
import { skillGraphUpdate } from "./tools/update.js";

const DEFAULT_VAULT_PATH = join(
  process.env.HOME || process.env.USERPROFILE || "~",
  "Documents",
  "Agents"
);

export async function startServer(): Promise<void> {
  const vaultPath = process.env.SKILL_GRAPH_PATH || DEFAULT_VAULT_PATH;
  const obsidianHost = process.env.OBSIDIAN_HOST || "http://127.0.0.1:27123";
  const obsidianApiKey = process.env.OBSIDIAN_API_KEY;

  await autoInit(vaultPath);

  const backendSpinner = ora({
    text: `Connecting to vault ${chalk.dim(vaultPath)}`,
    stream: process.stderr,
  }).start();

  const { io, mode } = await createVaultIO(
    vaultPath,
    obsidianHost,
    obsidianApiKey
  );

  if (mode === "obsidian") {
    backendSpinner.succeed(
      `Vault: ${chalk.green(vaultPath)} ${chalk.dim("via")} ${chalk.cyan("Obsidian REST API")}`
    );
  } else {
    backendSpinner.succeed(
      `Vault: ${chalk.green(vaultPath)} ${chalk.dim("via")} disk`
    );
  }

  const indexSpinner = ora({
    text: "Indexing skill graph",
    stream: process.stderr,
  }).start();

  const graph = new GraphCache(io);
  await graph.build();

  indexSpinner.succeed(`Indexed ${chalk.bold(String(graph.size))} notes`);

  const server = new McpServer({
    name: "skill-graph",
    version: "0.1.0",
  });

  server.tool(
    "skill_graph_index",
    "Get the skill graph entry point. Returns the index note content with all cluster descriptions. Call this first to understand what knowledge is available.",
    {},
    async () => skillGraphIndex(graph)
  );

  server.tool(
    "skill_graph_scan",
    "Scan a skill cluster by folder name or MOC name. Returns a list of all notes with their YAML description fields only — no full content. Use this to decide which notes to read.",
    { path: z.string().describe("Folder or MOC name to scan, e.g. 'meta', 'agent-infra', 'supabase-postgres'") },
    async ({ path }) => skillGraphScan(graph, path)
  );

  server.tool(
    "skill_graph_read",
    "Read the full content of a single skill note. Call after scanning descriptions to load only what's relevant.",
    { note: z.string().describe("Note name (without .md extension)") },
    async ({ note }) => skillGraphRead(graph, note)
  );

  server.tool(
    "skill_graph_follow",
    "Follow wikilinks from a note. Returns each link's target description and the surrounding sentence context. Use this to explore connections without loading full target notes.",
    { note: z.string().describe("Note name to follow links from") },
    async ({ note }) => skillGraphFollow(graph, note)
  );

  server.tool(
    "skill_graph_search",
    "Full-text search across all notes. Returns matching note names with descriptions and matched line context. Use when you don't know where to start.",
    { query: z.string().describe("Search query string") },
    async ({ query }) => skillGraphSearch(graph, query)
  );

  server.tool(
    "skill_graph_create",
    "Create a new skill note with YAML frontmatter description. Warns on dangling wikilinks.",
    {
      path: z.string().describe("Relative path for the new note, e.g. 'my-domain/new-skill.md'"),
      description: z.string().describe("One-line description for the YAML frontmatter"),
      content: z.string().describe("Markdown content for the note body (without frontmatter)"),
    },
    async ({ path, description, content }) =>
      skillGraphCreate(graph, io, path, description, content)
  );

  server.tool(
    "skill_graph_update",
    "Update an existing skill note. Can replace content, append text, or update the description.",
    {
      note: z.string().describe("Note name to update"),
      content: z.string().optional().describe("New full content (replaces body, keeps frontmatter)"),
      append: z.string().optional().describe("Text to append to the end of the note"),
      description: z.string().optional().describe("New description for YAML frontmatter"),
    },
    async ({ note, content, append, description }) =>
      skillGraphUpdate(graph, io, note, { content, append, description })
  );

  const transportSpinner = ora({
    text: "Starting MCP server",
    stream: process.stderr,
  }).start();

  const transport = new StdioServerTransport();
  await server.connect(transport);

  transportSpinner.succeed(`MCP server running ${chalk.dim("(stdio)")}`);
}
