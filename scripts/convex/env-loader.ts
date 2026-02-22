import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

export function loadEnvFromArgs(defaultEnvFile = ".env.convex.local"): string {
  const args = process.argv.slice(2);
  const index = args.indexOf("--env-file");
  const requested = index >= 0 ? args[index + 1] : defaultEnvFile;
  const resolved = path.resolve(requested);

  if (fs.existsSync(resolved)) {
    dotenv.config({ path: resolved, quiet: true });
  }

  dotenv.config({ path: path.resolve(".env.local"), override: false, quiet: true });
  dotenv.config({ path: path.resolve(".env"), override: false, quiet: true });

  return resolved;
}
