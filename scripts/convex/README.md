# Phase 3 (Convex) — DB Preparation Scripts

These scripts prepare Convex for kitab-search ingestion using existing Phase 2 artifacts.

## 1) Folder-scoped env files (dev + prod)

Create/update separate env files so deployments stay in sync without touching global CLI state:

```bash
# Production env file
npm run convex:set-env -- \
  --out .env.convex.prod.local \
  --deployment prod:hardy-ptarmigan-266 \
  --cloud-url https://hardy-ptarmigan-266.convex.cloud \
  --site-url https://hardy-ptarmigan-266.convex.site

# Development env file
npm run convex:set-env -- \
  --out .env.convex.dev.local \
  --deployment dev:curious-moose-985 \
  --cloud-url https://curious-moose-985.convex.cloud \
  --site-url https://curious-moose-985.convex.site
```

Add `CONVEX_DEPLOY_KEY`, `CONVEX_INGEST_KEY`, Gemini/Mistral keys into both files (or at least prod if only prod sync is required).

## 2) Validate local chunks

```bash
npm run convex:validate-chunks
```

Checks:
- embedding presence/dimensions
- empty text rows
- page range sanity

## 3) Deploy Convex functions/schema

```bash
npm run convex:deploy:prod
npm run convex:deploy:dev
```

If dev deploy key is not available, dev deploy may fail; prod can still proceed independently.

## 4) Upload chunks

```bash
# Production
npm run convex:upload:prod -- --batch 40

# Development
npm run convex:upload:dev -- --batch 40
```

Optional flags:

```bash
--dry-run
--reset
--provider <name>
--model <name>
--dimensions <n>
--env-file <path>
```

Uploader source:
- input: `chunks/all-chunks-embedded.jsonl` (or `.json`)
- report: `chunks/chunking-report.json`

## 5) Verify + smoke test

```bash
npm run convex:check-stats:prod
npm run convex:smoke-ask:prod

npm run convex:check-stats:dev
npm run convex:smoke-ask:dev
```

## 6) One-command prod sync

```bash
npm run convex:sync:prod
```

This does: deploy -> upload -> stats -> smoke ask (production).
