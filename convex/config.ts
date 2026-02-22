import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_KEY = "default";

export const getSearchConfig = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("searchConfig")
      .withIndex("by_key", (q) => q.eq("key", DEFAULT_KEY))
      .first();

    if (row) return row;

    return {
      key: DEFAULT_KEY,
      embeddingProvider: "gemini",
      embeddingModel: "gemini-embedding-001",
      embeddingDimensions: Number(process.env.CONVEX_EMBEDDING_DIM ?? "768") || 768,
      answerModel: "gemini-2.5-flash",
      relevanceThreshold: 0.58,
      fallbackToTextSearch: true,
    };
  },
});

export const upsertSearchConfig = internalMutation({
  args: {
    embeddingProvider: v.string(),
    embeddingModel: v.string(),
    embeddingDimensions: v.number(),
    answerModel: v.optional(v.string()),
    relevanceThreshold: v.optional(v.number()),
    fallbackToTextSearch: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("searchConfig")
      .withIndex("by_key", (q) => q.eq("key", DEFAULT_KEY))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        answerModel: args.answerModel ?? existing.answerModel,
        relevanceThreshold: args.relevanceThreshold ?? existing.relevanceThreshold,
        fallbackToTextSearch: args.fallbackToTextSearch ?? existing.fallbackToTextSearch,
        updatedAt: now,
      });
      return { updated: true };
    }

    await ctx.db.insert("searchConfig", {
      key: DEFAULT_KEY,
      embeddingProvider: args.embeddingProvider,
      embeddingModel: args.embeddingModel,
      embeddingDimensions: args.embeddingDimensions,
      answerModel: args.answerModel ?? "gemini-2.0-flash",
      relevanceThreshold: args.relevanceThreshold ?? 0.6,
      fallbackToTextSearch: args.fallbackToTextSearch ?? true,
      createdAt: now,
      updatedAt: now,
    });

    return { updated: false };
  },
});
