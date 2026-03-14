import { mkdir, stat, writeFile } from "node:fs/promises";
import { statSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import ora from "ora";
import chalk from "chalk";
import { starterNotes } from "./starter/index.js";

const DEFAULT_VAULT_PATH = join(
  process.env.HOME || process.env.USERPROFILE || "~",
  "Documents",
  "Agents"
);

function ask(question: string, defaultValue?: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const suffix = defaultValue ? chalk.dim(` [${defaultValue}]`) : "";
  const prompt = `  ${chalk.cyan("?")} ${question}${suffix} `;
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || "");
    });
  });
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function seedStarterGraph(vaultPath: string): Promise<void> {
  for (const [relPath, content] of Object.entries(starterNotes)) {
    const fullPath = join(vaultPath, relPath);
    await mkdir(join(fullPath, ".."), { recursive: true });
    await writeFile(fullPath, content, "utf-8");
  }
}

function detectObsidian(): boolean {
  const platform = process.platform;
  let obsidianPath: string;
  if (platform === "darwin") {
    obsidianPath = join(
      process.env.HOME || "",
      "Library",
      "Application Support",
      "obsidian"
    );
  } else if (platform === "win32") {
    obsidianPath = join(process.env.APPDATA || "", "obsidian");
  } else {
    obsidianPath = join(process.env.HOME || "", ".config", "obsidian");
  }
  try {
    statSync(obsidianPath);
    return true;
  } catch {
    return false;
  }
}

export async function runInit(): Promise<void> {
  console.error("");
  console.error(
    `  ${chalk.bold("skill-graph")} ${chalk.dim("— vault initializer")}`
  );
  console.error("");

  const vaultPath = await ask("Vault location", DEFAULT_VAULT_PATH);

  if (await pathExists(vaultPath)) {
    const existing = await ask(
      `${chalk.yellow(vaultPath)} already exists. Seed starter notes?`,
      "n"
    );
    if (existing.toLowerCase() !== "y") {
      console.error(`  ${chalk.dim("Aborted. Existing vault left unchanged.")}`);
      return;
    }
  }

  const seedSpinner = ora({
    text: "Creating vault and seeding starter graph",
    stream: process.stderr,
  }).start();

  await mkdir(vaultPath, { recursive: true });
  await seedStarterGraph(vaultPath);

  seedSpinner.succeed(
    `Created vault at ${chalk.green(vaultPath)} with ${Object.keys(starterNotes).length} starter notes`
  );

  const obsidianSpinner = ora({
    text: "Checking for Obsidian",
    stream: process.stderr,
  }).start();

  const hasObsidian = detectObsidian();

  let apiKey = "";

  if (hasObsidian) {
    obsidianSpinner.succeed("Obsidian detected");
    console.error("");
    console.error(`  ${chalk.dim("To use this vault in Obsidian:")}`);
    console.error(
      `  ${chalk.dim("1.")} Open Obsidian → ${chalk.cyan('"Open folder as vault"')} → select the path above`
    );
    console.error(
      `  ${chalk.dim("2.")} Install the ${chalk.cyan('"Local REST API"')} community plugin for live integration`
    );
    console.error(
      `  ${chalk.dim("3.")} Copy the API key from the plugin settings`
    );
    console.error("");
    apiKey = await ask(
      `Obsidian Local REST API key ${chalk.dim("(paste it, or press Enter to skip)")}`,
    );
    if (apiKey) {
      const verifySpinner = ora({
        text: "Verifying API connection",
        stream: process.stderr,
      }).start();
      try {
        const res = await fetch("http://127.0.0.1:27123/", {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) {
          verifySpinner.succeed("Connected to Obsidian REST API");
        } else {
          verifySpinner.warn(
            `API responded with ${res.status} — check the key or start Obsidian later`
          );
        }
      } catch {
        verifySpinner.warn(
          "Could not reach Obsidian — the key will be saved, connect later"
        );
      }
    }
  } else {
    obsidianSpinner.info("Obsidian not found — vault works standalone via disk");
  }

  const env: Record<string, string> = {
    SKILL_GRAPH_PATH: vaultPath,
  };
  if (apiKey) {
    env.OBSIDIAN_API_KEY = apiKey;
  }

  const mcpConfig = {
    "mcpServers": {
      "skill-graph": {
        command: "npx",
        args: ["-y", "skill-graph"],
        env,
      },
    },
  };

  console.error("");
  console.error(
    `  ${chalk.bold("Add this to")} ${chalk.cyan("~/.cursor/mcp.json")}${chalk.bold(":")}`
  );
  console.error("");
  const configStr = JSON.stringify(mcpConfig, null, 2);
  for (const line of configStr.split("\n")) {
    console.error(`  ${chalk.dim(line)}`);
  }
  console.error("");
  console.error(`  ${chalk.green("✔")} ${chalk.bold("You're all set!")} Run ${chalk.cyan("npx skill-graph")} to start the MCP server.`);
  console.error("");
}

export async function autoInit(vaultPath: string): Promise<void> {
  if (await pathExists(vaultPath)) return;

  const spinner = ora({
    text: "No vault found — creating starter skill graph",
    stream: process.stderr,
  }).start();

  await mkdir(vaultPath, { recursive: true });
  await seedStarterGraph(vaultPath);

  spinner.succeed(
    `Auto-created vault at ${chalk.green(vaultPath)} with ${Object.keys(starterNotes).length} starter notes`
  );
  console.error(
    `  ${chalk.dim(`Set SKILL_GRAPH_PATH to use a different location.`)}`
  );
}
