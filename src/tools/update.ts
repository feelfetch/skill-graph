import type { GraphCache } from "../graph.js";
import type { VaultIO } from "../vault-io.js";
import { extractFrontmatter } from "../graph.js";

export async function skillGraphUpdate(
  graph: GraphCache,
  io: VaultIO,
  note: string,
  options: {
    content?: string;
    append?: string;
    description?: string;
  }
) {
  const node = graph.getNode(note) ?? graph.resolveLink(note);

  if (!node) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Note "${note}" not found. Use skill_graph_create to make a new note.`,
        },
      ],
    };
  }

  let newContent = node.content;

  if (options.description) {
    const fmMatch = newContent.match(/^---\n([\s\S]*?)\n---/);
    if (fmMatch) {
      const updatedFm = fmMatch[1].replace(
        /description:.*$/m,
        `description: ${JSON.stringify(options.description)}`
      );
      newContent = newContent.replace(fmMatch[1], updatedFm);
    } else {
      newContent = `---\ndescription: ${JSON.stringify(options.description)}\n---\n\n${newContent}`;
    }
  }

  if (options.content !== undefined) {
    const fmMatch = newContent.match(/^(---\n[\s\S]*?\n---\n)/);
    if (fmMatch) {
      newContent = fmMatch[1] + "\n" + options.content;
    } else {
      newContent = options.content;
    }
  }

  if (options.append) {
    newContent = newContent.trimEnd() + "\n\n" + options.append;
  }

  await io.writeNote(node.relPath, newContent);
  await graph.indexNote(node.relPath);

  const changes: string[] = [];
  if (options.description) changes.push("description");
  if (options.content !== undefined) changes.push("content");
  if (options.append) changes.push("appended text");

  return {
    content: [
      {
        type: "text" as const,
        text: `Updated "${node.name}" (${changes.join(", ")}).`,
      },
    ],
  };
}
