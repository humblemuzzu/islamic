# Convex Backend (Phase 3)

## Files

- `schema.ts` — chunk/search/rate-limit/question/ingestion tables
- `ask.ts` — main `askQuestion` action with vector+text fallback
- `gemini.ts` — embedding + answer formatting helpers (Gemini/Mistral fallback)
- `search.ts` — internal vector and text search queries
- `rateLimiter.ts` — request window limiter
- `chunks.ts` — ingestion run + batch upsert mutations
- `questions.ts` — logging queries/mutations
- `admin.ts` — stats and ingestion history
- `config.ts` — search config query/mutation

## Fallback behavior

1. If query embedding fails or dimension mismatches, request falls back to expanded text search.
2. If Gemini formatting fails (or returns output without citation markers), raw cited passages are returned.
3. If confidence is below configured threshold, response is returned as `found: false` with suggestions.
4. Threshold auto-relaxes slightly when vector search is unavailable, so text-only mode still works.

## Required env vars (Convex)

- `GEMINI_API_KEY` (for answer formatting and Gemini embeddings)
- `MISTRAL_API_KEY` (if using Mistral embedding mode)
- `CONVEX_INGEST_KEY` (optional, protects ingestion mutations)
- `CONVEX_EMBEDDING_DIM` (optional, defaults to `1024`)

## Notes

- Current local chunk artifacts are embedded with **Mistral 1024-dim** vectors.
- Keep `CONVEX_EMBEDDING_DIM=1024` unless you regenerate embeddings with another model.
