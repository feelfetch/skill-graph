import type { GraphCache } from "../graph.js";

export async function skillGraphIndex(graph: GraphCache) {
  const indexNode =
    graph.getNode("Agent Skills") ?? graph.getNode("agent skills");

  if (!indexNode) {
    const allNodes = graph.allNodes();
    const summary = allNodes
      .filter((n) => n.description)
      .map((n) => `- **${n.name}**: ${n.description}`)
      .join("\n");
    return {
      content: [
        {
          type: "text" as const,
          text: `No index note found. ${graph.size} notes in vault.\n\n${summary}`,
        },
      ],
    };
  }

  const mocs = graph
    .allNodes()
    .filter(
      (n) =>
        n.description &&
        n.wikilinks.length > 2 &&
        n.name !== indexNode.name
    );

  const mocDescriptions = mocs
    .map((m) => `- **${m.name}** — ${m.description}`)
    .join("\n");

  return {
    content: [
      {
        type: "text" as const,
        text: `${indexNode.content}\n\n---\n\n## Cluster Descriptions\n\n${mocDescriptions}\n\n*${graph.size} total notes in vault.*`,
      },
    ],
  };
}
