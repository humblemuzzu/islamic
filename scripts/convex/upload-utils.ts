import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

export type UploadArgs = {
  filePath: string;
  reportPath: string;
  batchSize: number;
  reset: boolean;
  dryRun: boolean;
  provider?: string;
  model?: string;
  dimensions?: number;
};

export type Phase2Chunk = {
  id: string;
  textOriginal: string;
  textNormalized: string;
  sourceBook: string;
  sourcePdf: string;
  sourceBookShort: string;
  sourceKey: string;
  pageStart: number;
  pageEnd: number;
  chapterHeader?: string;
  topicTags: string[];
  language: string;
  wordCount: number;
  embedding: number[];
};

export type IngestChunk = {
  externalId: string;
  text: string;
  textNormalized: string;
  sourceBook: string;
  sourcePdf: string;
  sourceBookShort: string;
  sourceKey: string;
  pageStart: number;
  pageEnd: number;
  chapterHeader?: string;
  topicTags: string[];
  language: string;
  wordCount: number;
  hasArabic: boolean;
  embeddingProvider: string;
  embeddingModel: string;
  embeddingDimensions: number;
  embedding: number[];
};

const DEFAULT_FILE = "chunks/all-chunks-embedded.jsonl";
const DEFAULT_REPORT = "chunks/chunking-report.json";

export function parseUploadArgs(): UploadArgs {
  const argv = process.argv.slice(2);
  const get = (flag: string) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };

  const dimensionArg = get("--dimensions");

  return {
    filePath: get("--file") ?? DEFAULT_FILE,
    reportPath: get("--report") ?? DEFAULT_REPORT,
    batchSize: Number(get("--batch") ?? 40),
    reset: argv.includes("--reset"),
    dryRun: argv.includes("--dry-run"),
    provider: get("--provider"),
    model: get("--model"),
    dimensions: dimensionArg ? Number(dimensionArg) : undefined,
  };
}

export async function detectEmbeddingDimension(filePath: string): Promise<number> {
  const resolved = path.resolve(filePath);

  if (resolved.endsWith(".json")) {
    const rows = JSON.parse(fs.readFileSync(resolved, "utf-8")) as Phase2Chunk[];
    const dim = rows[0]?.embedding?.length ?? 0;
    if (!dim) throw new Error("Could not detect embedding dimensions from JSON file.");
    return dim;
  }

  const stream = fs.createReadStream(resolved, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    const row = JSON.parse(line) as Phase2Chunk;
    const dim = row.embedding?.length ?? 0;
    rl.close();
    stream.close();
    if (!dim) throw new Error("Could not detect embedding dimensions from JSONL file.");
    return dim;
  }

  throw new Error("No rows found in chunk file.");
}

export async function* iterPhase2Chunks(filePath: string): AsyncGenerator<Phase2Chunk> {
  const resolved = path.resolve(filePath);

  if (resolved.endsWith(".json")) {
    const rows = JSON.parse(fs.readFileSync(resolved, "utf-8")) as Phase2Chunk[];
    for (const row of rows) {
      yield row;
    }
    return;
  }

  const stream = fs.createReadStream(resolved, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    yield JSON.parse(line) as Phase2Chunk;
  }
}

export function mapChunk(
  row: Phase2Chunk,
  provider: string,
  model: string,
  dimensions: number,
): IngestChunk {
  return {
    externalId: row.id,
    text: row.textOriginal,
    textNormalized: row.textNormalized,
    sourceBook: normalizeSourceBook(row.sourceBook, row.sourcePdf),
    sourcePdf: row.sourcePdf,
    sourceBookShort: row.sourceBookShort,
    sourceKey: row.sourceKey,
    pageStart: row.pageStart,
    pageEnd: row.pageEnd,
    chapterHeader:
      typeof row.chapterHeader === "string" && row.chapterHeader.trim()
        ? row.chapterHeader
        : undefined,
    topicTags: row.topicTags ?? [],
    language: row.language,
    wordCount: row.wordCount,
    hasArabic: /[\u0600-\u06FF]/.test(row.textOriginal),
    embeddingProvider: provider,
    embeddingModel: model,
    embeddingDimensions: dimensions,
    embedding: row.embedding,
  };
}

function normalizeSourceBook(rawName: string, sourcePdf: string): string {
  if (!rawName.trim()) {
    return fromPdf(sourcePdf);
  }

  const latinSlug = /^[a-z0-9-]+$/i.test(rawName.trim());
  if (!latinSlug) return rawName.trim();

  return rawName
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function fromPdf(sourcePdf: string): string {
  const base = sourcePdf.split("/").pop() ?? sourcePdf;
  return base.replace(/\.pdf$/i, "").trim();
}

export async function retry<T>(fn: () => Promise<T>, maxAttempts: number): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) break;
      const delay = Math.min(10_000, 500 * 2 ** attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
