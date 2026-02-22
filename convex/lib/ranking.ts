type SearchRow = {
  _id: string;
  text: string;
  sourceBook: string;
  sourcePdf: string;
  sourceBookShort: string;
  pageStart: number;
  pageEnd: number;
  chapterHeader?: string;
  topicTags: string[];
  score: number;
};

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function enrichScore(row: SearchRow): number {
  let score = clampScore(row.score);

  if (row.chapterHeader?.trim()) {
    score += 0.015;
  }
  if ((row.topicTags?.length ?? 0) >= 2) {
    score += 0.01;
  }

  return clampScore(score);
}

export function mergeAndRank(
  vectorRows: SearchRow[],
  textRows: SearchRow[],
  limit: number,
): SearchRow[] {
  const byId = new Map<string, SearchRow>();

  for (const row of vectorRows) {
    byId.set(row._id, { ...row, score: clampScore(row.score) });
  }

  for (const row of textRows) {
    const existing = byId.get(row._id);
    const textScore = clampScore(row.score);
    if (!existing) {
      byId.set(row._id, { ...row, score: textScore });
      continue;
    }

    byId.set(row._id, {
      ...existing,
      score: clampScore(existing.score * 0.85 + textScore * 0.4),
    });
  }

  const byLocation = new Map<string, SearchRow>();
  for (const row of byId.values()) {
    const key = `${row.sourceBookShort}:${row.pageStart}-${row.pageEnd}`;
    const enriched = { ...row, score: enrichScore(row) };
    const existing = byLocation.get(key);

    if (!existing || enriched.score > existing.score) {
      byLocation.set(key, enriched);
    }
  }

  return [...byLocation.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function scoreToPercent(score: number): number {
  return Math.round(clampScore(score) * 100);
}
