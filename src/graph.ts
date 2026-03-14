import { basename, dirname, extname } from "node:path";
import type { VaultIO } from "./vault-io.js";

export interface NoteNode {
  name: string;
  folder: string;
  relPath: string;
  description: string;
  wikilinks: WikilinkRef[];
  content: string;
}

export interface WikilinkRef {
  target: string;
  alias: string | null;
  context: string;
}

const WIKILINK_RE = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---/;

export function extractFrontmatter(content: string): Record<string, string> {
  const match = content.match(FRONTMATTER_RE);
  if (!match) return {};
  const yaml = match[1];
  const result: Record<string, string> = {};
  for (const line of yaml.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

export function extractWikilinks(content: string): WikilinkRef[] {
  const links: WikilinkRef[] = [];
  const lines = content.split("\n");
  for (const line of lines) {
    let match: RegExpExecArray | null;
    WIKILINK_RE.lastIndex = 0;
    while ((match = WIKILINK_RE.exec(line)) !== null) {
      links.push({
        target: match[1].trim(),
        alias: match[2]?.trim() ?? null,
        context: line.trim(),
      });
    }
  }
  return links;
}

export class GraphCache {
  private nodes = new Map<string, NoteNode>();
  private io: VaultIO;

  constructor(io: VaultIO) {
    this.io = io;
  }

  async build(): Promise<void> {
    const paths = await this.io.listNotes();
    this.nodes.clear();
    for (const relPath of paths) {
      await this.indexNote(relPath);
    }
  }

  async indexNote(relPath: string): Promise<NoteNode> {
    const content = await this.io.readNote(relPath);
    const name = basename(relPath, extname(relPath));
    const folder = dirname(relPath);
    const frontmatter = extractFrontmatter(content);
    const wikilinks = extractWikilinks(content);

    const node: NoteNode = {
      name,
      folder: folder === "." ? "" : folder,
      relPath,
      description: frontmatter.description || "",
      wikilinks,
      content,
    };

    this.nodes.set(name.toLowerCase(), node);
    return node;
  }

  getNode(name: string): NoteNode | undefined {
    return this.nodes.get(name.toLowerCase());
  }

  resolveLink(target: string): NoteNode | undefined {
    const lower = target.toLowerCase();
    if (this.nodes.has(lower)) return this.nodes.get(lower);
    for (const [, node] of this.nodes) {
      if (node.relPath.toLowerCase().replace(/\.md$/, "") === lower) {
        return node;
      }
    }
    return undefined;
  }

  allNodes(): NoteNode[] {
    return Array.from(this.nodes.values());
  }

  nodesInFolder(folder: string): NoteNode[] {
    const f = folder.toLowerCase().replace(/\/$/, "");
    return this.allNodes().filter(
      (n) => n.folder.toLowerCase() === f || n.folder.toLowerCase().startsWith(f + "/")
    );
  }

  search(query: string): { node: NoteNode; matchedLines: string[] }[] {
    const q = query.toLowerCase();
    const results: { node: NoteNode; matchedLines: string[] }[] = [];
    for (const node of this.nodes.values()) {
      const matchedLines: string[] = [];
      for (const line of node.content.split("\n")) {
        if (line.toLowerCase().includes(q)) {
          matchedLines.push(line.trim());
        }
      }
      if (matchedLines.length > 0) {
        results.push({ node, matchedLines: matchedLines.slice(0, 5) });
      }
    }
    return results;
  }

  findBestMatch(
    summary: string,
    tags?: string[]
  ): { node: NoteNode; score: number } | null {
    const words = this.tokenize(summary);
    const tagSet = new Set((tags ?? []).map((t) => t.toLowerCase()));
    let best: { node: NoteNode; score: number } | null = null;

    for (const node of this.nodes.values()) {
      let score = 0;

      const nameWords = this.tokenize(node.name);
      const descWords = this.tokenize(node.description);
      const folderWords = this.tokenize(node.folder.replace(/\//g, " "));

      for (const w of words) {
        if (nameWords.has(w)) score += 3;
        if (descWords.has(w)) score += 2;
      }

      for (const tag of tagSet) {
        if (nameWords.has(tag)) score += 3;
        if (folderWords.has(tag)) score += 2;
        if (descWords.has(tag)) score += 1;
      }

      if (score > 0 && (!best || score > best.score)) {
        best = { node, score };
      }
    }

    // Require a minimum score to consider it a real match
    if (best && best.score >= 4) return best;
    return null;
  }

  private tokenize(text: string): Set<string> {
    return new Set(
      text
        .toLowerCase()
        .split(/[\s\-_/.,;:!?()\[\]]+/)
        .filter((w) => w.length > 2)
    );
  }

  get size(): number {
    return this.nodes.size;
  }
}
