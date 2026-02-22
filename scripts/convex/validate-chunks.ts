import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

type ValidationSummary = {
  total: number;
  dimensions: Record<string, number>;
  missingEmbedding: number;
  emptyText: number;
  badPages: number;
};

async function main() {
  const filePath = getArg("--file") ?? "chunks/all-chunks-embedded.jsonl";
  const reportPath = getArg("--report") ?? "chunks/chunking-report.json";

  const summary: ValidationSummary = {
    total: 0,
    dimensions: {},
    missingEmbedding: 0,
    emptyText: 0,
    badPages: 0,
  };

  const file = path.resolve(filePath);
  const stream = fs.createReadStream(file, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    summary.total += 1;

    const row = JSON.parse(line) as {
      textOriginal?: string;
      pageStart?: number;
      pageEnd?: number;
      embedding?: number[];
    };

    const dim = row.embedding?.length ?? 0;
    summary.dimensions[String(dim)] = (summary.dimensions[String(dim)] ?? 0) + 1;

    if (!dim) summary.missingEmbedding += 1;
    if (!row.textOriginal?.trim()) summary.emptyText += 1;
    if ((row.pageStart ?? 0) > (row.pageEnd ?? 0)) summary.badPages += 1;
  }

  let expected: unknown = undefined;
  if (fs.existsSync(path.resolve(reportPath))) {
    const report = JSON.parse(fs.readFileSync(path.resolve(reportPath), "utf-8"));
    expected = report?.embedding?.embedding_dimensions?.[0];
  }

  console.log("Chunk validation summary");
  console.log(JSON.stringify({ ...summary, expectedDimension: expected }, null, 2));

  if (summary.missingEmbedding || summary.emptyText || summary.badPages) {
    process.exit(2);
  }
}

function getArg(flag: string): string | undefined {
  const args = process.argv.slice(2);
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  return args[index + 1];
}

main().catch((error) => {
  console.error("validate-chunks failed:", error);
  process.exit(1);
});
