import fs from "node:fs";
import path from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { loadEnvFromArgs } from "./env-loader";
import {
  detectEmbeddingDimension,
  iterPhase2Chunks,
  mapChunk,
  parseUploadArgs,
  retry,
} from "./upload-utils";
import type { IngestChunk } from "./upload-utils";

async function main() {
  loadEnvFromArgs();
  const args = parseUploadArgs();
  const convexUrl = process.env.CONVEX_URL;
  const ingestKey = process.env.CONVEX_INGEST_KEY;

  if (!convexUrl) {
    throw new Error("CONVEX_URL is required (example: https://curious-moose-985.convex.cloud)");
  }

  const report = JSON.parse(fs.readFileSync(path.resolve(args.reportPath), "utf-8"));
  const provider = String(args.provider ?? report?.embedding?.provider ?? "mistral");
  const model = String(args.model ?? report?.embedding?.embedding_model ?? "mistral-embed");
  const reportDimensions = Number(report?.embedding?.embedding_dimensions?.[0] ?? 1024);
  const detectedDimensions = await detectEmbeddingDimension(args.filePath);
  const requestedDimensions = args.dimensions ?? reportDimensions;

  if (requestedDimensions !== detectedDimensions) {
    throw new Error(
      `Embedding dimension mismatch: requested=${requestedDimensions}, file=${detectedDimensions}. Regenerate or pass correct --dimensions.`,
    );
  }

  const dimensions = requestedDimensions;
  const totalChunks = Number(report?.chunk_count ?? 0);
  const client = new ConvexHttpClient(convexUrl);

  if (args.dryRun) {
    console.log("[dry-run] Upload plan");
    console.log({
      convexUrl,
      filePath: path.resolve(args.filePath),
      provider,
      model,
      dimensions,
      totalChunks,
      batchSize: args.batchSize,
      reset: args.reset,
    });
    return;
  }

  if (args.reset) {
    const resetResult = await client.mutation("chunks:clearChunks", { ingestKey });
    console.log("Cleared chunks:", resetResult);
  }

  console.log("Starting ingestion run...");
  const run = await client.mutation("chunks:startIngestionRun", {
    ingestKey,
    sourcePath: path.resolve(args.filePath),
    embeddingProvider: provider,
    embeddingModel: model,
    embeddingDimensions: dimensions,
    totalChunks,
    notes: "Phase 3 upload from local chunk artifacts",
  });

  const runId = run.runId as string;
  console.log(`Ingestion run started: ${runId}`);
  const summary = {
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    processed: 0,
  };

  try {
    let batch: IngestChunk[] = [];

    for await (const row of iterPhase2Chunks(args.filePath)) {
      batch.push(mapChunk(row, provider, model, dimensions));

      if (batch.length >= args.batchSize) {
        await flushBatch(client, ingestKey, runId, dimensions, batch, summary);
        batch = [];
      }
    }

    if (batch.length > 0) {
      await flushBatch(client, ingestKey, runId, dimensions, batch, summary);
    }

    await client.mutation("chunks:finalizeIngestionRun", {
      ingestKey,
      runId,
      status: "completed",
      notes: `Processed=${summary.processed} Inserted=${summary.inserted} Updated=${summary.updated} Skipped=${summary.skipped}`,
    });
  } catch (error) {
    summary.failed += 1;
    await client.mutation("chunks:finalizeIngestionRun", {
      ingestKey,
      runId,
      status: "failed",
      notes: error instanceof Error ? error.message : "Unknown upload error",
    });
    throw error;
  }

  console.log("Upload complete", { ...summary, runId });
}

async function flushBatch(
  client: ConvexHttpClient,
  ingestKey: string | undefined,
  runId: string,
  expectedDimensions: number,
  chunks: IngestChunk[],
  summary: {
    inserted: number;
    updated: number;
    skipped: number;
    processed: number;
  },
) {
  const result = await uploadAdaptive(client, ingestKey, runId, expectedDimensions, chunks);

  summary.inserted += result.inserted;
  summary.updated += result.updated;
  summary.skipped += result.skipped;
  summary.processed += chunks.length;

  if (summary.processed % 200 === 0) {
    console.log(`Progress: ${summary.processed}`);
  }
}

async function uploadAdaptive(
  client: ConvexHttpClient,
  ingestKey: string | undefined,
  runId: string,
  expectedDimensions: number,
  chunks: IngestChunk[],
): Promise<{ inserted: number; updated: number; skipped: number }> {
  try {
    return await retry(async () => {
      return await client.mutation("chunks:ingestBatch", {
        ingestKey,
        runId,
        expectedDimensions,
        chunks,
      });
    }, 3);
  } catch (error) {
    if (chunks.length <= 1) {
      console.error("Failed to upload single chunk", {
        externalId: chunks[0]?.externalId,
      });
      throw error;
    }

    console.warn(`Batch of ${chunks.length} failed, retrying in smaller chunks...`);

    const mid = Math.floor(chunks.length / 2);
    const left = chunks.slice(0, mid);
    const right = chunks.slice(mid);

    const leftResult = await uploadAdaptive(
      client,
      ingestKey,
      runId,
      expectedDimensions,
      left,
    );
    const rightResult = await uploadAdaptive(
      client,
      ingestKey,
      runId,
      expectedDimensions,
      right,
    );

    return {
      inserted: leftResult.inserted + rightResult.inserted,
      updated: leftResult.updated + rightResult.updated,
      skipped: leftResult.skipped + rightResult.skipped,
    };
  }
}

main().catch((error) => {
  console.error("upload-chunks failed:", error);
  process.exit(1);
});
