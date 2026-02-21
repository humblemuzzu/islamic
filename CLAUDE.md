# Al-Masail (المسائل) — Hanafi Fiqh Masail Website for Women

## Project Overview

A static, interactive Q&A website for women's Hanafi fiqh masail (Islamic jurisprudence rulings). Women can come to this site and easily find clear, authentic answers to their questions about haiz, istihaza, nifas, salah, sawm, taharah, and more.

**All answers and logic are manually set — no AI is used for rulings.** Every ruling is based on the Hanafi school of thought with references to classical texts (Nurul Idah, Al-Hidayah, Maraqi al-Falah, Radd al-Muhtar).

## Tech Stack

- **Framework:** Astro (static site generator) — NOT Next.js
- **Styling:** Vanilla CSS with CSS custom properties (no Tailwind, no CSS frameworks)
- **Interactivity:** Vanilla TypeScript/JS in `<script>` tags within Astro components
- **Database:** None — fully static, all content hardcoded in components
- **Fonts:** Google Fonts — Amiri (Arabic serif) + Outfit (English sans-serif) + Noto Nastaliq Urdu (Urdu script)
- **i18n:** 3-language support (Roman Urdu default, English, Urdu script) via CSS data-attribute toggle
- **Icons:** Inline SVGs, no icon libraries

## Commands

- `npm run dev` — Start dev server (localhost:4321)
- `npm run build` — Build static site for production
- `npm run preview` — Preview production build locally

## Project Structure (Target — Modular)

```
src/
├── i18n/
│   └── types.ts                # Shared types: Lang, I18nText, I18nMasala, QAScreen, QAOption, QAAnswer
├── content/                    # ALL content data lives here — no HTML, just typed exports
│   ├── masail/                 # Q&A data per topic
│   │   ├── haiz.ts             # export const haizMasail: I18nMasala[]
│   │   ├── istihaza.ts
│   │   ├── nifas.ts
│   │   ├── salah.ts
│   │   ├── sawm.ts
│   │   ├── taharah.ts
│   │   └── featured.ts        # Curated subset for homepage FeaturedMasail
│   ├── sawal/                  # Decision tree data
│   │   ├── categories.ts      # Category chips metadata
│   │   └── flows/             # One file per topic flow (QAScreen[])
│   │       ├── haiz.ts
│   │       ├── istihaza.ts
│   │       ├── nifas.ts
│   │       ├── salah.ts
│   │       ├── sawm.ts
│   │       ├── ghusl.ts
│   │       ├── quran.ts
│   │       ├── masjid.ts
│   │       └── zawaj.ts
│   ├── ramadan/
│   │   ├── wazaif.ts           # 30-day wazaif schedule data
│   │   └── dhikr.ts            # Daily dhikr lists
│   ├── counter/
│   │   └── themes.ts           # Dhikr counter themes
│   └── downloads/
│       └── pdfs.ts             # PDF metadata
├── components/
│   ├── common/                 # Shared building blocks
│   │   ├── T.astro             # Translation helper
│   │   ├── PageHero.astro      # Reusable hero section
│   │   └── Ornament.astro      # Gold ornament divider
│   ├── layout/                 # Site-wide structural
│   │   ├── Navbar.astro
│   │   ├── Footer.astro
│   │   └── LangToggle.astro
│   ├── home/                   # Homepage components
│   │   ├── Hero.astro
│   │   ├── Categories.astro
│   │   ├── QuickQuestion.astro
│   │   └── FeaturedMasail.astro
│   ├── topic/                  # Topic page components
│   │   ├── TopicHeader.astro
│   │   └── MasailList.astro
│   ├── sawal/                  # Decision tree components
│   │   ├── CategorySelector.astro
│   │   ├── QAScreen.astro
│   │   └── QAAnswer.astro
│   ├── ramadan/                # Ramadan page sections
│   │   ├── DhikrSection.astro
│   │   └── WazaifCard.astro
│   └── counter/                # Counter page sections
│       ├── TapArea.astro
│       └── ThemeSelector.astro
├── styles/
│   ├── global.css              # Design tokens + reset + utilities ONLY
│   ├── qa.css                  # Shared QA/decision-tree styles
│   ├── ramadan.css             # Ramadan page styles
│   ├── counter.css             # Counter page styles
│   └── downloads.css           # Downloads page styles
├── scripts/
│   ├── qa-engine.ts            # Decision tree navigation logic
│   ├── counter.ts              # Dhikr counter logic
│   └── scroll-reveal.ts        # Intersection observer
├── layouts/
│   └── Layout.astro            # Base HTML layout
└── pages/                      # THIN pages — compose components, import content
    ├── index.astro             # ~20 lines
    ├── haiz.astro              # ~30 lines (imports data from content/masail/haiz.ts)
    ├── istihaza.astro
    ├── nifas.astro
    ├── salah.astro
    ├── sawm.astro
    ├── taharah.astro
    ├── sawal.astro             # ~40 lines (imports flows from content/sawal/flows/)
    ├── ramadan.astro           # ~40 lines (imports data from content/ramadan/)
    ├── counter.astro           # ~30 lines
    └── downloads.astro         # ~30 lines
```

## Design System & Aesthetic

### Theme: Islamic Book Aesthetic
The site should feel like opening a beautifully bound Islamic book. Warm, earthy, elegant, respectful. NOT generic AI aesthetics.

### Color Palette (CSS variables in global.css)
- **Backgrounds:** `--ivory: #FAF7F2`, `--ivory-deep: #F0EBE1`, `--cream: #E8E0D0`
- **Primary:** `--teal: #1A5C52`, `--teal-deep: #0F3D36`, `--teal-light: #2A7A6E`
- **Accent:** `--gold: #C4A265`, `--gold-light: #D4B97A`, `--gold-muted: #B8975A`
- **Dark:** `--green-dark: #1B3B2F` (footer)
- **Text:** `--text-primary: #1E1E1E`, `--text-secondary: #5A5549`, `--text-light: #8A8478`

### STRICTLY AVOID
- Purple, pink, orange, yellow, neon colors
- Generic AI color schemes or gradients
- Inter, Roboto, Arial, or system fonts
- Emojis in the UI (use ✦ ornament sparingly)
- Stock images or external image dependencies

### Typography
- **Arabic text:** `var(--font-arabic)` — Amiri, serif. Used for Arabic titles, Bismillah, Quranic text. Always set `direction: rtl` on Arabic text.
- **English text:** `var(--font-body)` — Outfit, sans-serif. Weights 300-700.
- **Urdu script text:** `var(--font-urdu)` — Noto Nastaliq Urdu, serif. Applied automatically via `[data-lang-text="ur"]` CSS rule with `direction: rtl`.
- Section labels: 0.75rem, uppercase, letter-spacing 0.15em, gold-muted color
- Section titles: clamp(1.75rem, 4vw, 2.5rem), teal-deep, font-weight 600

### Patterns & Decoration
- Islamic geometric patterns are CSS-only (see `.pattern-overlay` and `.pattern-star` in global.css)
- Gold ornamental dividers using `✦` with gradient lines
- Top-border gradient (teal → gold) on hover for cards
- No external images for decoration

### Spacing & Layout
- CSS variables for spacing: `--space-xs` through `--space-4xl`
- Border radii: `--radius-sm: 6px` to `--radius-xl: 32px`
- Max container width: 1200px
- Mobile-first responsive (breakpoints: 640px, 768px, 1024px)
- Card-based layouts with gentle shadows (`--shadow-soft`, `--shadow-card`)

### Animations
- Scroll reveal: `.reveal` class + IntersectionObserver in Layout.astro
- Delay classes: `.reveal-delay-1` through `.reveal-delay-5`
- Transitions use `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)`
- Hover effects: translateY(-2px/-4px), translateX(4px) for arrows
- Background pattern drift animation (40s linear infinite)

## Core Fiqh Logic (Hanafi School)

This is the actual Islamic jurisprudence logic hardcoded into the site. **Do not change these rulings without explicit instruction.**

### Haiz (Menstruation)
- **Minimum duration:** 3 days and 3 nights (72 hours)
- **Maximum duration:** 10 days and 10 nights (240 hours)
- Bleeding < 3 days = istihaza, NOT haiz
- Bleeding > 10 days = habit ('aadah) determines haiz days, rest is istihaza
- If no established habit, default haiz = 10 days

### Tuhr (Purity Between Two Haiz)
- **Minimum gap between two valid haiz periods: 15 days**
- If bleeding returns before 15 clean days → second bleeding is istihaza
- If bleeding returns after 15+ clean days → new valid haiz (if it meets 3-10 day criteria)
- This is the most common question: e.g., "8 days period, 8 days clean, bleeding again" = istihaza because gap < 15 days

### Istihaza (Irregular Bleeding)
- Any bleeding that doesn't qualify as haiz or nifas
- Does NOT prevent salah — must pray during istihaza
- Perform wudu for each fard salah time
- Continuous bleeding = ma'zoor (excused person) rules apply

### Nifas (Post-Natal Bleeding)
- Maximum duration: 40 days
- No minimum — even a few hours counts
- Beyond 40 days = istihaza

### Salah During Cycles
- During valid haiz: salah not obligatory, does NOT need to be made up
- During istihaza: salah IS obligatory, must make fresh wudu each time
- After haiz ends: perform ghusl immediately, pray if time remains for at least 1 rak'ah

### Ghusl (Ritual Bath)
- 3 fard: rinse mouth, rinse nose, wash entire body
- Required after: haiz ends, nifas ends, janabah
- Until ghusl is done: no salah, no fasting, no touching mushaf, no entering masjid

### Sawm (Fasting)
- Cannot fast during haiz
- Missed fasts MUST be made up (unlike salah which doesn't need makeup)

## 3-Language System (i18n)

**All content must be provided in 3 languages: Roman Urdu (default), English, and Urdu script.**

### How It Works
- CSS data-attribute toggle: `html[data-lang="ru|en|ur"]` controls which `[data-lang-text]` spans are visible
- All 3 language versions are rendered inline at build time (no JS DOM manipulation for content)
- `<T en="..." ru="..." ur="..." />` helper component renders 3 `<span data-lang-text>` elements
- Language preference persists via `localStorage` key `al-masail-lang`
- Inline `<script is:inline>` in `<head>` prevents FOUC by setting `data-lang` before paint
- `LangToggle.astro` component provides the `RU | EN | اردو` pill toggle in the navbar

### MUST DO for All New/Edited Content
1. **Every user-facing text** must have all 3 languages: `{ en, ru, ur }`
2. Use `<T en="..." ru="..." ur="..." />` for inline text or `data-lang-text` / `data-lang-block` spans for block content
3. **Masail data** uses `I18nText` type: `question: { en, ru, ur }`, `answer: { en, ru, ur }`
4. **References stay English** — book names (Nurul Idah, Al-Hidayah, etc.) do NOT translate
5. **Fiqh terms** (haiz, istihaza, nifas, salah, sawm, taharah, ghusl, wudu) stay as-is in English & Roman Urdu. In Urdu script, use their Arabic/Urdu forms (حیض، استحاضہ، نفاس، نماز، etc.)

### NEVER Translate
- **Bismillah** — stays Arabic in all languages (بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ)
- **Quranic ayaat** — footer ayah (Surah Hud 11:88) and any Quranic text stays Arabic
- **Arabic titles** (المسائل, section title Arabic text like أبْوَاب المَسَائِل) — stays Arabic
- **Meta tags / page titles** — stay English for SEO (baked at build time)

### CSS Rules (in global.css)
- `[data-lang-text]` / `[data-lang-block]` — hidden by default
- `html[data-lang="xx"] [data-lang-text="xx"]` — shown as `display: inline`
- `html[data-lang="xx"] [data-lang-block="xx"]` — shown as `display: block`
- Urdu text automatically gets `font-family: var(--font-urdu)` and `direction: rtl`
- Toggle text (View Answer / Hide Answer) uses CSS-only `.show-when-closed` / `.show-when-open` classes

### Page stays LTR
- The `<html>` element keeps `dir="ltr"` — only Urdu text elements get `direction: rtl` via CSS
- Do NOT flip the entire page direction

## Component Patterns

### Adding New Masail Content
- Add to the `masail` array with: category, categoryAr, question (I18nText), answer (I18nText), reference
- All question/answer fields must be `{ en: '...', ru: '...', ur: '...' }` — never plain strings
- Add new filter chip if introducing a new category

### Adding New Decision Tree Paths (QuickQuestion.astro)
- Each screen is a `<div class="qa-screen" data-screen="unique-id">`
- Navigation via `data-goto="screen-id"` on buttons
- Answer screens use `.qa-answer`, `.qa-ruling`, `.qa-example` blocks
- Update the `depthMap` object in the script for progress bar tracking
- Visual timeline blocks available: `.haiz`, `.tuhr`, `.istihaza` classes
- All text content must be triple-rendered with `data-lang-text` spans or `<T>` component

### Adding New Category/Topic Pages
- Create new pages in `src/pages/` (e.g., `haiz.astro`)
- Use the `Layout.astro` wrapper
- TopicHeader props `subtitle` and `description` must be `I18nText` objects
- MasailList expects masail with `I18nText` question/answer fields
- Follow existing component patterns for consistency

## Important Notes

- This is a religious resource — accuracy and authenticity are paramount
- Always include references to classical Hanafi texts
- Tone should be respectful, clear, and gentle — this is a sensitive topic for the audience
- Disclaimer in footer: "For personal situations, always consult a qualified scholar"
- Footer Quranic ayah: Surah Hud 11:88
- All content must be Hanafi school specifically — do not mix with other madhabs

---

## ⚠️ MODULAR CODEBASE RULES (MANDATORY)

These rules prevent file bloat and keep the codebase clean, maintainable, and AI-friendly as the project grows.

### Hard Limits

| Rule | Limit |
|------|-------|
| **Max file size** | **500 lines**. No exceptions. If a file exceeds this, split it before doing anything else. |
| **Max inline `<style>`** | **100 lines**. Beyond that, extract to `src/styles/filename.css` and import. |
| **Max inline `<script>`** | **80 lines**. Beyond that, extract to `src/scripts/filename.ts`. |
| **Max frontmatter data** | **0 lines of content arrays**. All content data lives in `src/content/`. |

### Single Responsibility Principle

Each file does **ONE thing**:
- A **page file** (`.astro` in `pages/`) composes components. It should be 20–60 lines max.
- A **component** renders UI for one piece of functionality.
- A **content file** exports data arrays/objects. No HTML, no logic.
- A **style file** contains CSS for one feature/component group.
- A **script file** contains JS/TS logic for one feature.

**Test:** *"If a new dev (or Claude) reads just this file, will they understand exactly what it does without needing context from 5 other files?"* If yes → right size. If no → split it.

### Content Separation (Data ≠ Template)

**ALL content data** (masail Q&A arrays, decision tree flows, wazaif schedules, PDF lists, dhikr themes) **MUST live in `src/content/`** as TypeScript files that export typed data.

Pages and components **import** this data — they never define it inline.

```
src/content/
├── masail/          # Q&A data per topic (haiz.ts, salah.ts, etc.)
├── sawal/flows/     # Decision tree screen data per topic
├── ramadan/         # Wazaif + dhikr data
├── counter/         # Counter theme data
└── downloads/       # PDF metadata
```

### Component Organization

Components are **grouped by feature**, not dumped flat in `components/`:

```
src/components/
├── common/     # Shared across multiple features (T.astro, PageHero.astro, Ornament.astro)
├── layout/     # Site structure (Navbar, Footer, LangToggle)
├── home/       # Homepage only (Hero, Categories, QuickQuestion, FeaturedMasail)
├── topic/      # Topic pages (TopicHeader, MasailList)
├── sawal/      # Decision tree (CategorySelector, QAScreen, QAAnswer)
├── ramadan/    # Ramadan page sections
└── counter/    # Counter page sections
```

### CSS Organization

- `src/styles/global.css` — Design tokens + reset + base utilities ONLY
- `src/styles/qa.css` — Shared QA styles (used by both QuickQuestion + sawal page)
- `src/styles/ramadan.css`, `counter.css`, `downloads.css` — Page-specific styles
- Component-scoped `<style>` is fine if under 100 lines

### Decision Trees Are Data-Driven

Decision tree screens are **defined as data** in `src/content/sawal/flows/`, NOT as hand-written HTML divs. A reusable `QAScreen.astro` component renders each screen from the data.

**Never** write 50+ manual `<div class="qa-screen" data-screen="...">` blocks. Define the screens as a typed array and render them with a component loop.

### When Adding New Features

1. **Create content file** in `src/content/` with typed data
2. **Create component(s)** in `src/components/featurename/` (one per responsibility)
3. **Create style file** in `src/styles/` if styles exceed 100 lines
4. **Create script file** in `src/scripts/` if JS exceeds 80 lines
5. **Wire it up** in the page file (which should remain thin — under 60 lines)

### Refactoring Checklist

Before submitting any change, verify:
- [ ] No file exceeds 500 lines
- [ ] No content data arrays sit in page frontmatter (they're in `src/content/`)
- [ ] No `<style>` block exceeds 100 lines
- [ ] No `<script>` block exceeds 80 lines
- [ ] Components are in the correct feature folder
- [ ] Page files are thin (compose components, don't define content)
