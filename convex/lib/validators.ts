import { v } from "convex/values";

export const chunkInputValidator = v.object({
  externalId: v.string(),
  text: v.string(),
  textNormalized: v.string(),
  sourceBook: v.string(),
  sourcePdf: v.string(),
  sourceBookShort: v.string(),
  sourceKey: v.string(),
  pageStart: v.number(),
  pageEnd: v.number(),
  chapterHeader: v.optional(v.string()),
  topicTags: v.array(v.string()),
  language: v.string(),
  wordCount: v.number(),
  hasArabic: v.boolean(),
  embeddingProvider: v.string(),
  embeddingModel: v.string(),
  embeddingDimensions: v.number(),
  embedding: v.array(v.float64()),
});

export const askLanguageValidator = v.union(
  v.literal("ru"),
  v.literal("en"),
  v.literal("ur"),
);
