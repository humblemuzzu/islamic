import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const embeddingDimensions = 768; // gemini-embedding-001 with outputDimensionality=768

export default defineSchema({
  searchConfig: defineTable({
    key: v.string(),
    embeddingProvider: v.string(),
    embeddingModel: v.string(),
    embeddingDimensions: v.number(),
    answerModel: v.string(),
    relevanceThreshold: v.number(),
    fallbackToTextSearch: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  chunks: defineTable({
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
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_external_id", ["externalId"])
    .index("by_source_page", ["sourceBookShort", "pageStart"])
    .index("by_source_key", ["sourceKey"])
    .searchIndex("by_text", {
      searchField: "textNormalized",
      filterFields: ["sourceBookShort", "language"],
    })
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: embeddingDimensions,
      filterFields: ["sourceBookShort", "language", "embeddingModel"],
    }),

  rateLimits: defineTable({
    identifier: v.string(),
    windowStart: v.number(),
    requestCount: v.number(),
    updatedAt: v.number(),
  }).index("by_identifier", ["identifier"]),

  questions: defineTable({
    question: v.string(),
    language: v.string(),
    normalizedQuestion: v.string(),
    resultsFound: v.boolean(),
    topScore: v.optional(v.number()),
    passageCount: v.number(),
    providerUsed: v.string(),
    processingTimeMs: v.number(),
    errorMessage: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_found", ["resultsFound", "timestamp"]),

  ingestionRuns: defineTable({
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    status: v.string(),
    sourcePath: v.string(),
    embeddingProvider: v.string(),
    embeddingModel: v.string(),
    embeddingDimensions: v.number(),
    totalChunks: v.number(),
    insertedCount: v.number(),
    updatedCount: v.number(),
    skippedCount: v.number(),
    errorCount: v.number(),
    notes: v.optional(v.string()),
  }).index("by_started_at", ["startedAt"]),
});
