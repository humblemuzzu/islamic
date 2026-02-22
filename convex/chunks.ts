import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { chunkInputValidator } from "./lib/validators";

function assertIngestKey(ingestKey: string | undefined) {
  const expected = process.env.CONVEX_INGEST_KEY;
  if (!expected) return;
  if (!ingestKey || ingestKey !== expected) {
    throw new Error("Unauthorized ingestion key.");
  }
}

export const startIngestionRun = mutation({
  args: {
    ingestKey: v.optional(v.string()),
    sourcePath: v.string(),
    embeddingProvider: v.string(),
    embeddingModel: v.string(),
    embeddingDimensions: v.number(),
    totalChunks: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertIngestKey(args.ingestKey);

    const now = Date.now();
    const currentConfig = await ctx.db
      .query("searchConfig")
      .withIndex("by_key", (q) => q.eq("key", "default"))
      .first();

    if (currentConfig) {
      await ctx.db.patch(currentConfig._id, {
        embeddingProvider: args.embeddingProvider,
        embeddingModel: args.embeddingModel,
        embeddingDimensions: args.embeddingDimensions,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("searchConfig", {
        key: "default",
        embeddingProvider: args.embeddingProvider,
        embeddingModel: args.embeddingModel,
        embeddingDimensions: args.embeddingDimensions,
        answerModel: "gemini-2.0-flash",
        relevanceThreshold: 0.6,
        fallbackToTextSearch: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    const runId = await ctx.db.insert("ingestionRuns", {
      startedAt: now,
      status: "running",
      sourcePath: args.sourcePath,
      embeddingProvider: args.embeddingProvider,
      embeddingModel: args.embeddingModel,
      embeddingDimensions: args.embeddingDimensions,
      totalChunks: args.totalChunks,
      insertedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      notes: args.notes,
    });

    return { runId };
  },
});

export const ingestBatch = mutation({
  args: {
    ingestKey: v.optional(v.string()),
    runId: v.optional(v.id("ingestionRuns")),
    expectedDimensions: v.number(),
    chunks: v.array(chunkInputValidator),
  },
  handler: async (ctx, args) => {
    assertIngestKey(args.ingestKey);
    const now = Date.now();

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const errorSamples: Array<{ externalId: string; message: string }> = [];

    for (const chunk of args.chunks) {
      if (chunk.embedding.length !== args.expectedDimensions) {
        skipped += 1;
        continue;
      }

      try {
        const existing = await ctx.db
          .query("chunks")
          .withIndex("by_external_id", (q) => q.eq("externalId", chunk.externalId))
          .first();

        if (existing) {
          await ctx.db.patch(existing._id, {
            ...chunk,
            updatedAt: now,
          });
          updated += 1;
          continue;
        }

        await ctx.db.insert("chunks", {
          ...chunk,
          createdAt: now,
          updatedAt: now,
        });
        inserted += 1;
      } catch (error) {
        skipped += 1;
        if (errorSamples.length < 5) {
          errorSamples.push({
            externalId: chunk.externalId,
            message: error instanceof Error ? error.message : "Unknown ingest error",
          });
        }
      }
    }

    if (args.runId) {
      const run = await ctx.db.get(args.runId);
      if (run) {
        await ctx.db.patch(args.runId, {
          insertedCount: run.insertedCount + inserted,
          updatedCount: run.updatedCount + updated,
          skippedCount: run.skippedCount + skipped,
          errorCount: run.errorCount + errorSamples.length,
        });
      }
    }

    return { inserted, updated, skipped, errorSamples };
  },
});

export const finalizeIngestionRun = mutation({
  args: {
    ingestKey: v.optional(v.string()),
    runId: v.id("ingestionRuns"),
    status: v.union(v.literal("completed"), v.literal("failed")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertIngestKey(args.ingestKey);
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Ingestion run not found.");

    await ctx.db.patch(args.runId, {
      finishedAt: Date.now(),
      status: args.status,
      notes: args.notes ?? run.notes,
    });
  },
});

export const clearChunks = mutation({
  args: {
    ingestKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertIngestKey(args.ingestKey);

    const rows = await ctx.db.query("chunks").collect();
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }

    return { deleted: rows.length };
  },
});

export const setSearchConfigFromIngestion = internalMutation({
  args: {
    embeddingProvider: v.string(),
    embeddingModel: v.string(),
    embeddingDimensions: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("searchConfig")
      .withIndex("by_key", (q) => q.eq("key", "default"))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        embeddingProvider: args.embeddingProvider,
        embeddingModel: args.embeddingModel,
        embeddingDimensions: args.embeddingDimensions,
        updatedAt: now,
      });
      return;
    }

    await ctx.db.insert("searchConfig", {
      key: "default",
      embeddingProvider: args.embeddingProvider,
      embeddingModel: args.embeddingModel,
      embeddingDimensions: args.embeddingDimensions,
      answerModel: "gemini-2.0-flash",
      relevanceThreshold: 0.6,
      fallbackToTextSearch: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getChunkStats = query({
  args: {},
  handler: async (ctx) => {
    // Only fetch the 3 most recent runs to minimize read volume.
    const latestRuns = await ctx.db
      .query("ingestionRuns")
      .withIndex("by_started_at")
      .order("desc")
      .take(3);

    const latestCompleted = latestRuns.find((run) => run.status === "completed");

    return {
      latestRun: latestCompleted ?? null,
      recentRuns: latestRuns,
    };
  },
});
