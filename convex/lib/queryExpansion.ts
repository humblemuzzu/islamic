/**
 * Query expansion for cross-script (Roman Urdu ↔ Urdu) search.
 *
 * Key insight: Roman Urdu terms like "faraiz" and "fazail" sound similar
 * but mean completely different things. We expand EXACT fiqh terms so
 * the embedding model gets the Urdu-script version too.
 */

/** Each entry maps a Roman Urdu term to its Urdu equivalents + related terms. */
const FIQH_TERM_MAP: Record<string, string[]> = {
  // Topic terms (broad category matching)
  haiz: ["حیض", "ایام", "periods", "mahwari", "ماہواری"],
  nifas: ["نفاس", "نفاس", "postnatal", "zachgi", "زچگی"],
  istihaza: ["استحاضہ", "istehaza", "irregular bleeding"],
  wuzu: ["وضو", "وضوء", "wudu", "wudhu", "ablution"],
  ghusl: ["غسل", "ghusal", "نہانا"],
  tayammum: ["تیمم", "tayamum", "مٹی"],
  salah: ["نماز", "صلوۃ", "namaz", "salat", "prayer"],
  namaz: ["نماز", "صلوۃ", "salah", "salat", "prayer"],
  sawm: ["روزہ", "صوم", "roza", "fasting"],
  roza: ["روزہ", "صوم", "sawm", "fasting"],
  zakat: ["زکوۃ", "زکات", "صدقہ"],
  hajj: ["حج", "عمرہ", "umrah"],
  nikah: ["نکاح", "شادی", "marriage"],
  talaq: ["طلاق", "خلع", "عدت"],

  // Fiqh classification terms (these are CRITICAL for precision)
  faraiz: ["فرائض", "فرض", "فراىض", "obligatory", "wajib"],
  farz: ["فرض", "فرائض", "فراىض", "obligatory"],
  sunnat: ["سنت", "سنتیں", "مسنون", "sunnah"],
  wajib: ["واجب", "واجبات", "ضروری"],
  mustahab: ["مستحب", "مستحبات", "desirable"],
  makruh: ["مکروہ", "مکروہات", "disliked"],
  haram: ["حرام", "ممنوع", "forbidden"],
  mubah: ["مباح", "جائز", "permissible"],
  shart: ["شرط", "شرائط", "condition"],
  sharait: ["شرائط", "شرط", "conditions"],

  // Modern / daily life terms → classical Urdu equivalents
  injection: ["سوئی", "ٹیکا", "انجکشن", "پچکاری"],
  drip: ["ڈرپ", "نلکی", "سلائن"],
  medicine: ["دوائی", "دوا", "گولی"],
  toothpaste: ["منجن", "ٹوتھ پیسٹ"],
  smoking: ["سگریٹ", "تمباکو", "حقہ"],
  perfume: ["عطر", "خوشبو"],
  makeup: ["سنگھار", "بناؤ"],
  travel: ["سفر", "مسافر"],
  pregnant: ["حاملہ", "حمل"],
  breastfeeding: ["دودھ پلانا", "رضاعت"],
  eyedrops: ["آنکھ", "قطرے"],
  inhaler: ["دمہ", "سانس"],
  blood: ["خون", "خون نکلنا"],
  vomit: ["قے", "الٹی"],
  sleep: ["نیند", "سونا", "اونگھ"],
  eating: ["کھانا", "اکل"],
  forgetting: ["بھول", "بھولنا", "نسیان"],

  // Commonly confused terms - include ONLY exact matches, not near-misses
  fazail: ["فضائل", "فضیلت", "ثواب", "virtues", "rewards"],
  sawab: ["ثواب", "اجر", "reward"],
  tareeqa: ["طریقہ", "طریقے", "method"],
  tariqa: ["طریقہ", "طریقے", "method"],
  masail: ["مسائل", "احکام", "issues", "rulings"],
  ahkam: ["احکام", "حکم", "rulings"],
  hukm: ["حکم", "احکام", "ruling"],
  dua: ["دعا", "دعائیں", "supplication"],
  dhikr: ["ذکر", "اذکار", "remembrance"],
  tilawat: ["تلاوت", "قراءت", "recitation"],
  quran: ["قرآن", "قرآن مجید"],
  janaza: ["جنازہ", "نماز جنازہ", "funeral"],
  qibla: ["قبلہ", "قبلة"],
  imam: ["امام", "امامت"],
  muqtadi: ["مقتدی", "follower"],
  qasr: ["قصر", "نماز قصر", "shortened prayer"],
};

/**
 * Given a normalized search query, return expanded query variants
 * that include Urdu-script equivalents of Roman Urdu fiqh terms.
 *
 * e.g. "wuzu ke faraiz" → ["wuzu ke faraiz", "وضو", "فرائض", "فرض"]
 */
export function expandTextQueries(normalizedQuestion: string): string[] {
  const queries = new Set<string>();
  const base = normalizedQuestion.trim();
  if (base) queries.add(base);

  const lower = base.toLowerCase();
  const words = lower.split(/\s+/);

  for (const word of words) {
    const aliases = FIQH_TERM_MAP[word];
    if (aliases) {
      for (const alias of aliases) {
        queries.add(alias.toLowerCase());
      }
    }
  }

  // Also check if any alias appears as a substring (for Urdu script in the query)
  for (const [_key, aliases] of Object.entries(FIQH_TERM_MAP)) {
    if (aliases.some((alias) => lower.includes(alias.toLowerCase()))) {
      for (const alias of aliases) {
        queries.add(alias.toLowerCase());
      }
    }
  }

  return [...queries].filter((q) => q.length >= 2).slice(0, 10);
}

/**
 * Build a combined search string that includes both the original query
 * AND key Urdu-script terms. This is used for embedding the question
 * so the vector captures both scripts.
 */
export function enrichQueryForEmbedding(question: string): string {
  const lower = question.toLowerCase();
  const words = lower.split(/\s+/);
  const additions: string[] = [];

  for (const word of words) {
    const aliases = FIQH_TERM_MAP[word];
    if (aliases) {
      // Add the first Urdu-script alias (most important one)
      const urduAlias = aliases.find((a) => /[\u0600-\u06FF]/.test(a));
      if (urduAlias) additions.push(urduAlias);
    }
  }

  if (additions.length === 0) return question;
  return `${question} (${additions.join(" ")})`;
}
