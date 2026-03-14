import type { GraphCache } from "../graph.js";

export async function skillGraphScan(
  graph: GraphCache,
  path: string
) {
  const pathLower = path.toLowerCase();

  const mocNode = graph.getNode(path);
  let notes = graph.nodesInFolder(path);

  if (notes.length === 0 && mocNode) {
    const linkedNames = mocNode.wikilinks.map((l) => l.target.toLowerCase());
    notes = graph
      .allNodes()
      .filter((n) => linkedNames.includes(n.name.toLowerCase()));
  }

  if (notes.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: `No notes found in cluster "${path}". Use skill_graph_index to see available clusters.`,
        },
      ],
    };
  }

  const listing = notes
    .map((n) => {
      const desc = n.description || "(no description)";
      return `- **${n.name}** — ${desc}`;
    })
    .join("\n");

  return {
    content: [
      {
        type: "text" as const,
        text: `## ${path}\n\n${notes.length} notes:\n\n${listing}`,
      },
    ],
  };
}
