import type { GraphCache } from "../graph.js";
import type { VaultIO } from "../vault-io.js";
import { extractWikilinks } from "../graph.js";

export async function skillGraphCreate(
  graph: GraphCache,
  io: VaultIO,
  path: string,
  description: string,
  content: string
) {
  const relPath = path.endsWith(".md") ? path : `${path}.md`;

  if (await io.exists(relPath)) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Note "${relPath}" already exists. Use skill_graph_update to modify it.`,
        },
      ],
    };
  }

  const fullContent = `---\ndescription: ${JSON.stringify(description)}\n---\n\n${content}`;

  const links = extractWikilinks(content);
  const dangling = links.filter((l) => !graph.resolveLink(l.target));

  await io.writeNote(relPath, fullContent);
  await graph.indexNote(relPath);

  let warning = "";
  if (dangling.length > 0) {
    const names = dangling.map((l) => `[[${l.target}]]`).join(", ");
    warning = `\n\nDangling wikilinks (no matching notes): ${names}`;
  }

  return {
    content: [
      {
        type: "text" as const,
        text: `Created "${relPath}" with description.${warning}`,
      },
    ],
  };
}
