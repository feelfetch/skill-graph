import type { GraphCache } from "../graph.js";
import type { VaultIO } from "../vault-io.js";

type Outcome = "success" | "failure" | "preference";

const OUTCOME_ICONS: Record<Outcome, string> = {
  success: "what worked",
  failure: "what to avoid",
  preference: "user preference",
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function timestamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function skillGraphLearn(
  graph: GraphCache,
  io: VaultIO,
  outcome: Outcome,
  summary: string,
  detail: string,
  tags?: string[]
) {
  const match = graph.findBestMatch(summary, tags);
  const date = timestamp();
  const label = OUTCOME_ICONS[outcome];
  const entry = `\n### ${date} — ${label}\n\n${detail}`;

  if (match) {
    const node = match.node;
    let newContent = node.content;

    if (newContent.includes("## Learnings")) {
      newContent = newContent.trimEnd() + "\n" + entry;
    } else {
      newContent = newContent.trimEnd() + "\n\n## Learnings\n" + entry;
    }

    await io.writeNote(node.relPath, newContent);
    await graph.indexNote(node.relPath);

    await updateLearningsMOC(graph, io, node.name);

    return {
      content: [
        {
          type: "text" as const,
          text: `Appended learning to existing note "${node.name}" (score: ${match.score}). Outcome: ${label}.`,
        },
      ],
    };
  }

  const slug = slugify(summary);
  const relPath = `learnings/${slug}.md`;

  if (await io.exists(relPath)) {
    const existingContent = await io.readNote(relPath);
    const appended = existingContent.trimEnd() + "\n" + entry;
    await io.writeNote(relPath, appended);
    await graph.indexNote(relPath);

    return {
      content: [
        {
          type: "text" as const,
          text: `Appended learning to existing note "learnings/${slug}". Outcome: ${label}.`,
        },
      ],
    };
  }

  const tagLinks = (tags ?? [])
    .map((t) => {
      const linked = graph.resolveLink(t);
      return linked ? `[[${linked.name}]]` : t;
    })
    .join(", ");

  const topicLine = tagLinks ? `\nRelated: ${tagLinks}\n` : "";
  const noteContent = `---\ndescription: "Learned: ${summary}"\n---\n\n# ${summary}\n${topicLine}\n## Learnings\n${entry}\n`;

  await io.writeNote(relPath, noteContent);
  await graph.indexNote(relPath);

  await updateLearningsMOC(graph, io, slug);

  return {
    content: [
      {
        type: "text" as const,
        text: `Created new learning note at "${relPath}". Outcome: ${label}.`,
      },
    ],
  };
}

async function updateLearningsMOC(
  graph: GraphCache,
  io: VaultIO,
  noteName: string
): Promise<void> {
  const mocPath = "learnings/learnings.md";
  const linkText = `[[${noteName}]]`;

  if (!(await io.exists(mocPath))) return;

  const content = await io.readNote(mocPath);
  if (content.includes(linkText)) return;

  const updated = content.trimEnd() + `\n- ${linkText}\n`;
  await io.writeNote(mocPath, updated);
  await graph.indexNote(mocPath);
}
