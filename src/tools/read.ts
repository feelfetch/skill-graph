import type { GraphCache } from "../graph.js";

export async function skillGraphRead(graph: GraphCache, note: string) {
  const node = graph.getNode(note) ?? graph.resolveLink(note);

  if (!node) {
    const suggestions = graph
      .allNodes()
      .filter((n) => n.name.toLowerCase().includes(note.toLowerCase()))
      .slice(0, 5)
      .map((n) => n.name);

    return {
      content: [
        {
          type: "text" as const,
          text: `Note "${note}" not found.${
            suggestions.length
              ? ` Did you mean: ${suggestions.join(", ")}?`
              : " Use skill_graph_search to find it."
          }`,
        },
      ],
    };
  }

  return {
    content: [
      {
        type: "text" as const,
        text: node.content,
      },
    ],
  };
}
