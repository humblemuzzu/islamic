import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
if (!args.length) {
  console.error("Usage: tsx scripts/convex/run-convex.ts <convex-args>");
  process.exit(1);
}

const envFilePath = path.resolve(".env.convex.local");
const hasEnvFileArg = args.includes("--env-file");
const finalArgs = [...args];

if (!hasEnvFileArg && fs.existsSync(envFilePath)) {
  finalArgs.push("--env-file", envFilePath);
}

const child = spawn("npx", ["convex", ...finalArgs], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 0));
