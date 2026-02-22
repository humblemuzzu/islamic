import { internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// vectorSearch uses ctx.vectorSearch which is only available in actions.
export const vectorSearch = internalAction({
  args: {
    vector: v.array(v.float64()),
    embeddingModel: v.string(),
    limit: v.number(),
    language: v.optional(v.string()),
  },
  handler: async (ctx, { vector, embeddingModel, limit, language }) => {
    // Convex vector search filter only supports single q.eq() or q.or().
    // No q.and(). Since all chunks share one embeddingModel, filter on
    // language when provided, otherwise on embeddingModel.
    const results = await ctx.vectorSearch("chunks", "by_embedding", {
      vector,
      limit,
      filter: language
        ? (q: any) => q.eq("language", language)
        : (q: any) => q.eq("embeddingModel", embeddingModel),
    });

    // Fetch full docs via an internal query (actions can't read db directly)
    const docs = await ctx.runQuery(internal.search.getChunksByIds, {
      ids: results.map((r) => r._id),
    });

    return docs
      .map((doc: any, index: number) => {
        if (!doc) return null;
        return {
          _id: doc._id,
          text: doc.text,
          sourceBook: doc.sourceBook,
          sourcePdf: doc.sourcePdf,
          sourceBookShort: doc.sourceBookShort,
          pageStart: doc.pageStart,
          pageEnd: doc.pageEnd,
          chapterHeader: doc.chapterHeader,
          topicTags: doc.topicTags,
          score: results[index]?._score ?? 0,
        };
      })
      .filter(Boolean);
  },
});

// Helper query to fetch chunks by IDs (used by vectorSearch action)
export const getChunksByIds = internalQuery({
  args: { ids: v.array(v.id("chunks")) },
  handler: async (ctx, { ids }) => {
    return Promise.all(ids.map((id) => ctx.db.get(id)));
  },
});

export const textSearch = internalQuery({
  args: {
    query: v.string(),
    limit: v.number(),
    language: v.optional(v.string()),
  },
  handler: async (ctx, { query, limit, language }) => {
    const rows = await ctx.db
      .query("chunks")
      .withSearchIndex("by_text", (q) =>
        language
          ? q.search("textNormalized", query).eq("language", language)
          : q.search("textNormalized", query),
      )
      .take(limit);

    return rows.map((doc) => ({
      _id: doc._id,
      text: doc.text,
      sourceBook: doc.sourceBook,
      sourcePdf: doc.sourcePdf,
      sourceBookShort: doc.sourceBookShort,
      pageStart: doc.pageStart,
      pageEnd: doc.pageEnd,
      chapterHeader: doc.chapterHeader,
      topicTags: doc.topicTags,
      score: 0.45,
    }));
  },
});
