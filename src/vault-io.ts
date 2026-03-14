import { readdir, readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { join, relative, basename, extname } from "node:path";

export interface VaultIO {
  listNotes(): Promise<string[]>;
  readNote(relPath: string): Promise<string>;
  writeNote(relPath: string, content: string): Promise<void>;
  search(query: string): Promise<{ path: string; line: string }[]>;
  exists(relPath: string): Promise<boolean>;
}

export class DiskBackend implements VaultIO {
  constructor(private vaultPath: string) {}

  async listNotes(): Promise<string[]> {
    return this.walkDir(this.vaultPath);
  }

  private async walkDir(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    const results: string[] = [];
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith(".")) continue;
        results.push(...(await this.walkDir(fullPath)));
      } else if (entry.isFile() && extname(entry.name) === ".md") {
        results.push(relative(this.vaultPath, fullPath));
      }
    }
    return results;
  }

  async readNote(relPath: string): Promise<string> {
    return readFile(join(this.vaultPath, relPath), "utf-8");
  }

  async writeNote(relPath: string, content: string): Promise<void> {
    const fullPath = join(this.vaultPath, relPath);
    await mkdir(join(fullPath, ".."), { recursive: true });
    await writeFile(fullPath, content, "utf-8");
  }

  async search(query: string): Promise<{ path: string; line: string }[]> {
    const notes = await this.listNotes();
    const results: { path: string; line: string }[] = [];
    const q = query.toLowerCase();
    for (const notePath of notes) {
      const content = await this.readNote(notePath);
      const lines = content.split("\n");
      for (const line of lines) {
        if (line.toLowerCase().includes(q)) {
          results.push({ path: notePath, line: line.trim() });
        }
      }
    }
    return results;
  }

  async exists(relPath: string): Promise<boolean> {
    try {
      await stat(join(this.vaultPath, relPath));
      return true;
    } catch {
      return false;
    }
  }
}

export class ObsidianBackend implements VaultIO {
  constructor(
    private vaultPath: string,
    private host: string,
    private apiKey: string,
    private disk: DiskBackend
  ) {}

  private async api(
    path: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      ...(options.headers as Record<string, string>),
    };
    return fetch(`${this.host}${path}`, { ...options, headers });
  }

  async listNotes(): Promise<string[]> {
    // Obsidian API lists non-recursively; disk walk is more reliable for full enumeration
    return this.disk.listNotes();
  }

  async readNote(relPath: string): Promise<string> {
    try {
      const encoded = relPath
        .split("/")
        .map((s) => encodeURIComponent(s))
        .join("/");
      const res = await this.api(`/vault/${encoded}`, {
        headers: { Accept: "text/markdown" },
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      return res.text();
    } catch {
      return this.disk.readNote(relPath);
    }
  }

  async writeNote(relPath: string, content: string): Promise<void> {
    await this.disk.writeNote(relPath, content);
    try {
      const encoded = relPath
        .split("/")
        .map((s) => encodeURIComponent(s))
        .join("/");
      await this.api(`/vault/${encoded}`, {
        method: "PUT",
        headers: { "Content-Type": "text/markdown" },
        body: content,
      });
    } catch {
      // disk write already succeeded
    }
  }

  async search(query: string): Promise<{ path: string; line: string }[]> {
    try {
      const res = await this.api("/search/simple/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = (await res.json()) as Array<{
        filename: string;
        matches: Array<{ match: { text: string } }>;
      }>;
      return data.flatMap((item) =>
        item.matches.map((m) => ({
          path: item.filename,
          line: m.match.text.trim(),
        }))
      );
    } catch {
      return this.disk.search(query);
    }
  }

  async exists(relPath: string): Promise<boolean> {
    return this.disk.exists(relPath);
  }
}

export async function createVaultIO(
  vaultPath: string,
  obsidianHost?: string,
  obsidianApiKey?: string
): Promise<{ io: VaultIO; mode: "obsidian" | "disk" }> {
  const disk = new DiskBackend(vaultPath);

  if (obsidianHost && obsidianApiKey) {
    try {
      const res = await fetch(`${obsidianHost}/`, {
        headers: { Authorization: `Bearer ${obsidianApiKey}` },
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        return {
          io: new ObsidianBackend(vaultPath, obsidianHost, obsidianApiKey, disk),
          mode: "obsidian",
        };
      }
    } catch {
      // Obsidian not reachable
    }
  }

  return { io: disk, mode: "disk" };
}
