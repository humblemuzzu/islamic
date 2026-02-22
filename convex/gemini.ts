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

// ── Answer formatting ─────────────────────────────────────

export async function formatWithGemini(
  question: string,
  passages: RenderPassage[],
  lang: AskLang,
): Promise<string> {
  const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!key) return formatPassagesRaw(passages, lang);

  // Only send top 3 passages, truncated to keep context focused
  const trimmedPassages = passages.slice(0, 3).map((p) => ({
    ...p,
    text: truncateText(p.text, 800),
  }));

  const response = await fetch(`${GEMINI_GENERATE_URL}?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: buildSystemPrompt(lang) }] },
      contents: [
        {
          role: "user",
          parts: [{ text: buildUserPrompt(question, trimmedPassages) }],
        },
      ],
      generationConfig: {
        temperature: 0.15,
        topP: 0.85,
        maxOutputTokens: 800,
        // Disable thinking for formatting (faster + no token budget conflict)
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  if (!response.ok) return formatPassagesRaw(passages, lang);

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string; thought?: boolean }>;
      };
    }>;
  };

  // Gemini 2.5 Flash may return multiple parts (thinking + answer).
  // Collect all non-thought text parts.
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const textParts = parts
    .filter((p) => p.text && !p.thought)
    .map((p) => p.text!.trim())
    .filter(Boolean);

  const text = textParts.join("\n\n");
  return text || formatPassagesRaw(passages, lang);
}

export function formatPassagesRaw(passages: RenderPassage[], lang: AskLang): string {
  // Fallback: show truncated passages with citations
  return passages
    .slice(0, 3)
    .map((p) => {
      const pageLabel =
        p.pageStart === p.pageEnd ? `${p.pageStart}` : `${p.pageStart}-${p.pageEnd}`;
      const prefix = lang === "ur" ? "صفحہ" : "Page";
      const truncated = truncateText(p.text, 400);
      return `📖 ${p.sourceBook}, ${prefix} ${pageLabel}\n\n${truncated}`;
    })
    .join("\n\n---\n\n");
}

// ── Prompt builders ───────────────────────────────────────

function buildSystemPrompt(lang: AskLang): string {
  const langInstruction =
    lang === "ur"
      ? "اردو رسم الخط میں جواب دو۔"
      : lang === "en"
        ? "Reply in simple English."
        : "Roman Urdu mein jawab do (jaise: 'Ghusl ke 3 farz hain...').";

  return `You are "Kitab Search" — a librarian for Hanafi fiqh books.

YOUR JOB: Read the retrieved passages and give a SHORT, CLEAR answer to the user's question.

CRITICAL RULES:
1. ${langInstruction}
2. Be CONCISE. Maximum 5-8 sentences for the main answer. No walls of text.
3. Extract ONLY the specific ruling that answers the question. Do NOT dump the entire passage.
4. Format as a direct answer, like a knowledgeable person explaining simply.
5. After your answer, cite the source: 📖 Book Name, Page X
6. ONLY use information from the given passages. Never add your own fiqh knowledge.
7. If passages don't clearly answer the question, say so honestly.
8. Preserve Arabic text (Quran, Hadith) exactly — do NOT translate Arabic.
9. If the answer involves a numbered list (like "3 farz"), list them clearly.

EXAMPLE FORMAT (Roman Urdu):
"Ghusl ke 3 farz hain:
1. Kuli karna (munh mein paani daalna)
2. Naak mein paani daalna
3. Poore badan par paani bahana — koi bhi jagah khushk na rahe

📖 Bahar-e-Shariat Jild 1, Page 316"

EXAMPLE FORMAT (English):
"There are 3 obligatory acts (farz) of ghusl:
1. Rinsing the mouth (gargling)
2. Sniffing water into the nose
3. Washing the entire body — no spot should remain dry

📖 Bahar-e-Shariat Vol 1, Page 316"

DO NOT write long paragraphs. DO NOT paste raw Urdu text. EXTRACT the ruling and present it simply.`;
}

function buildUserPrompt(question: string, passages: RenderPassage[]): string {
  const passageText = passages
    .map((p, idx) => {
      const chapter = p.chapterHeader ? ` | Chapter: ${p.chapterHeader}` : "";
      return `--- Passage ${idx + 1} (${p.sourceBook}, p.${p.pageStart}${chapter}) ---\n${p.text}`;
    })
    .join("\n\n");

  return `Question: ${question}\n\nPassages from books:\n${passageText}`;
}

// ── Utilities ─────────────────────────────────────────────

/** Truncate text to roughly `maxWords` words, cutting at a sentence boundary if possible. */
function truncateText(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;

  const truncated = words.slice(0, maxWords).join(" ");

  // Try to cut at a sentence boundary
  const lastSentenceEnd = Math.max(
    truncated.lastIndexOf("۔"),
    truncated.lastIndexOf("."),
    truncated.lastIndexOf("—"),
    truncated.lastIndexOf("\n"),
  );

  if (lastSentenceEnd > truncated.length * 0.5) {
    return truncated.slice(0, lastSentenceEnd + 1) + " …";
  }

  return truncated + " …";
}
