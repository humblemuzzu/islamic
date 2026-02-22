import { ConvexHttpClient } from "convex/browser";
import { loadEnvFromArgs } from "./env-loader";

type QueryResult = Record<string, unknown>;

async function main() {
  loadEnvFromArgs();
  const convexUrl = process.env.CONVEX_URL;
  if (!convexUrl) throw new Error("CONVEX_URL missing.");

  const client = new ConvexHttpClient(convexUrl);
  const [stats, chunkStats, coverage, runs] = await Promise.all([
    client.query("admin:getStats", {}),
    client.query("chunks:getChunkStats", {}),
    client.query("admin:getCoverage", {}),
    client.query("admin:getIngestionRuns", { limit: 5 }),
  ]);

  console.log("Admin stats:");
  console.log(JSON.stringify(stats as QueryResult, null, 2));
  console.log("\nChunk stats:");
  console.log(JSON.stringify(chunkStats as QueryResult, null, 2));
  console.log("\nCoverage:");
  console.log(JSON.stringify(coverage as QueryResult, null, 2));
  console.log("\nRecent ingestion runs:");
  console.log(JSON.stringify(runs as QueryResult, null, 2));
}

main().catch((error) => {
  console.error("check-stats failed:", error);
  process.exit(1);
});
