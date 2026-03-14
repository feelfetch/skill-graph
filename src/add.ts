import { readdir, readFile, mkdir, writeFile, stat, rm } from "node:fs/promises";
import { join, basename, extname } from "node:path";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
import ora from "ora";
import chalk from "chalk";
import { extractFrontmatter } from "./graph.js";

const DEFAULT_VAULT_PATH = join(
  process.env.HOME || process.env.USERPROFILE || "~",
  "Documents",
  "Agents"
);

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---/;

interface SkillFolder {
  name: string;
  description: string;
  skillMdBody: string;
  subFiles: { relName: string; content: string }[];
}

function stripFrontmatter(content: string): string {
  return content.replace(FRONTMATTER_RE, "").trim();
}

function buildDescription(fm: Record<string, string>, filename: string): string {
  const title = fm.title || filename.replace(/\.md$/, "").replace(/-/g, " ");
  const impact = fm.impact || "";
  const impactDesc = fm.impactDescription || fm.impactdescription || "";

  const parts = [title];
  if (impactDesc) parts.push(`— ${impactDesc}`);
  if (impact) parts.push(`(${impact} impact)`);

  return parts.join(" ");
}

/**
 * Convert backtick-quoted rule references in SKILL.md body into [[wikilinks]].
 * Matches patterns like `- \`rule-name\` - description` and converts to
 * `- [[rule-name]] — description`.
 */
function wikilinkifyBody(body: string, ruleNames: Set<string>): string {
  return body.replace(/`([a-z][a-z0-9-]+)`/g, (match, name) => {
    if (ruleNames.has(name)) return `[[${name}]]`;
    return match;
  });
}

async function isDirectory(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function findSubFiles(dir: string): Promise<{ relName: string; content: string }[]> {
  const results: { relName: string; content: string }[] = [];
  for (const subDir of ["rules", "references"]) {
    const subPath = join(dir, subDir);
    if (!(await isDirectory(subPath))) continue;
    const entries = await readdir(subPath);
    for (const entry of entries) {
      if (!entry.endsWith(".md") || entry === "_sections.md") continue;
      const content = await readFile(join(subPath, entry), "utf-8");
      results.push({ relName: entry, content });
    }
  }
  return results;
}

async function discoverSkillFolders(rootDir: string): Promise<SkillFolder[]> {
  const skills: SkillFolder[] = [];

  const tryDir = async (dir: string) => {
    const skillMdPath = join(dir, "SKILL.md");
    if (await pathExists(skillMdPath)) {
      const raw = await readFile(skillMdPath, "utf-8");
      const fm = extractFrontmatter(raw);
      const name = fm.name || basename(dir);
      const description = fm.description || "";
      const body = stripFrontmatter(raw);
      const subFiles = await findSubFiles(dir);
      skills.push({ name, description, skillMdBody: body, subFiles });
    }
  };

  // Check root
  await tryDir(rootDir);

  // Check skills/ subdirectory
  const skillsDir = join(rootDir, "skills");
  if (await isDirectory(skillsDir)) {
    const entries = await readdir(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        await tryDir(join(skillsDir, entry.name));
      }
    }
  }

  return skills;
}

function convertSubFile(relName: string, content: string): { relName: string; converted: string } {
  const fm = extractFrontmatter(content);
  const body = stripFrontmatter(content);
  const desc = buildDescription(fm, relName);

  const converted = `---\ndescription: ${JSON.stringify(desc)}\n---\n\n${body}\n`;
  return { relName, converted };
}

function buildMOC(skill: SkillFolder): string {
  const ruleNames = new Set(
    skill.subFiles.map((f) => f.relName.replace(/\.md$/, ""))
  );
  const body = wikilinkifyBody(skill.skillMdBody, ruleNames);

  return `---\ndescription: ${JSON.stringify(skill.description)}\n---\n\n${body}\n`;
}

async function updateIndex(vaultPath: string, skillNames: string[]): Promise<void> {
  const indexPath = join(vaultPath, "Agent Skills.md");
  if (!(await pathExists(indexPath))) return;

  let content = await readFile(indexPath, "utf-8");

  const clusterHeader = "## Skill Clusters";
  const clusterIdx = content.indexOf(clusterHeader);
  if (clusterIdx === -1) return;

  const added: string[] = [];
  for (const name of skillNames) {
    const link = `[[${name}]]`;
    if (!content.includes(link)) {
      added.push(name);
    }
  }

  if (added.length === 0) return;

  // Find the end of the cluster list (next ## heading or end of file)
  const afterCluster = content.indexOf("\n## ", clusterIdx + clusterHeader.length);
  const insertPos = afterCluster === -1 ? content.length : afterCluster;

  const newLinks = added.map((n) => `- [[${n}]]`).join("\n");
  content = content.slice(0, insertPos) + newLinks + "\n" + content.slice(insertPos);

  await writeFile(indexPath, content, "utf-8");
}

export async function runAdd(source: string, opts: { skill?: string; force?: boolean }): Promise<void> {
  const vaultPath = process.env.SKILL_GRAPH_PATH || DEFAULT_VAULT_PATH;

  console.error("");
  console.error(
    `  ${chalk.bold("skill-graph")} ${chalk.dim("— import skill")}`
  );
  console.error("");

  let sourceDir: string;
  let tempDir: string | null = null;

  // Determine if source is a local path or GitHub repo
  const isLocal = source.startsWith("/") || source.startsWith("~") || source.startsWith(".");
  const expandedSource = source.replace(/^~/, process.env.HOME || "~");

  if (isLocal) {
    if (!(await isDirectory(expandedSource))) {
      console.error(`  ${chalk.red("Error:")} ${expandedSource} is not a directory`);
      process.exit(1);
    }
    sourceDir = expandedSource;
  } else {
    // GitHub repo — clone to temp
    const cloneSpinner = ora({
      text: `Cloning ${chalk.cyan(source)}`,
      stream: process.stderr,
    }).start();

    tempDir = join(tmpdir(), `skill-graph-add-${Date.now()}`);
    try {
      execSync(`git clone --depth 1 https://github.com/${source}.git "${tempDir}"`, {
        stdio: "pipe",
      });
      cloneSpinner.succeed(`Cloned ${chalk.cyan(source)}`);
    } catch {
      cloneSpinner.fail(`Failed to clone ${source}`);
      console.error(`  ${chalk.dim("Make sure the repo exists and is accessible")}`);
      process.exit(1);
    }
    sourceDir = tempDir;
  }

  // Discover skill folders
  const allSkills = await discoverSkillFolders(sourceDir);

  if (allSkills.length === 0) {
    console.error(`  ${chalk.yellow("No SKILL.md files found")} in ${source}`);
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
    process.exit(1);
  }

  // Filter by --skill if provided
  const skills = opts.skill
    ? allSkills.filter((s) => s.name === opts.skill)
    : allSkills;

  if (skills.length === 0) {
    console.error(
      `  ${chalk.yellow("Skill not found:")} ${opts.skill}`
    );
    console.error(
      `  ${chalk.dim("Available:")} ${allSkills.map((s) => s.name).join(", ")}`
    );
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
    process.exit(1);
  }

  const skillNamesList = skills.map((s) => chalk.cyan(s.name)).join(", ");
  console.error(`  Found ${chalk.bold(String(skills.length))} skill${skills.length > 1 ? "s" : ""}: ${skillNamesList}`);
  console.error("");

  const importedNames: string[] = [];

  for (const skill of skills) {
    const destDir = join(vaultPath, skill.name);

    if ((await pathExists(destDir)) && !opts.force) {
      console.error(
        `  ${chalk.yellow("⚠")} ${chalk.bold(skill.name)} already exists — skipping ${chalk.dim("(use --force to overwrite)")}`
      );
      continue;
    }

    const ruleCount = skill.subFiles.length;
    const label = ruleCount > 0
      ? `${skill.name} (${ruleCount} rule${ruleCount > 1 ? "s" : ""})`
      : skill.name;

    const spinner = ora({
      text: `Importing ${chalk.cyan(label)}`,
      stream: process.stderr,
    }).start();

    await mkdir(destDir, { recursive: true });

    // Write MOC
    const mocContent = buildMOC(skill);
    await writeFile(join(destDir, `${skill.name}.md`), mocContent, "utf-8");

    // Convert and write sub-files
    for (const sub of skill.subFiles) {
      const { relName, converted } = convertSubFile(sub.relName, sub.content);
      await writeFile(join(destDir, relName), converted, "utf-8");
    }

    const totalNotes = 1 + ruleCount;
    const detail = ruleCount > 0
      ? `${totalNotes} notes (1 MOC + ${ruleCount} rules)`
      : "1 note";

    spinner.succeed(
      `Created ${chalk.green(skill.name + "/")} with ${detail}`
    );
    importedNames.push(skill.name);
  }

  if (importedNames.length > 0) {
    // Update the main index
    await updateIndex(vaultPath, importedNames);

    console.error("");
    console.error(
      `  ${chalk.green("✔")} Updated ${chalk.cyan("Agent Skills.md")} with ${importedNames.length} new cluster link${importedNames.length > 1 ? "s" : ""}`
    );
    console.error(
      `  ${chalk.green("✔")} Done! Imported ${chalk.bold(String(importedNames.length))} skill${importedNames.length > 1 ? "s" : ""} into ${chalk.green(vaultPath)}`
    );
  }

  console.error("");

  // Cleanup temp dir
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
  }
}
