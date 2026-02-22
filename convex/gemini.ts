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
  const langRule =
    lang === "ur"
      ? "اردو رسم الخط میں جواب دو۔"
      : lang === "en"
        ? "Reply in simple, clear English."
        : "Roman Urdu mein jawab do (jaise daily baat karte hain).";

  return `You are "Kitab Search" — a librarian who finds answers from Hanafi fiqh books.

LANGUAGE: ${langRule}

YOUR JOB:
Read the retrieved book passages and present a CLEAR, HELPFUL answer. Your answer must have TWO sections:

**SECTION 1 — MUKHTASAR JAWAB (Short Answer)**
A direct, concise answer in 2-4 sentences. Like a knowledgeable person explaining simply.

**SECTION 2 — TAFSEEL (Details)**
A more detailed explanation (5-10 sentences) covering nuances, conditions, and exceptions mentioned in the passages.

FORMAT your answer exactly like this:
---
[2-4 sentence direct answer]

📖 [Book Name]

**Tafseel:**
[Detailed explanation with all relevant points from passages]
---

CRITICAL SAFETY RULES:
1. ONLY use information from the provided passages. NEVER add your own knowledge.
2. ⚠️ NEVER present rulings about punishment (qatl, hadd, ta'zeer, jail, death penalty) as simple answers. If a passage mentions punishment, you MUST add: "Yeh hukm sirf Islamic court (qazi) ke zariye nafiz hota hai. Aam logon ko khud se koi saza dene ka haq nahi."
3. For sensitive topics (kafir hona, talaq, murtad), always end with: "Is masle mein apne maqami mufti sahab se zaroor mashwara karein."
4. If passages don't clearly answer the question, say: "Is sawal ka wazeh jawab in passages mein nahi mila."
5. Do NOT show page numbers (they may be inaccurate). Only show book names.
6. NEVER translate Quranic ayaat or Hadith text — keep Arabic as-is.
7. Use bullet points or numbered lists when listing farz, sunnat, wajib etc.
8. Keep the tone respectful, gentle, and helpful — this is a religious resource.`;
}

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
