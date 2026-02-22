import fs from "node:fs";
import path from "node:path";

function main() {
  const deployment = getArg("--deployment");
  const cloudUrl = getArg("--cloud-url");
  const siteUrl = getArg("--site-url");
  const out = getArg("--out") ?? ".env.convex.local";

  if (!deployment || !cloudUrl) {
    throw new Error(
      "Usage: npm run convex:set-env -- --deployment dev:curious-moose-985 --cloud-url https://curious-moose-985.convex.cloud [--site-url https://curious-moose-985.convex.site] [--out .env.convex.local]",
    );
  }

  const envPath = path.resolve(out);
  const existing = fs.existsSync(envPath) ? readEnvFile(envPath) : new Map<string, string>();

  existing.set("CONVEX_DEPLOYMENT", deployment);
  existing.set("CONVEX_URL", cloudUrl);
  if (siteUrl) {
    existing.set("CONVEX_SITE_URL", siteUrl);
  }

  const preferred = [
    "CONVEX_DEPLOYMENT",
    "CONVEX_URL",
    "CONVEX_SITE_URL",
    "CONVEX_DEPLOY_KEY",
    "CONVEX_INGEST_KEY",
    "CONVEX_EMBEDDING_DIM",
    "GEMINI_API_KEY",
    "MISTRAL_API_KEY",
  ];

  const orderedKeys = [
    ...preferred.filter((key) => existing.has(key)),
    ...[...existing.keys()].filter((key) => !preferred.includes(key)).sort(),
  ];

  const lines = orderedKeys.map((key) => `${key}=${existing.get(key) ?? ""}`);
  fs.writeFileSync(envPath, `${lines.join("\n")}\n`, "utf-8");

  console.log(`Wrote ${envPath}`);
  console.log(`CONVEX_DEPLOYMENT=${existing.get("CONVEX_DEPLOYMENT")}`);
  console.log(`CONVEX_URL=${existing.get("CONVEX_URL")}`);
  console.log(`CONVEX_SITE_URL=${existing.get("CONVEX_SITE_URL") ?? ""}`);
}

function readEnvFile(filePath: string): Map<string, string> {
  const map = new Map<string, string>();
  const lines = fs.readFileSync(filePath, "utf-8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    map.set(key, value);
  }

  return map;
}

function getArg(flag: string): string | undefined {
  const args = process.argv.slice(2);
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  return args[index + 1];
}

main();
