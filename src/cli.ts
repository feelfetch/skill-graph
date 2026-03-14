#!/usr/bin/env node

import { runInit } from "./init.js";
import { startServer } from "./server.js";

const args = process.argv.slice(2);

if (args[0] === "init") {
  runInit().catch((err) => {
    console.error("Init failed:", err);
    process.exit(1);
  });
} else {
  startServer().catch((err) => {
    console.error("Server failed:", err);
    process.exit(1);
  });
}
