type Lang = "ru" | "en" | "ur";

const NOT_FOUND: Record<Lang, string> = {
  ru: "Yeh sawal hamari maujooda kutub mein wazeh taur par nahi mila. Barae meharbani mufti sahab se rabta karein.",
  en: "This question was not clearly found in our current books. Please consult a qualified Mufti.",
  ur: "یہ سوال ہماری موجودہ کتب میں واضح طور پر نہیں ملا۔ براہ کرم کسی مفتی صاحب سے رجوع کریں۔",
};

const DISCLAIMER: Record<Lang, string> = {
  ru: "⚠️ Yeh jawab kutub ke matn par mabni hai. Tafseeli ya naya masla ho to mufti sahab se mashwara zaroor karein.",
  en: "⚠️ This answer is based on retrieved book passages. For detailed or new cases, consult a qualified Mufti.",
  ur: "⚠️ یہ جواب کتب سے حاصل شدہ عبارت پر مبنی ہے۔ تفصیلی یا نئے مسئلے میں کسی مفتی صاحب سے ضرور رجوع کریں۔",
};

export function notFoundMessage(lang: Lang): string {
  return NOT_FOUND[lang] ?? NOT_FOUND.ru;
}

export function disclaimerMessage(lang: Lang): string {
  return DISCLAIMER[lang] ?? DISCLAIMER.ru;
}
