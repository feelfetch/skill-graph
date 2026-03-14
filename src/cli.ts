#!/usr/bin/env node

import { runInit } from "./init.js";
import { startServer } from "./server.js";
import { runAdd } from "./add.js";

const args = process.argv.slice(2);

if (args[0] === "init") {
  runInit().catch((err) => {
    console.error("Init failed:", err);
    process.exit(1);
  });
} else if (args[0] === "add") {
  const source = args[1];
  if (!source) {
    console.error("Usage: skill-graph add <owner/repo | local-path> [--skill name] [--force]");
    process.exit(1);
  }
  const skillIdx = args.indexOf("--skill");
  const skill = skillIdx !== -1 ? args[skillIdx + 1] : undefined;
  const force = args.includes("--force");

  runAdd(source, { skill, force }).catch((err) => {
    console.error("Add failed:", err);
    process.exit(1);
  });
} else {
  startServer().catch((err) => {
    console.error("Server failed:", err);
    process.exit(1);
  });
}
