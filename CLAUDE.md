# Al-Masail (المسائل) — Hanafi Fiqh Masail Website for Women

## Project Overview

A static, interactive Q&A website for women's Hanafi fiqh masail (Islamic jurisprudence rulings). Women can come to this site and easily find clear, authentic answers to their questions about haiz, istihaza, nifas, salah, sawm, taharah, and more.

**All answers and logic are manually set — no AI is used for rulings.** Every ruling is based on the Hanafi school of thought with references to classical texts (Nurul Idah, Al-Hidayah, Maraqi al-Falah, Radd al-Muhtar).

## Tech Stack

- **Framework:** Astro (static site generator) — NOT Next.js
- **Styling:** Vanilla CSS with CSS custom properties (no Tailwind, no CSS frameworks)
- **Interactivity:** Vanilla TypeScript/JS in `<script>` tags within Astro components
- **Database:** None — fully static, all content hardcoded in components
- **Fonts:** Google Fonts — Amiri (Arabic serif) + Outfit (English sans-serif)
- **Icons:** Inline SVGs, no icon libraries

## Commands

- `npm run dev` — Start dev server (localhost:4321)
- `npm run build` — Build static site for production
- `npm run preview` — Preview production build locally

## Project Structure

```
src/
├── components/          # Astro components (self-contained with scoped CSS + JS)
│   ├── Navbar.astro     # Fixed nav, blurs on scroll, mobile hamburger overlay
│   ├── Hero.astro       # Full-viewport hero with Bismillah, Arabic title, CTAs
│   ├── Categories.astro # 6 topic cards (haiz, istihaza, nifas, salah, sawm, taharah)
│   ├── QuickQuestion.astro  # Interactive decision-tree Q&A (the main feature)
│   ├── FeaturedMasail.astro # Expandable Q&A cards with filters + search
│   └── Footer.astro     # Dark green footer with Quranic ayah + disclaimer
├── layouts/
│   └── Layout.astro     # Base HTML layout with meta, scroll-reveal observer
├── pages/
│   └── index.astro      # Homepage — imports and composes all components
└── styles/
    └── global.css       # CSS variables, reset, utilities, pattern backgrounds
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

## Component Patterns

### Adding New Masail Content
- Add to the `masail` array in `FeaturedMasail.astro` with: category, categoryAr, question, answer, reference
- Add new filter chip if introducing a new category

### Adding New Decision Tree Paths (QuickQuestion.astro)
- Each screen is a `<div class="qa-screen" data-screen="unique-id">`
- Navigation via `data-goto="screen-id"` on buttons
- Answer screens use `.qa-answer`, `.qa-ruling`, `.qa-example` blocks
- Update the `depthMap` object in the script for progress bar tracking
- Visual timeline blocks available: `.haiz`, `.tuhr`, `.istihaza` classes

### Adding New Category Pages
- Create new pages in `src/pages/` (e.g., `haiz.astro`)
- Use the `Layout.astro` wrapper
- Follow existing component patterns for consistency

## Important Notes

- This is a religious resource — accuracy and authenticity are paramount
- Always include references to classical Hanafi texts
- Tone should be respectful, clear, and gentle — this is a sensitive topic for the audience
- Disclaimer in footer: "For personal situations, always consult a qualified scholar"
- Footer Quranic ayah: Surah Hud 11:88
- All content must be Hanafi school specifically — do not mix with other madhabs
