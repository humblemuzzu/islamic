const QUERY_ALIASES: Record<string, string[]> = {
  haiz: ["hiz", "حیض", "ایام", "period", "periods", "mahwari", "ماہواری"],
  nifas: ["نفاس", "nifaas", "postnatal", "zachgi", "زچگی"],
  istihaza: ["استحاضہ", "istehaza", "irregular bleeding"],
  wuzu: ["وضو", "wudu", "wudhu", "ablution"],
  ghusl: ["غسل", "ghusal"],
  tayammum: ["تیمم", "tayamum"],
  salah: ["نماز", "salat", "prayer"],
  sawm: ["روزہ", "roza", "fasting", "صوم"],
  zakat: ["زکوۃ", "zakat", "zakaat"],
};

export function expandTextQueries(normalizedQuestion: string): string[] {
  const queries = new Set<string>();
  const base = normalizedQuestion.trim();
  if (base) queries.add(base);

  const lower = base.toLowerCase();
  for (const aliases of Object.values(QUERY_ALIASES)) {
    if (aliases.some((alias) => lower.includes(alias.toLowerCase()))) {
      for (const alias of aliases) {
        queries.add(alias.toLowerCase());
      }
    }
  }

  return [...queries].filter((query) => query.length >= 2).slice(0, 6);
}
