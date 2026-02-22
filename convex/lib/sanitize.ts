const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;

export function sanitizeQuestion(value: string): string {
  return value
    .replace(/```/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/#{1,6}\s/g, " ")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 500);
}

export function normalizeForSearch(text: string): string {
  return text
    .normalize("NFKC")
    .replace(ARABIC_DIACRITICS, "")
    .replace(/[ؐﷺ]/g, "")
    .replace(/۔/g, ".")
    .toLowerCase()
    .replace(/[\[\]{}()<>]/g, " ")
    .replace(/[^\w\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\u0900-\u097F\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectQuestionLanguage(text: string): "ru" | "en" | "ur" {
  const urduChars = (text.match(/[\u0600-\u06FF]/g) ?? []).length;
  const latinChars = (text.match(/[A-Za-z]/g) ?? []).length;
  return urduChars > latinChars ? "ur" : "ru";
}

export function hasArabicScript(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}
