import type { GraphCache } from "../graph.js";

export async function skillGraphSearch(graph: GraphCache, query: string) {
  const results = graph.search(query);

  if (results.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: `No results for "${query}".`,
        },
      ],
    };
  }

  const formatted = results.slice(0, 20).map(({ node, matchedLines }) => {
    const desc = node.description ? ` — ${node.description}` : "";
    const lines = matchedLines
      .slice(0, 3)
      .map((l) => `  > ${l}`)
      .join("\n");
    return `- **${node.name}**${desc}\n${lines}`;
  });

  return {
    content: [
      {
        type: "text" as const,
        text: `## Search: "${query}"\n\n${results.length} notes matched:\n\n${formatted.join("\n\n")}`,
      },
    ],
  };
}
