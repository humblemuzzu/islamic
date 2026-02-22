type AskLang = "ru" | "en" | "ur";

type RenderPassage = {
  text: string;
  sourceBook: string;
  pageStart: number;
  pageEnd: number;
  chapterHeader?: string;
};

const GEMINI_EMBED_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent";
const GEMINI_GENERATE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

// ── Embedding functions ───────────────────────────────────

export async function embedWithGemini(text: string): Promise<number[]> {
  const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!key) throw new Error("Gemini API key missing.");

  const response = await fetch(`${GEMINI_EMBED_URL}?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "models/gemini-embedding-001",
      content: { parts: [{ text }] },
      taskType: "RETRIEVAL_QUERY",
      outputDimensionality: 768,
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini embedding failed (${response.status})`);
  }

  const data = (await response.json()) as { embedding?: { values?: number[] } };
  const values = data.embedding?.values ?? [];
  if (!values.length) throw new Error("Gemini embedding returned empty vector.");
  return values;
}

export async function embedWithMistral(text: string): Promise<number[]> {
  const key = process.env.MISTRAL_API_KEY;
  if (!key) throw new Error("Mistral API key missing.");

  const response = await fetch("https://api.mistral.ai/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "mistral-embed",
      input: [text],
    }),
  });

  if (!response.ok) {
    throw new Error(`Mistral embedding failed (${response.status})`);
  }

  const data = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };
  const vector = data.data?.[0]?.embedding ?? [];
  if (!vector.length) throw new Error("Mistral embedding returned empty vector.");
  return vector;
}

// ── Answer formatting with Gemini ─────────────────────────

export async function formatWithGemini(
  question: string,
  passages: RenderPassage[],
  lang: AskLang,
): Promise<string> {
  const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!key) return buildFallbackAnswer(passages, lang);

  // Only send top 3 passages, truncated
  const trimmed = passages.slice(0, 3).map((p) => ({
    ...p,
    text: truncateText(p.text, 600),
  }));

  const response = await fetch(`${GEMINI_GENERATE_URL}?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: buildSystemPrompt(lang) }] },
      contents: [
        { role: "user", parts: [{ text: buildUserPrompt(question, trimmed) }] },
      ],
      generationConfig: {
        temperature: 0.15,
        topP: 0.9,
        maxOutputTokens: 1200,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  if (!response.ok) return buildFallbackAnswer(passages, lang);

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string; thought?: boolean }>;
      };
    }>;
  };

  // Gemini 3 Pro may have thinking parts — collect only text parts
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const textParts = parts
    .filter((p) => p.text && !p.thought)
    .map((p) => p.text!.trim())
    .filter(Boolean);

  const text = textParts.join("\n\n");
  return text.length > 30 ? text : buildFallbackAnswer(passages, lang);
}

// Fallback if Gemini fails — simple citation-only format
export function buildFallbackAnswer(
  passages: RenderPassage[],
  lang: AskLang,
): string {
  const p = passages[0];
  if (!p) return "";
  const text = truncateText(p.text, 200);
  return `${text}\n\n📖 ${p.sourceBook}`;
}

// ── System prompt — THE critical safety + quality layer ───

function buildSystemPrompt(lang: AskLang): string {
  if (lang === "ur") {
    return PROMPT_UR;
  }
  if (lang === "en") {
    return PROMPT_EN;
  }
  return PROMPT_RU;
}

// ── Separate, complete prompts per language ───────────────
// Keeping them separate avoids Gemini "drifting" into Urdu because
// the passages are in Urdu script. Each prompt is self-contained
// with examples IN THAT LANGUAGE so Gemini stays locked.

const SAFETY_BLOCK = `
SAFETY RULES (NEVER BREAK):
- ONLY use information from the provided passages. NEVER add your own rulings.
- NEVER mention qatl (killing), death penalty, physical punishment, or hadd punishments. Skip those parts of passages entirely.
- For sensitive topics (kafir, talaq, murtad), end with: consult a local mufti.
- If passages don't answer the question, say so honestly.
- Do NOT show page numbers. Only show book names.
- Keep Arabic Quranic text and Hadith as-is (do not translate).
`.trim();

const PROMPT_RU = `You answer fiqh questions in ROMAN URDU (English letters, Urdu language).

⚠️ CRITICAL: Your ENTIRE response must be in ROMAN URDU using ENGLISH/LATIN LETTERS.
Do NOT write in Urdu script (اردو). Do NOT write in Arabic script.
The source passages are in Urdu script — you must TRANSLATE them into Roman Urdu.

FORMAT (follow exactly):
**Mukhtasar Jawab:**
[2-4 sentence direct answer in Roman Urdu]

📖 [Book names only, no page numbers]

**Tafseel:**
[5-10 sentence detailed explanation in Roman Urdu with numbered points]

EXAMPLE OUTPUT:
**Mukhtasar Jawab:**
Ghusl ke teen farz hain: kulli karna, naak mein paani daalna, aur poore badan par paani bahana. Agar in mein se koi ek bhi chhoot jaye to ghusl nahi hoga.

📖 Bahar-e-Shariat Jild 1

**Tafseel:**
1. **Kulli karna** — munh ke har hisse mein paani pahunchana zaroori hai.
2. **Naak mein paani daalna** — naram haddi tak paani le jaana farz hai.
3. **Poore badan par paani bahana** — baal barabar jagah bhi khushk nahi rehni chahiye.

${SAFETY_BLOCK}

Remember: ROMAN URDU ONLY (Latin/English script). Never Urdu script.`;

const PROMPT_EN = `You answer fiqh questions in simple, clear ENGLISH.

FORMAT (follow exactly):
**Short Answer:**
[2-4 sentence direct answer in English]

📖 [Book names only, no page numbers]

**Details:**
[5-10 sentence detailed explanation in English with numbered points]

${SAFETY_BLOCK}

Remember: ENGLISH ONLY. Translate all Urdu passages into English.`;

const PROMPT_UR = `آپ فقہی سوالات کا جواب اردو رسم الخط میں دیتے ہیں۔

شکل:
**مختصر جواب:**
[۲ سے ۴ جملوں میں مختصر جواب]

📖 [صرف کتاب کا نام]

**تفصیل:**
[۵ سے ۱۰ جملوں میں تفصیلی جواب نمبروں کے ساتھ]

${SAFETY_BLOCK}

یاد رکھیں: صرف اردو رسم الخط میں جواب دیں۔`;

function buildUserPrompt(question: string, passages: RenderPassage[]): string {
  const passageText = passages
    .map((p, idx) => {
      return `[Passage ${idx + 1} — ${p.sourceBook}]\n${p.text}`;
    })
    .join("\n\n");

  return `Sawal: ${question}\n\nKutub se mil gayi ibaaraat:\n${passageText}`;
}

// ── Utilities ─────────────────────────────────────────────

function truncateText(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;

  const truncated = words.slice(0, maxWords).join(" ");
  const lastBreak = Math.max(
    truncated.lastIndexOf("۔"),
    truncated.lastIndexOf("."),
    truncated.lastIndexOf("\n"),
  );

  if (lastBreak > truncated.length * 0.5) {
    return truncated.slice(0, lastBreak + 1);
  }
  return truncated + " …";
}
