# AGENTS.md — Al-Masail Development Guide

## Project Overview

A static Astro website for Hanafi fiqh masail (Islamic jurisprudence) with 3-language support (Roman Urdu, English, Urdu script). This is a religious resource—accuracy and authenticity are paramount.

## Commands

```bash
# Development
npm run dev          # Start dev server at localhost:4321

# Production
npm run build        # Build static site
npm run preview      # Preview production build locally

# Astro CLI
npm run astro       # Run astro CLI commands
```

No linting or testing frameworks are configured. The project uses vanilla CSS and TypeScript.

---

## ⚠️ MODULAR CODEBASE RULES (MANDATORY)

These rules apply to **every file** in the project. They exist to keep the codebase clean, maintainable, and growable as we add more topics, features, and content.

### File Size Limits

| Threshold | Action |
|-----------|--------|
| **< 300 lines** | ✅ Ideal. No action needed. |
| **300–500 lines** | 🟡 Acceptable, but check if it can be split. |
| **> 500 lines** | 🔴 **MUST be split.** No exceptions. |

**Before writing any code**, ask: *"Can I describe what this file does without using the word 'and'?"* If not, it needs to be multiple files.

### Content–Template–Style–Script Separation

Every Astro page/component has up to 4 concerns. **Never let more than one concern bloat a file:**

1. **Content/Data** → Goes in `src/content/` as `.ts` data files
2. **HTML Template** → Stays in the `.astro` component (should be thin — imports data + renders)
3. **CSS Styles** → If > 100 lines, extract to `src/styles/` as a separate `.css` file and import it
4. **JavaScript** → If > 80 lines, extract to `src/scripts/` as a separate `.ts` file

```astro
---
// ✅ GOOD: Page is thin — imports data, passes to components
import Layout from '../layouts/Layout.astro';
import { haizMasail } from '../content/masail/haiz';
import MasailList from '../components/topic/MasailList.astro';
---
<Layout><MasailList masail={haizMasail} /></Layout>
```

```astro
---
// ❌ BAD: 300 lines of data arrays sitting in frontmatter
const masail = [
  { question: { en: '...', ru: '...', ur: '...' }, answer: { ... }, ... },
  // ... 20 more objects ...
];
---
```

### Content Data Files

All content lives in `src/content/` organized by feature. Data files export typed arrays/objects:

```typescript
// src/content/masail/haiz.ts
import type { I18nMasala } from '../../i18n/types';

export const haizMasail: I18nMasala[] = [
  {
    question: { en: '...', ru: '...', ur: '...' },
    answer: { en: '...', ru: '...', ur: '...' },
    reference: 'Nurul Idah, p. 45',
    important: true,
  },
];
```

**Rules for content files:**
- One file per topic/feature (e.g., `haiz.ts`, `nifas.ts`, `wazaif.ts`)
- Export named constants (not default exports)
- Always use proper TypeScript types from `src/i18n/types.ts`
- Content files contain **only data** — no HTML, no logic, no imports of components
- If a content file exceeds 500 lines, split by sub-topic (e.g., `haiz-basic.ts`, `haiz-advanced.ts`)

### Component Organization

Components are organized by feature/domain, not dumped flat:

```
src/components/
├── common/          # Shared building blocks used everywhere
│   ├── T.astro
│   ├── PageHero.astro
│   └── Ornament.astro
├── layout/          # Structural/layout components
│   ├── Navbar.astro
│   ├── Footer.astro
│   └── LangToggle.astro
├── home/            # Homepage-specific components
│   ├── Hero.astro
│   ├── Categories.astro
│   ├── QuickQuestion.astro
│   └── FeaturedMasail.astro
├── topic/           # Topic page components
│   ├── TopicHeader.astro
│   └── MasailList.astro
├── sawal/           # Decision tree components
│   ├── CategorySelector.astro
│   ├── QAScreen.astro
│   └── QAAnswer.astro
├── ramadan/         # Ramadan page components
│   ├── DhikrSection.astro
│   └── WazaifCard.astro
└── counter/         # Counter page components
    ├── TapArea.astro
    └── ThemeSelector.astro
```

**Rules:**
- Max 8–10 files per folder. If a folder grows beyond that, create sub-folders.
- Each component does ONE thing. If a component renders a list AND handles filtering AND shows search, split into `List.astro`, `Filter.astro`, `Search.astro`.
- Components import their own styles or use scoped `<style>` (max 100 lines).

### CSS Organization

```
src/styles/
├── global.css       # Design tokens, reset, base utilities, language toggle rules
├── qa.css           # Shared QA/decision-tree styles (used by QuickQuestion + sawal page)
├── ramadan.css      # Ramadan page styles
├── counter.css      # Counter page styles
└── downloads.css    # Downloads page styles
```

**Rules:**
- `global.css` = design tokens + reset + utilities ONLY. No component-specific styles.
- If a `<style>` block in a component exceeds ~100 lines, extract to `src/styles/`.
- Shared styles (used by 2+ components) go in `src/styles/` with a descriptive name.
- Import CSS in frontmatter: `import '../styles/qa.css';`

### Script Organization

```
src/scripts/
├── lang-toggle.ts   # Language switching logic
├── qa-engine.ts     # Decision tree navigation logic
├── counter.ts       # Dhikr counter logic
└── scroll-reveal.ts # Intersection observer for reveals
```

**Rules:**
- If a `<script>` block exceeds ~80 lines, extract to `src/scripts/`.
- Import in components: `<script src="../scripts/qa-engine.ts"></script>` or use Astro's hoisted scripts.
- Scripts contain **only logic** — no HTML strings, no inline styles.

### Decision Trees (QA Flows)

Decision trees are **data-driven, not HTML-driven**. Each flow is a data file:

```typescript
// src/content/sawal/flows/haiz.ts
import type { QAScreen } from '../../../i18n/types';

export const haizFlow: QAScreen[] = [
  {
    id: 'haiz-start',
    badge: 'Haiz',
    question: { en: 'Are you currently bleeding?', ru: '...', ur: '...' },
    options: [
      { label: { en: 'Yes', ru: 'Haan', ur: 'ہاں' }, goto: 'haiz-duration' },
      { label: { en: 'No', ru: 'Nahi', ur: 'نہیں' }, goto: 'haiz-stopped' },
    ],
    back: 'categorySelection',
  },
  // ... more screens
];
```

Then a **reusable component** renders any flow:

```astro
<!-- QAScreen.astro renders one screen from data -->
<!-- The page loops over the flow data to render all screens -->
{flow.map(screen => <QAScreen {...screen} />)}
```

**NEVER write 69 handcrafted HTML divs for decision tree screens.** Always use data + renderer.

---

## Code Style Guidelines

### Astro Components

**File naming:** PascalCase (e.g., `QuickQuestion.astro`, `TopicHeader.astro`)

**Structure:**
```astro
---
// Frontmatter: imports, interfaces, props
import Component from './Component.astro';
import '../styles/global.css';

interface Props {
  title?: string;
  subtitle?: I18nText;
}

const { title = 'Default', subtitle } = Astro.props;
---

<!-- Template: HTML + Astro components + <T> for i18n -->
<Component>
  <T en="English" ru="Roman Urdu" ur="اردو" />
</Component>

<!-- Client-side interactivity (keep under 80 lines or extract to src/scripts/) -->
<script>
  document.querySelectorAll('.selector').forEach(el => {
    el.addEventListener('click', handler);
  });
</script>

<!-- Scoped CSS (keep under 100 lines or extract to src/styles/) -->
<style>
  .selector { }
</style>
```

### TypeScript

**Shared types** in `src/i18n/types.ts`:
```typescript
export type Lang = 'en' | 'ru' | 'ur';

export interface I18nText {
  en: string;
  ru: string;
  ur: string;
}

export interface I18nMasala {
  question: I18nText;
  answer: I18nText;
  reference: string;
  important?: boolean;
}

// Decision tree types
export interface QAOption {
  label: I18nText;
  goto: string;
  arLabel?: string;
}

export interface QAScreen {
  id: string;
  badge?: string;
  question: I18nText;
  options?: QAOption[];
  answer?: QAAnswer;
  back?: string;
}

export interface QAAnswer {
  type: 'success' | 'warning' | 'info';
  title: I18nText;
  text: I18nText;
  ruling?: I18nText;
  reference?: string;
}
```

**Props interfaces:** Define in component frontmatter, use descriptive names:
```typescript
interface Props {
  category: string;
  categoryAr: string;
  masail: I18nMasala[];
}
```

### Imports

**Order:**
1. Types from `src/i18n/types.ts`
2. Content data from `src/content/`
3. Astro components
4. Layouts
5. Styles (`../styles/global.css` last)

```astro
---
import type { I18nMasala } from '../i18n/types';
import { haizMasail } from '../content/masail/haiz';
import Layout from '../layouts/Layout.astro';
import Navbar from '../components/layout/Navbar.astro';
import T from '../components/common/T.astro';
import '../styles/global.css';
---
```

### CSS

**Use CSS custom properties** from `global.css`:
- Colors: `var(--teal)`, `var(--gold)`, `var(--ivory)`
- Spacing: `var(--space-sm)` through `var(--space-4xl)`
- Typography: `var(--font-body)`, `var(--font-arabic)`, `var(--font-urdu)`
- Effects: `var(--shadow-card)`, `var(--ease-out)`

**Never use:**
- Tailwind CSS
- CSS frameworks
- Hardcoded hex colors (except in `global.css`)

### 3-Language System (i18n)

**MANDATORY:** Every user-facing text must have all 3 languages.

**Inline text:** Use `<T>` component:
```astro
<T en="View Answer" ru="Jawab dekhein" ur="جواب دیکھیں" />
```

**Block content:** Use `data-lang-text` spans:
```html
<p>
  <span data-lang-text="en">English text</span>
  <span data-lang-text="ru">Roman Urdu text</span>
  <span data-lang-text="ur">اردو متن</span>
</p>
```

**Important rules:**
- English is default in code (properties), Roman Urdu in UI
- Urdu text gets `direction: rtl` automatically via CSS
- NEVER translate: Bismillah, Quranic ayaat, Arabic titles, book references (Nurul Idah, Al-Hidayah)
- Fiqh terms stay English/Roman Urdu; use Arabic/Urdu script only in Urdu language field

### JavaScript/TypeScript

- Use vanilla JS in `<script>` tags within Astro components
- No React, Vue, or other frameworks
- Use `querySelectorAll` + `forEach` for multiple elements
- Use `is:inline` for scripts that must run immediately, regular `<script>` for after DOM load
- **If a script exceeds 80 lines, extract to `src/scripts/`**

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `QuickQuestion.astro` |
| Content data files | kebab-case | `haiz.ts`, `wazaif-data.ts` |
| Style files | kebab-case | `qa.css`, `ramadan.css` |
| Script files | kebab-case | `qa-engine.ts`, `counter.ts` |
| Props | camelCase | `categoryAr`, `masailList` |
| CSS classes | kebab-case | `.section-header`, `.qa-progress-bar` |
| Data attributes | kebab-case | `data-screen`, `data-goto`, `data-lang-text` |
| Variables | camelCase | `const observer = new IntersectionObserver()` |
| Exported constants | camelCase | `export const haizMasail = [...]` |

### HTML/JSX Patterns

- Self-closing tags for void elements: `<input />`, `<img />`
- Use semantic HTML: `<section>`, `<main>`, `<nav>`, `<header>`
- Inline SVGs for icons (no icon libraries)

---

## Project Structure (Target)

```
src/
├── i18n/
│   └── types.ts                # All shared TypeScript types (I18nText, I18nMasala, QAScreen, etc.)
├── content/                    # ALL content data — no HTML, just typed data
│   ├── masail/                 # Masail Q&A data by topic
│   │   ├── haiz.ts
│   │   ├── istihaza.ts
│   │   ├── nifas.ts
│   │   ├── salah.ts
│   │   ├── sawm.ts
│   │   ├── taharah.ts
│   │   └── featured.ts        # Curated masail for homepage FeaturedMasail
│   ├── sawal/                  # Decision tree flows
│   │   ├── categories.ts      # Category list + metadata
│   │   └── flows/             # One file per topic flow
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
│   │   ├── wazaif.ts          # 30-day wazaif schedule
│   │   └── dhikr.ts           # Daily dhikr lists
│   ├── counter/
│   │   └── themes.ts          # Dhikr counter themes/options
│   └── downloads/
│       └── pdfs.ts            # PDF metadata
├── components/
│   ├── common/                # Shared UI building blocks
│   │   ├── T.astro            # Translation helper
│   │   ├── PageHero.astro     # Reusable hero section (used by sawal, ramadan, counter, downloads)
│   │   └── Ornament.astro     # Gold ornament divider
│   ├── layout/                # Site-wide layout components
│   │   ├── Navbar.astro
│   │   ├── Footer.astro
│   │   └── LangToggle.astro
│   ├── home/                  # Homepage components
│   │   ├── Hero.astro
│   │   ├── Categories.astro
│   │   ├── QuickQuestion.astro
│   │   └── FeaturedMasail.astro
│   ├── topic/                 # Topic page components
│   │   ├── TopicHeader.astro
│   │   └── MasailList.astro
│   ├── sawal/                 # Decision tree components
│   │   ├── CategorySelector.astro
│   │   ├── QAScreen.astro     # Renders one screen from data
│   │   └── QAAnswer.astro     # Renders one answer from data
│   ├── ramadan/               # Ramadan page components
│   │   ├── DhikrSection.astro
│   │   └── WazaifCard.astro
│   └── counter/               # Counter page components
│       ├── TapArea.astro
│       └── ThemeSelector.astro
├── styles/
│   ├── global.css             # Design tokens + reset + base utilities ONLY
│   ├── qa.css                 # Shared QA/decision-tree styles
│   ├── ramadan.css            # Ramadan page styles
│   ├── counter.css            # Counter page styles
│   └── downloads.css          # Downloads page styles
├── scripts/
│   ├── qa-engine.ts           # Decision tree navigation logic
│   ├── counter.ts             # Dhikr counter logic
│   └── scroll-reveal.ts       # Intersection observer (if extracted from Layout)
├── layouts/
│   └── Layout.astro           # Base HTML template
└── pages/                     # Pages are THIN — import content + compose components
    ├── index.astro
    ├── haiz.astro
    ├── istihaza.astro
    ├── nifas.astro
    ├── salah.astro
    ├── sawm.astro
    ├── taharah.astro
    ├── sawal.astro
    ├── ramadan.astro
    ├── counter.astro
    └── downloads.astro
```

---

## Common Patterns

### Adding a New Masail Topic

1. Create content file: `src/content/masail/newtopic.ts`
2. Create page: `src/pages/newtopic.astro` (thin — imports data + composes components)
3. Add category to `src/components/home/Categories.astro`

```typescript
// src/content/masail/newtopic.ts
import type { I18nMasala } from '../../i18n/types';
export const newtopicMasail: I18nMasala[] = [ /* ... */ ];
```

```astro
<!-- src/pages/newtopic.astro — thin page file -->
---
import Layout from '../layouts/Layout.astro';
import Navbar from '../components/layout/Navbar.astro';
import TopicHeader from '../components/topic/TopicHeader.astro';
import MasailList from '../components/topic/MasailList.astro';
import Footer from '../components/layout/Footer.astro';
import { newtopicMasail } from '../content/masail/newtopic';
import '../styles/global.css';
---
<Layout title="New Topic | Al-Masail">
  <Navbar />
  <main>
    <TopicHeader titleAr="..." titleEn="..." subtitle={{...}} description={{...}} masailCount={newtopicMasail.length} />
    <MasailList masail={newtopicMasail} />
  </main>
  <Footer />
</Layout>
```

### Adding a New Decision Tree Flow

1. Create flow data: `src/content/sawal/flows/newtopic.ts`
2. Import in `sawal.astro` and render with `<QAScreen>` components
3. Add category to `src/content/sawal/categories.ts`

```typescript
// src/content/sawal/flows/newtopic.ts
import type { QAScreen } from '../../../i18n/types';
export const newtopicFlow: QAScreen[] = [
  {
    id: 'newtopic-start',
    badge: 'New Topic',
    question: { en: '...', ru: '...', ur: '...' },
    options: [
      { label: { en: 'Option A', ru: '...', ur: '...' }, goto: 'newtopic-a' },
    ],
    back: 'categorySelection',
  },
];
```

---

## Important Notes

1. **Fiqh accuracy:** Do NOT change rulings without explicit instruction. All answers must be Hanafi school.
2. **References:** Always cite classical texts (Nurul Idah, Al-Hidayah, Maraqi al-Falah, Radd al-Muhtar).
3. **Design:** Use the Islamic book aesthetic—warm, earthy, elegant. Avoid generic AI aesthetics.
4. **No external images:** Decorative elements must be CSS-only.
5. **Tone:** Respectful, clear, gentle—this is a sensitive topic for the audience.
6. **Modularity:** Never let a file exceed 500 lines. Extract data, styles, and scripts as described above.
7. **Single Responsibility:** Each file does ONE thing. If you can't describe it without "and", split it.
