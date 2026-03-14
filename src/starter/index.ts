export const starterNotes: Record<string, string> = {
  "Agent Skills.md": `---
description: Entry point for the agent skill graph. A traversable network of skills, techniques, and domain knowledge that agents navigate to find exactly what a situation requires.
---

# Agent Skills

This vault is a **skill graph** — a network of interconnected skill files that agents traverse to pull in exactly what the current situation requires. Instead of one large instruction file, each note is a standalone skill with [[wikilinks as prose|wikilinks]] that carry meaning, connecting related capabilities into a navigable whole.

## How Agents Use This

1. Start here — scan the clusters below to orient
2. Open a cluster's MOC (map of content) to see descriptions of each skill
3. Read only the skills relevant to the current task
4. Follow wikilinks when a skill references related techniques

## Skill Clusters

- [[meta-skills]] — the methodology behind skill graphs: how to build them, why they work, and when to use them
- [[agent-infra]] — foundational patterns for how agents discover, traverse, and operate on knowledge structures
`,

  "meta/meta-skills.md": `---
description: Map of content for skill graph methodology — how to build, structure, and maintain a knowledge graph that AI agents can efficiently traverse.
---

# Meta-Skills

The skills in this cluster explain the methodology behind skill graphs themselves.

- [[skill graphs]] — what skill graphs are, why they outperform monolithic instruction files, and the core principles behind them
- [[anatomy of a skill node]] — the structure every skill file should follow: frontmatter, wikilinks as prose, progressive disclosure
- [[maps of content]] — how MOC files organize clusters of related skills into navigable hubs
- [[progressive disclosure]] — the layered information retrieval strategy: index → descriptions → links → full content
- [[wikilinks as prose]] — embedding links in natural sentences so they carry context and guide traversal decisions
`,

  "meta/skill graphs.md": `---
description: What skill graphs are and why they outperform monolithic instruction files for giving AI agents domain knowledge.
---

# Skill Graphs

A skill graph is a network of interconnected markdown files where each file represents a single, self-contained skill, technique, or concept. Files connect to each other through [[wikilinks as prose|wikilinks embedded in prose]], creating a navigable knowledge structure.

## Why Not One Big File?

Monolithic instruction files hit three walls:

1. **Context waste** — the agent loads everything even when it only needs one technique
2. **Staleness** — updating one section risks breaking references elsewhere
3. **No composability** — you can't mix and match skills from different domains

Skill graphs solve all three. The agent traverses from the [[maps of content|index]] through [[progressive disclosure|description scans]] to load only what's relevant. Each node is independently maintainable. And because nodes connect via wikilinks, skills from different clusters naturally reference each other.

## Core Principles

- **One thought per file** — each note should be a complete, standalone concept
- **Descriptions for scanning** — every note has a YAML \`description\` field so agents can decide relevance without reading the full content
- **Links carry meaning** — wikilinks are written in sentences that explain *why* the link is relevant, not just that it exists
- **Clusters with MOCs** — related notes group into folders, each with a [[maps of content|map of content]] that lists and describes its members
`,

  "meta/anatomy of a skill node.md": `---
description: The standard structure every skill file should follow — YAML frontmatter description, wikilinks woven into prose, and content organized for progressive disclosure.
---

# Anatomy of a Skill Node

Every skill file follows the same structure so agents can process them predictably.

## YAML Frontmatter

Every file starts with a \`description\` field between \`---\` delimiters:

\`\`\`yaml
---
description: One-line summary that lets an agent decide whether to read further.
---
\`\`\`

This is the cheapest unit of information in the graph. Agents scan descriptions before committing to reading full content.

## Wikilinks in Prose

Links to other notes appear inside sentences, not in bare lists:

> When optimizing queries, apply [[progressive disclosure]] to load only the relevant rules from the [[maps of content|performance MOC]].

The surrounding sentence tells the agent *when* and *why* to follow the link. See [[wikilinks as prose]] for the full pattern.

## Content Structure

Organize content with clear headings so agents can read specific sections without processing the entire file. Put the most actionable information first.
`,

  "meta/maps of content.md": `---
description: How MOC (map of content) files serve as navigable hubs that organize clusters of related skills with descriptions and contextual links.
---

# Maps of Content

A map of content (MOC) is an index file for a cluster of related notes. It lives in the same folder as its notes and lists each one with a brief description or contextual sentence.

## Structure

A MOC has:
- A \`description\` in frontmatter explaining the cluster's scope
- A list of member notes as wikilinks, each with a sentence of context
- Optional grouping by sub-theme within the cluster

## Why MOCs Work for Agents

When an agent calls \`skill_graph_scan\` on a folder, it gets each note's description. But MOCs add a layer of editorial context — they explain *relationships* between notes and suggest a reading order. The agent can follow [[progressive disclosure]] from MOC → descriptions → individual notes.
`,

  "meta/progressive disclosure.md": `---
description: The layered information retrieval strategy agents use to navigate the skill graph — index → descriptions → links → sections → full content — loading only what the current task requires.
---

# Progressive Disclosure

Progressive disclosure is how agents efficiently consume knowledge from the skill graph without wasting context on irrelevant content.

## The Layers

1. **Index** — \`skill_graph_index\` returns the top-level overview with cluster links and descriptions (~2KB)
2. **Scan** — \`skill_graph_scan\` returns all note descriptions in a cluster (~1KB per cluster)
3. **Follow** — \`skill_graph_follow\` shows where a note's wikilinks lead, with surrounding context
4. **Read** — \`skill_graph_read\` loads the full content of a single note

Each layer is a filtering decision. The agent reads a layer, decides what's relevant, and only goes deeper on the relevant branches.

## Why This Matters

A vault with 100 skills might contain 200KB of content. Without progressive disclosure, the agent loads all 200KB. With it, a typical task loads 5-10KB — the index, one cluster scan, and 2-3 full notes. That's a 20x reduction in context usage.
`,

  "meta/wikilinks as prose.md": `---
description: The practice of embedding wikilinks in natural sentences so they carry traversal context — the surrounding sentence tells the agent when and why to follow the link.
---

# Wikilinks as Prose

A wikilink in a skill graph is not just a reference — it's a traversal instruction. The sentence around the link tells the agent *when* and *why* to follow it.

## The Pattern

Instead of bare link lists:

\`\`\`
Related: [[indexes]], [[query plans]], [[RLS]]
\`\`\`

Embed links in sentences:

> When a query scans more than 1000 rows, check whether [[missing indexes]] are forcing a sequential scan. If the table has RLS policies, [[RLS performance]] explains how to audit policy cost.

Now the agent knows: follow \`[[missing indexes]]\` when queries are slow, follow \`[[RLS performance]]\` when RLS policies exist. The link carries decision logic.

## Guidelines

- Every wikilink should appear inside a complete sentence
- The sentence should make the *condition* for following the link clear
- Use aliases when the target name doesn't read naturally: \`[[progressive disclosure|progressive approach]]\`
`,

  "agent-infra/agent-infra.md": `---
description: Map of content for foundational agent patterns — reusable techniques for how agents discover, traverse, and operate on knowledge structures.
---

# Agent Infrastructure

These are general-purpose patterns that any agent can apply, regardless of domain.

- [[progressive disclosure]] — the layered approach to loading only relevant knowledge from the graph
- [[cheap subagent pattern]] — spin up focused subagents for isolated tasks, keeping the main agent's context clean
- [[scope before you search]] — narrow the problem space before diving into implementation
- [[show dont ask]] — produce a concrete artifact first and iterate, rather than asking clarifying questions upfront
- [[iterate rapidly]] — ship a working version fast, then refine based on feedback
- [[degrees of freedom]] — identify what can vary in a solution to avoid over-constraining early decisions
`,

  "agent-infra/cheap subagent pattern.md": `---
description: Spin up lightweight subagents for isolated tasks to keep the main agent's context clean and focused on orchestration.
---

# Cheap Subagent Pattern

When a task has a clearly scoped subtask (research a topic, generate boilerplate, run a check), delegate it to a subagent instead of doing it inline. This keeps the main agent's context focused on the higher-level goal.

## When to Use

- The subtask has a clear input and output
- It doesn't need the main agent's full conversation history
- The result can be summarized in a few sentences

## How It Works

1. Define the subtask with a specific prompt
2. Launch a subagent with only the context it needs
3. Receive the result and integrate it into the main flow

The key insight: subagents are disposable. Their context is cheap. The main agent's context is expensive. Trade subagent context for main agent focus.
`,

  "agent-infra/scope before you search.md": `---
description: Narrow the problem space before searching or exploring — define what you're looking for and where it likely lives to avoid wasted context.
---

# Scope Before You Search

Before searching a codebase, documentation, or knowledge base, define:

1. **What** you're looking for (specific function, pattern, concept)
2. **Where** it likely lives (which files, folders, or clusters)
3. **How** you'll recognize it (filename patterns, keywords, frontmatter fields)

This prevents the common failure mode of broad, unfocused exploration that fills context with irrelevant results.
`,

  "agent-infra/show dont ask.md": `---
description: Produce a concrete artifact first and iterate on feedback, rather than asking multiple clarifying questions upfront that slow momentum.
---

# Show, Don't Ask

When requirements are ambiguous, produce a concrete first version instead of asking clarifying questions. A tangible artifact gives the user something to react to, which is faster and more productive than abstract Q&A.

The pattern: make a reasonable assumption, build the thing, show it, iterate. Two rounds of "here's what I built, what should change?" converge faster than five rounds of "what do you want?"
`,

  "agent-infra/iterate rapidly.md": `---
description: Ship a working version fast, then refine based on feedback — perfect is the enemy of good, especially when you can iterate cheaply.
---

# Iterate Rapidly

Get to a working state as fast as possible, even if it's rough. Then improve iteratively based on feedback and real usage.

This works because:
- Working code reveals problems that planning can't anticipate
- Users give better feedback on something concrete than on a spec
- Each iteration is a small, low-risk change rather than a big-bang rewrite
`,

  "agent-infra/degrees of freedom.md": `---
description: Identify which aspects of a solution can vary before committing — avoid over-constraining early decisions that lock out better approaches.
---

# Degrees of Freedom

Before implementing, identify what can vary:

- **Architecture** — monolith vs microservice, server vs serverless
- **Data model** — normalized vs denormalized, SQL vs document
- **Interface** — CLI vs API vs UI, sync vs async
- **Scope** — MVP vs full feature set

Naming these degrees of freedom early prevents accidentally locking into a suboptimal design. Make the high-impact decisions deliberately and leave the low-impact ones flexible.
`,
};
