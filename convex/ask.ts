import { action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { askLanguageValidator } from "./lib/validators";
import { disclaimerMessage, notFoundMessage } from "./lib/messages";
import { mergeAndRank, scoreToPercent } from "./lib/ranking";
import { enrichQueryForEmbedding, expandTextQueries } from "./lib/queryExpansion";
import {
  detectQuestionLanguage,
  normalizeForSearch,
  sanitizeQuestion,
} from "./lib/sanitize";
import {
  embedWithGemini,
  embedWithMistral,
  formatPassagesRaw,
  formatWithGemini,
} from "./gemini";

type AskLang = "ru" | "en" | "ur";

export const askQuestion = action({
  args: {
    question: v.string(),
    lang: v.optional(askLanguageValidator),
    clientId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const startedAt = Date.now();
    const sanitized = sanitizeQuestion(args.question);

    if (!sanitized) {
      return { error: "Sawal khali hai." };
    }
    if (sanitized.length < 3) {
      return { error: "Sawal bohat chota hai. Thora wazeh likhein." };
    }

    const lang: AskLang = args.lang ?? detectQuestionLanguage(sanitized);
    const normalizedQuestion = normalizeForSearch(sanitized);

    const identifier = args.clientId?.slice(0, 120) || "anonymous";
    const limit = await ctx.runMutation(internal.rateLimiter.checkAndIncrement, {
      identifier,
      maxRequests: 30,
      windowMs: 60 * 60 * 1000,
    });

    if (!limit.allowed) {
      return {
        error: "Aap ne bohat zyada sawalat kiye hain. Ek ghanta baad dobara koshish karein.",
        retryAfterMs: limit.retryAfterMs,
      };
    }

    const searchConfig = await ctx.runQuery(api.config.getSearchConfig, {});

    let vectorRows: any[] = [];
    let vectorError: string | undefined;
    const languageFilter = lang === "ur" ? "ur" : undefined;

    try {
      // Enrich the query with Urdu-script equivalents before embedding
      // "wuzu ke faraiz" → "wuzu ke faraiz (وضو فرائض)"
      const enrichedQuery = enrichQueryForEmbedding(sanitized);
      const embedding = await embedForConfiguredProvider(
        enrichedQuery,
        searchConfig.embeddingProvider,
      );

      if (embedding.length === searchConfig.embeddingDimensions) {
        vectorRows = await ctx.runAction(internal.search.vectorSearch, {
          vector: embedding,
          embeddingModel: searchConfig.embeddingModel,
          language: languageFilter,
          limit: 20,
        });
      } else {
        vectorError = `Embedding dimensions mismatch: expected ${searchConfig.embeddingDimensions}, got ${embedding.length}.`;
      }
    } catch (error) {
      vectorError = error instanceof Error ? error.message : "Vector search unavailable";
    }

    const textRows = searchConfig.fallbackToTextSearch
      ? await runExpandedTextSearch(ctx, normalizedQuestion, languageFilter)
      : [];

    const mergedBase = mergeAndRank(vectorRows, textRows, 12);
    const merged = rerankWithKeywordSignals(mergedBase, normalizedQuestion).slice(0, 5);
    const bestScore = merged[0]?.score ?? 0;
    const baseThreshold = Math.max(
      0.52,
      Math.min(searchConfig.relevanceThreshold, 0.65),
    );
    const threshold = vectorError ? Math.max(0.50, baseThreshold - 0.03) : baseThreshold;
    const found = merged.length > 0 && bestScore >= threshold;

    if (!found) {
      await ctx.runMutation(internal.questions.logQuestion, {
        question: sanitized,
        language: lang,
        normalizedQuestion,
        resultsFound: false,
        topScore: bestScore,
        passageCount: merged.length,
        providerUsed: searchConfig.embeddingProvider,
        processingTimeMs: Date.now() - startedAt,
        errorMessage: vectorError,
      });

      return {
        found: false,
        message: notFoundMessage(lang),
        passages: merged.map(toClientPassage),
        disclaimer: disclaimerMessage(lang),
      };
    }

    const passages = merged.map((item) => ({
      text: item.text,
      sourceBook: item.sourceBook,
      pageStart: item.pageStart,
      pageEnd: item.pageEnd,
      chapterHeader: item.chapterHeader,
    }));

    let formatted = await formatWithGemini(sanitized, passages, lang);
    if (!formatted || !hasCitation(formatted)) {
      formatted = formatPassagesRaw(passages, lang);
    }

    await ctx.runMutation(internal.questions.logQuestion, {
      question: sanitized,
      language: lang,
      normalizedQuestion,
      resultsFound: true,
      topScore: bestScore,
      passageCount: merged.length,
      providerUsed: searchConfig.embeddingProvider,
      processingTimeMs: Date.now() - startedAt,
      errorMessage: vectorError,
    });

    return {
      found: true,
      answer: formatted,
      passages: merged.map(toClientPassage),
      disclaimer: disclaimerMessage(lang),
      processingTimeMs: Date.now() - startedAt,
      vectorFallbackUsed: Boolean(vectorError),
      vectorFallbackReason: vectorError,
    };
  },
});

async function embedForConfiguredProvider(
  question: string,
  provider: string,
): Promise<number[]> {
  if (provider === "gemini") {
    return embedWithGemini(question);
  }
  return embedWithMistral(question);
}

async function runExpandedTextSearch(
  ctx: any,
  normalizedQuestion: string,
  language: string | undefined,
) {
  const queries = expandTextQueries(normalizedQuestion);
  const buckets = await Promise.all(
    queries.map((query) =>
      ctx.runQuery(internal.search.textSearch, {
        query,
        language,
        limit: 8,
      }),
    ),
  );

  const deduped = new Map<string, any>();
  for (const rows of buckets) {
    for (const row of rows) {
      const key = String(row._id);
      const existing = deduped.get(key);
      if (!existing || row.score > existing.score) {
        deduped.set(key, row);
      }
    }
  }

  return [...deduped.values()];
}

function hasCitation(text: string): boolean {
  return /📖|\bpage\b|\bصفحہ\b/i.test(text);
}

function rerankWithKeywordSignals(rows: any[], normalizedQuestion: string): any[] {
  const expandedTerms = expandTextQueries(normalizedQuestion);
  const terms = expandedTerms
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term.length >= 2)
    .slice(0, 12);

  if (!terms.length) {
    return rows;
  }

  // Split terms into "topic" terms (wuzu, haiz, etc.) and "qualifier" terms (faraiz, sunnat, etc.)
  const qualifierTerms = [
    "faraiz", "فرائض", "فرض", "sunnat", "سنت", "wajib", "واجب",
    "mustahab", "مستحب", "makruh", "مکروہ", "haram", "حرام",
    "fazail", "فضائل", "ثواب", "sawab", "tareeqa", "طریقہ",
    "sharait", "شرائط", "shart", "شرط",
  ];
  const queryQualifiers = terms.filter((t) =>
    qualifierTerms.some((q) => t.includes(q) || q.includes(t))
  );

  return rows
    .map((row) => {
      const haystack = `${row.text ?? ""}\n${row.chapterHeader ?? ""}`.toLowerCase();
      let topicMatches = 0;
      let qualifierMatches = 0;

      for (const term of terms) {
        if (haystack.includes(term)) {
          if (qualifierTerms.some((q) => term.includes(q) || q.includes(term))) {
            qualifierMatches += 1;
          } else {
            topicMatches += 1;
          }
        }
      }

      let score = Number(row.score ?? 0);

      // Boost for topic matches
      if (topicMatches > 0) {
        score += Math.min(0.12, topicMatches * 0.04);
      }

      // Bigger boost for qualifier matches (faraiz vs fazail distinction)
      if (qualifierMatches > 0) {
        score += Math.min(0.15, qualifierMatches * 0.06);
      }

      // Penalty: if query has qualifier terms but chunk doesn't match any
      if (queryQualifiers.length > 0 && qualifierMatches === 0) {
        score -= 0.12;
      }

      // Penalty: no topic OR qualifier match at all
      if (topicMatches === 0 && qualifierMatches === 0) {
        score -= 0.10;
      }

      return {
        ...row,
        score: Math.max(0, Math.min(1, score)),
      };
    })
    .sort((a, b) => b.score - a.score);
}

function toClientPassage(row: any) {
  return {
    text: row.text,
    sourceBook: row.sourceBook,
    sourcePdf: row.sourcePdf,
    pageStart: row.pageStart,
    pageEnd: row.pageEnd,
    chapterHeader: row.chapterHeader,
    topicTags: row.topicTags,
    score: scoreToPercent(row.score),
  };
}
