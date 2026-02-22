/**
 * ask-client.ts — Client-side logic for the /ask page.
 * Talks to Convex via plain fetch (no SDK needed in browser).
 */

const CONVEX_URL = "https://hardy-ptarmigan-266.convex.cloud";

// ── Helpers ───────────────────────────────────────────────

function getClientId(): string {
  let id = localStorage.getItem("al-masail-client-id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("al-masail-client-id", id);
  }
  return id;
}

function getCurrentLang(): "en" | "ru" | "ur" {
  const lang = document.documentElement.getAttribute("data-lang");
  if (lang === "en" || lang === "ur") return lang;
  return "ru";
}

// ── DOM refs ──────────────────────────────────────────────

const form = document.getElementById("ask-form") as HTMLFormElement | null;
const input = document.getElementById("ask-input") as HTMLInputElement | null;
const submitBtn = document.getElementById("ask-submit") as HTMLButtonElement | null;
const loadingDiv = document.getElementById("ask-loading")!;
const resultsDiv = document.getElementById("ask-results")!;
const notFoundDiv = document.getElementById("ask-not-found")!;
const errorDiv = document.getElementById("ask-error")!;

// ── Debounce ──────────────────────────────────────────────

let lastSubmit = 0;
const MIN_GAP = 3000;

// ── Example chip clicks ──────────────────────────────────

document.querySelectorAll<HTMLButtonElement>(".ask-example-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const q = chip.getAttribute("data-question");
    if (q && input) {
      input.value = q;
      input.focus();
      form?.requestSubmit();
    }
  });
});

// ── Form submission ───────────────────────────────────────

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = input?.value.trim();
  if (!question) return;

  const now = Date.now();
  if (now - lastSubmit < MIN_GAP) {
    showError(
      getCurrentLang() === "ur"
        ? "تھوڑا انتظار کریں، پھر دوبارہ پوچھیں۔"
        : "Thoda intezar karein, phir dobara poochein."
    );
    return;
  }
  lastSubmit = now;

  setState("loading");

  try {
    const res = await fetch(`${CONVEX_URL}/api/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "ask:askQuestion",
        args: {
          question,
          lang: getCurrentLang(),
          clientId: getClientId(),
        },
      }),
    });

    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    const body = await res.json();
    const result = body.value ?? body;

    if (result.error) {
      showError(result.error);
      return;
    }

    if (!result.found) {
      showNotFound(result.message, result.passages);
      return;
    }

    showResults(result);
  } catch (err) {
    console.error("Ask error:", err);
    showError(
      getCurrentLang() === "ur"
        ? "کچھ غلط ہو گیا۔ دوبارہ کوشش کریں۔"
        : "Kuch galat ho gaya. Dobara koshish karein."
    );
  }
});

// ── State management ──────────────────────────────────────

function setState(state: "loading" | "results" | "not-found" | "error" | "idle") {
  loadingDiv.style.display = state === "loading" ? "block" : "none";
  resultsDiv.style.display = state === "results" ? "block" : "none";
  notFoundDiv.style.display = state === "not-found" ? "block" : "none";
  errorDiv.style.display = state === "error" ? "block" : "none";

  if (submitBtn) {
    submitBtn.disabled = state === "loading";
  }
}

// ── Render: Results ───────────────────────────────────────

function showResults(result: any) {
  setState("results");

  const passagesHtml = (result.passages ?? []).map(renderPassage).join("");
  const disclaimerHtml = result.disclaimer
    ? `<div class="inline-disclaimer">${escapeHtml(result.disclaimer)}</div>`
    : "";

  resultsDiv.innerHTML = `
    <div class="answer-card">
      <div class="answer-body">${markdownToHtml(result.answer)}</div>
    </div>
    ${passagesHtml ? `
    <div class="passages-block">
      <h3 class="passages-heading">
        <span data-lang-text="en" style="display:none">Source Passages</span>
        <span data-lang-text="ru" style="display:none">Asal Ibaarat</span>
        <span data-lang-text="ur" style="display:none">اصل عبارات</span>
      </h3>
      ${passagesHtml}
    </div>` : ""}
    ${disclaimerHtml}
  `;

  applyLangVisibility();
  resultsDiv.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ── Render: Not found ─────────────────────────────────────

function showNotFound(message: string, passages?: any[]) {
  setState("not-found");

  const low = (passages ?? []).filter((p: any) => p.score > 20);
  const maybeHtml = low.length
    ? `<div class="maybe-related">
        <h4 class="maybe-heading">
          <span data-lang-text="en" style="display:none">Possibly related:</span>
          <span data-lang-text="ru" style="display:none">Shayad yeh madadgar ho:</span>
          <span data-lang-text="ur" style="display:none">شاید یہ مددگار ہو:</span>
        </h4>
        ${low.map(renderPassage).join("")}
      </div>`
    : "";

  notFoundDiv.innerHTML = `
    <div class="not-found-card">
      <div class="not-found-icon">📚</div>
      <p class="not-found-text">${escapeHtml(message)}</p>
    </div>
    ${maybeHtml}
  `;

  applyLangVisibility();
  notFoundDiv.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ── Render: Error ─────────────────────────────────────────

function showError(message: string) {
  setState("error");
  errorDiv.innerHTML = `
    <div class="error-card">
      <span class="error-icon">⚠️</span>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
  setTimeout(() => { if (errorDiv.style.display !== "none") setState("idle"); }, 6000);
}

// ── Render: Single passage card ───────────────────────────

function renderPassage(p: any): string {
  const pageLabel = p.pageStart === p.pageEnd
    ? `${p.pageStart}`
    : `${p.pageStart}–${p.pageEnd}`;

  const chapter = p.chapterHeader
    ? `<span class="passage-chapter">${escapeHtml(p.chapterHeader)}</span>`
    : "";

  const tags = (p.topicTags ?? [])
    .slice(0, 4)
    .map((t: string) => `<span class="topic-chip">${escapeHtml(t)}</span>`)
    .join("");

  return `
    <div class="passage-card">
      <div class="passage-header">
        <span class="passage-source">📖 ${escapeHtml(p.sourceBook)}, Page ${pageLabel}</span>
        ${chapter}
      </div>
      <div class="passage-text" dir="auto">${escapeHtml(p.text)}</div>
      <div class="passage-footer">
        ${tags ? `<div class="passage-tags">${tags}</div>` : ""}
        <span class="passage-score">${p.score}%</span>
      </div>
    </div>
  `;
}

// ── Utilities ─────────────────────────────────────────────

function escapeHtml(text: string): string {
  const el = document.createElement("span");
  el.textContent = text;
  return el.innerHTML;
}

function markdownToHtml(md: string): string {
  if (!md) return "";
  return md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/^> (.*)$/gm, '<blockquote dir="auto">$1</blockquote>')
    .replace(/^---$/gm, '<hr class="passage-divider">')
    .replace(/📖/g, '<span class="book-icon">📖</span>')
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");
}

function applyLangVisibility() {
  const lang = getCurrentLang();
  document.querySelectorAll<HTMLElement>("[data-lang-text]").forEach((el) => {
    const elLang = el.getAttribute("data-lang-text");
    el.style.display = elLang === lang ? "inline" : "none";
  });
}
