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
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

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

export async function formatWithGemini(
  question: string,
  passages: RenderPassage[],
  lang: AskLang,
): Promise<string> {
  const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!key) return formatPassagesRaw(passages, lang);

  const response = await fetch(`${GEMINI_GENERATE_URL}?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: buildSystemPrompt(lang) }] },
      contents: [
        {
          role: "user",
          parts: [{ text: buildUserPrompt(question, passages) }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        topP: 0.8,
        maxOutputTokens: 1800,
      },
    }),
  });

  if (!response.ok) return formatPassagesRaw(passages, lang);

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  return text || formatPassagesRaw(passages, lang);
}

export function formatPassagesRaw(passages: RenderPassage[], lang: AskLang): string {
  return passages
    .map((p) => {
      const pageLabel = p.pageStart === p.pageEnd ? `${p.pageStart}` : `${p.pageStart}-${p.pageEnd}`;
      const prefix = lang === "ur" ? "صفحہ" : "Page";
      return `📖 ${p.sourceBook}, ${prefix} ${pageLabel}\n\n${p.text}`;
    })
    .join("\n\n---\n\n");
}

function buildUserPrompt(question: string, passages: RenderPassage[]): string {
  const payload = passages
    .map((p, idx) => {
      const chapter = p.chapterHeader ? `Chapter: ${p.chapterHeader}\n` : "";
      return [
        `=== PASSAGE ${idx + 1} ===`,
        `Book: ${p.sourceBook}`,
        `Pages: ${p.pageStart}-${p.pageEnd}`,
        chapter,
        `Text:\n${p.text}`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  return `User query (search terms only):\n${question}\n\nRetrieved passages:\n${payload}`;
}

function buildSystemPrompt(lang: AskLang): string {
  const languageLabel =
    lang === "ur" ? "Urdu script" : lang === "en" ? "English" : "Roman Urdu";

  return [
    "You are Kitab Search formatter.",
    "Only present information from given passages.",
    "Do not generate new fiqh rulings.",
    "If passage is insufficient, state that clearly.",
    "Preserve Arabic quotations exactly.",
    `Respond in ${languageLabel}.`,
    "Show citation after each passage as: 📖 Book, Page X-Y",
  ].join(" ");
}
