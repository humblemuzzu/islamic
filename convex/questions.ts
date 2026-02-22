import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

export const logQuestion = internalMutation({
  args: {
    question: v.string(),
    language: v.string(),
    normalizedQuestion: v.string(),
    resultsFound: v.boolean(),
    topScore: v.optional(v.number()),
    passageCount: v.number(),
    providerUsed: v.string(),
    processingTimeMs: v.number(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("questions", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

export const getUnanswered = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    return await ctx.db
      .query("questions")
      .withIndex("by_found", (q) => q.eq("resultsFound", false))
      .order("desc")
      .take(limit ?? 100);
  },
});

export const getRecentQuestions = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    return await ctx.db
      .query("questions")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit ?? 50);
  },
});
