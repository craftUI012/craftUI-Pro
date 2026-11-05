#!/usr/bin/env node
// Probes a component's real interactions and prints them as JSON.
//
//   node scripts/probe.mjs <item> [--keys ArrowLeft,Escape] [--base http://localhost:3000]
//
// Studio runs this before the feature audit (lib/studio/probe.ts). Needs
// the dev server for /preview/<item> and Chrome.

import { parseArgs } from "node:util";

import { probe } from "./lib/probe.mjs";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    base: { default: "http://localhost:3000", type: "string" },
    height: { default: "900", type: "string" },
    keys: { default: "", type: "string" },
    width: { default: "768", type: "string" },
  },
});

const [item] = positionals;
if (!item || !/^[a-z0-9-]+$/.test(item)) {
  console.error("usage: node scripts/probe.mjs <item>");
  process.exit(2);
}

const result = await probe({
  height: Number(values.height),
  keys: values.keys.split(",").filter(Boolean),
  url: `${values.base}/preview/${item}`,
  width: Number(values.width),
});
process.stdout.write(`${JSON.stringify(result)}\n`);
