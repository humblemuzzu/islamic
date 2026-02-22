import { query } from "./_generated/server";
import { v } from "convex/values";

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    // Use .take() with reasonable limits instead of .collect() to avoid
    // hitting bytes/documents read limits on large tables.
    const recentQuestionsLimit = 1000;

    const [recentQuestions, unanswered, latestRuns, config] = await Promise.all([
      ctx.db
        .query("questions")
        .withIndex("by_timestamp")
        .order("desc")
        .take(recentQuestionsLimit),
      ctx.db
        .query("questions")
        .withIndex("by_found", (q) => q.eq("resultsFound", false))
        .take(recentQuestionsLimit),
      ctx.db
        .query("ingestionRuns")
        .withIndex("by_started_at")
        .order("desc")
        .take(5),
      ctx.db
        .query("searchConfig")
        .withIndex("by_key", (q) => q.eq("key", "default"))
        .first(),
    ]);

    const latestCompleted = latestRuns.find((run) => run.status === "completed") ?? null;

    return {
      totalChunks: latestCompleted?.totalChunks ?? 0,
      totalQuestions: recentQuestions.length,
      unansweredQuestions: unanswered.length,
      answeredQuestions: recentQuestions.length - unanswered.length,
      latestIngestionRun: latestCompleted,
      searchConfig: config,
    };
  },
});

export const getIngestionRuns = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    return await ctx.db
      .query("ingestionRuns")
      .withIndex("by_started_at")
      .order("desc")
      .take(limit ?? 20);
  },
});

export const getCoverage = query({
  args: { sampleSize: v.optional(v.number()) },
  handler: async (ctx, { sampleSize }) => {
    // Keep sample small — each chunk doc has a 1024-dim embedding array
    // which makes every doc ~8KB+. Reading 500 docs = 4MB+ of bytes read.
    const size = Math.min(Math.max(sampleSize ?? 50, 10), 100);
    const sample = await ctx.db.query("chunks").take(size);

    const byTopic = new Map<string, number>();
    const byLanguage = new Map<string, number>();

    for (const chunk of sample) {
      byLanguage.set(chunk.language, (byLanguage.get(chunk.language) ?? 0) + 1);
      for (const tag of chunk.topicTags) {
        byTopic.set(tag, (byTopic.get(tag) ?? 0) + 1);
      }
    }

    return {
      sampleSize: sample.length,
      byLanguage: Object.fromEntries([...byLanguage.entries()].sort()),
      topTopics: [...byTopic.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([topic, count]) => ({ topic, count })),
    };
  },
});
