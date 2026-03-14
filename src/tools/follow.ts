import type { GraphCache } from "../graph.js";

export async function skillGraphFollow(graph: GraphCache, note: string) {
  const node = graph.getNode(note) ?? graph.resolveLink(note);

  if (!node) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Note "${note}" not found.`,
        },
      ],
    };
  }

  if (node.wikilinks.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: `"${node.name}" has no outgoing wikilinks.`,
        },
      ],
    };
  }

  const linkDetails = node.wikilinks.map((link) => {
    const target = graph.resolveLink(link.target);
    const desc = target?.description || "(note not found in vault)";
    const display = link.alias ? `${link.alias} → ${link.target}` : link.target;
    return `- **[[${display}]]** — ${desc}\n  Context: *"${link.context}"*`;
  });

  const unique = [...new Map(linkDetails.map((d) => [d, d])).values()];

  return {
    content: [
      {
        type: "text" as const,
        text: `## Links from "${node.name}"\n\n${unique.join("\n\n")}`,
      },
    ],
  };
}
