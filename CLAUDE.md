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

## Project Structure

```
src/
├── i18n/
│   └── types.ts         # Shared types: Lang, I18nText, I18nMasala
├── components/
│   ├── T.astro          # Translation helper — renders 3 <span data-lang-text> elements
│   ├── LangToggle.astro # Language toggle pill (RU | EN | اردو) for navbar
│   ├── Navbar.astro     # Fixed nav, blurs on scroll, mobile hamburger overlay
│   ├── Hero.astro       # Full-viewport hero with Bismillah, Arabic title, CTAs
│   ├── Categories.astro # 6 topic cards (haiz, istihaza, nifas, salah, sawm, taharah)
│   ├── QuickQuestion.astro  # Interactive decision-tree Q&A (the main feature)
│   ├── FeaturedMasail.astro # Expandable Q&A cards with filters + search
│   ├── TopicHeader.astro    # Shared header for topic pages
│   ├── MasailList.astro     # Shared expandable masail list for topic pages
│   └── Footer.astro     # Dark green footer with Quranic ayah + disclaimer
├── layouts/
│   └── Layout.astro     # Base HTML layout with meta, scroll-reveal, FOUC-prevention lang script
├── pages/
│   ├── index.astro      # Homepage — imports and composes all components
│   ├── haiz.astro       # Haiz topic page (12 masail)
│   ├── istihaza.astro   # Istihaza topic page (8 masail)
│   ├── nifas.astro      # Nifas topic page (8 masail)
│   ├── salah.astro      # Salah topic page (10 masail)
│   ├── sawm.astro       # Sawm topic page (9 masail)
│   └── taharah.astro    # Taharah topic page (9 masail)
└── styles/
    └── global.css       # CSS variables, reset, utilities, patterns, language toggle rules
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
