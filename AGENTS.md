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

<!-- Client-side interactivity -->
<script>
  // Vanilla JS/TS - no frameworks
  document.querySelectorAll('.selector').forEach(el => {
    el.addEventListener('click', handler);
  });
</script>

<style>
  /* Component-scoped CSS */
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
1. Astro components from same project
2. Layouts
3. Styles (`../styles/global.css` last)

```astro
---
import Layout from '../layouts/Layout.astro';
import Navbar from '../components/Navbar.astro';
import T from './T.astro';
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

```astro
<script>
  document.addEventListener('DOMContentLoaded', () => {
    // Initialize components
  });
</script>
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `QuickQuestion.astro` |
| Props | camelCase | `categoryAr`, `masailList` |
| CSS classes | kebab-case | `.section-header`, `.qa-progress-bar` |
| Data attributes | kebab-case | `data-screen`, `data-goto`, `data-lang-text` |
| Variables | camelCase | `const observer = new IntersectionObserver()` |

### HTML/JSX Patterns

- Self-closing tags for void elements: `<input />`, `<img />`
- Use semantic HTML: `<section>`, `<main>`, `<nav>`, `<header>`
- Inline SVGs for icons (no icon libraries)

---

## Project Structure

```
src/
├── i18n/types.ts           # Shared TypeScript types
├── components/
│   ├── T.astro            # Translation helper
│   ├── LangToggle.astro   # Language switcher
│   ├── Navbar.astro
│   ├── Hero.astro
│   ├── Categories.astro
│   ├── QuickQuestion.astro # Decision-tree Q&A
│   ├── FeaturedMasail.astro
│   ├── TopicHeader.astro
│   ├── MasailList.astro
│   └── Footer.astro
├── layouts/Layout.astro   # Base HTML template
├── pages/
│   ├── index.astro
│   ├── haiz.astro
│   ├── istihaza.astro
│   ├── nifas.astro
│   ├── salah.astro
│   ├── sawm.astro
│   └── taharah.astro
└── styles/global.css
```

---

## Common Patterns

### Adding a New Masail (Q&A)

```typescript
const masail: I18nMasala[] = [
  {
    question: {
      en: 'Question in English?',
      ru: 'Question in Roman Urdu?',
      ur: 'Question in Urdu script?'
    },
    answer: {
      en: 'Answer in English.',
      ru: 'Answer in Roman Urdu.',
      ur: 'Answer in Urdu script.'
    },
    reference: 'Nurul Idah, p. 45',
    important: true
  }
];
```

### Adding a New Decision Tree Screen

```html
<div class="qa-screen" data-screen="unique-id">
  <span class="qa-badge">Label</span>
  <h3 class="qa-question">
    <T en="Question?" ru="Question?" ur="سوال؟" />
  </h3>
  <div class="qa-options">
    <button class="qa-option" data-goto="next-screen-id">
      <T en="Option" ru="Option" ur="اختیار" />
    </button>
  </div>
</div>
```

---

## Important Notes

1. **Fiqh accuracy:** Do NOT change rulings without explicit instruction. All answers must be Hanafi school.
2. **References:** Always cite classical texts (Nurul Idah, Al-Hidayah, Maraqi al-Falah, Radd al-Muhtar).
3. **Design:** Use the Islamic book aesthetic—warm, earthy, elegant. Avoid generic AI aesthetics.
4. **No external images:** Decorative elements must be CSS-only.
5. **Tone:** Respectful, clear, gentle—this is a sensitive topic for the audience.
