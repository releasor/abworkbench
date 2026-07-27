# Question Bank — Frontend Interactive Question Bank

> This file is read on demand by SKILL.md in Phase 2. The AI must strictly follow the group order defined in this file, asking **one group at a time (1–5 questions)**, never dumping all questions at once.
> For every question, show the user: question number, question text, options, **recommended choice (marked "Recommended")**, and a one-line description.
> After each user response, immediately record the choice to internal state `answers[Qx] = ...` and proceed to the next group.

---

## Asking Rules

1. **Group order**: G1 → G2 → G3 → G4 → G5 → G6 → G7 → G8 → G9. Do not skip.
2. **Shortcut commands** (respond immediately when user types these at any point):
   - `recommended` / `default` → skip current group, adopt all recommended options
   - `all recommended` / `one-click` → skip all remaining groups, adopt all recommended options
   - `strict` / `strictest` → adopt the strictest option for the current group
   - `skip` / `don't need this` → mark current group as N/A, note in output that "project does not require this yet"
   - `custom: xxx` → record user's custom content, do not match against options
3. **Abbreviation recognition**: `A` / `a` / `1` all mean option A. `A,C` means multi-select (only for multi-select questions).
4. **Follow-up rule**: If the user gives an answer outside the options (e.g., "I use Astro"), first confirm whether to classify as an "other" branch of an existing option before continuing.
5. **Forbidden behaviors**:
   - Must not make choices for the user before they explicitly answer.
   - Must not fabricate user preferences to complete the answer set.
   - Must not output more than 3 questions in a single message.

---

## Group Overview

| Group | Topic | Questions | Count |
|-------|-------|-----------|-------|
| G1 | Tech Stack | Q1–Q3 | 3 |
| G2 | Styling | Q4–Q4b | 2 |
| G3 | State & Data Fetching | Q5–Q7 | 3 |
| G4 | Design System | Q8–Q10 | 3 |
| G5 | Responsive & Adaptation | Q11–Q12 | 2 |
| G6 | i18n & Accessibility | Q13–Q14 | 2 |
| G7 | Testing & Quality | Q15–Q17 | 3 |
| G8 | AI Vibecoding Constraints | Q18–Q22 | 5 |
| G9 | Performance Baseline | Q23–Q24 | 2 |

Total: 25 questions.

---

## G1 — Tech Stack

### Q1. Frontend Framework
- **Options**:
  - A) React 18+ **【Recommended】**
  - B) Vue 3
  - C) Svelte 5
  - D) Solid
  - E) Custom (specify version)
- **Note**: Determines which hooks/Composition API-specific rules are injected.
- **Maps to**: `{{ framework }}` (TL;DR) + `{{ tech_stack_rules }}` (derivation injection)

### Q2. Meta-Framework
- **Options**:
  - A) Next.js (App Router) **【Recommended for React projects】**
  - B) Nuxt (Recommended for Vue projects)
  - C) Remix
  - D) Plain SPA (Vite)
  - E) Custom
- **Note**: Affects SSR/RSC, routing conventions, data fetching rules.
- **Maps to**: `{{ meta_framework }}` (TL;DR + §2.4) + `{{ tech_stack_rules }}` (derivation injection)

### Q3. Package Manager
- **Options**:
  - A) pnpm **【Recommended】**
  - B) npm
  - C) yarn
  - D) bun
- **Strict option**: A (pnpm, enforced workspace + lockfile commit)
- **Note**: Affects monorepo capability, CI caching, lockfile rules.
- **Maps to**: `{{ package_manager }}` (TL;DR) + `{{ tech_stack_rules }}` (derivation injection)

---

## G2 — Styling

### Q4. Styling Solution (**single choice, no mixing**)
- **Options**:
  - A) Tailwind CSS **【Recommended: atomic, AI-friendly】**
  - B) CSS Modules
  - C) CSS-in-JS (styled-components / emotion)
  - D) UnoCSS
  - E) Plain CSS + BEM
- **Strict option**: A (Tailwind + forbid arbitrary values)
- **Note**: This choice determines the D2 branch rule set injected by derivation-rules.md (each option has dedicated rules).
- **Maps to**: `{{ style_solution }}` (TL;DR) + `{{ style_specific_rules }}` (derivation injection into §2.3)

### Q4b. Font Loading Strategy
- **Options**:
  - A) Self-hosted with font-display: swap **【Recommended: best performance + privacy】**
  - B) Google Fonts / CDN with font-display: swap
  - C) System font stack only (no custom fonts)
  - D) Not decided yet
- **Note**: Affects font loading performance and privacy. A provides the best control; B is simpler but adds a third-party dependency; C has zero download overhead.
- **Maps to**: `{{ font_strategy }}` (TL;DR) + `{{ performance_rules }}` (additional derivation)

---

## G3 — State & Data Fetching

### Q5. Global State Library
- **Options**:
  - A) Zustand **【Recommended for React】**
  - B) Pinia **【Recommended for Vue】**
  - C) Redux Toolkit
  - D) Jotai / Valtio
  - E) Context / Provide-Inject only, no global store
- **Note**: Recommendation depends on Q1 framework choice.
- **Maps to**: `{{ state_lib }}` (TL;DR + §4.1) + `{{ state_rules }}` (derivation injection)

### Q6. Server State Library
- **Options**:
  - A) TanStack Query **【Recommended】**
  - B) SWR
  - C) RTK Query
  - D) Custom fetch hook wrapper
- **Strict option**: A (TanStack Query + enforced queryKey convention)
- **Note**: Affects API caching, retry, and staleTime rules.
- **Maps to**: `{{ server_state_lib }}` (TL;DR + §4.2) + `{{ server_state_rules }}` (derivation injection)

### Q7. API Type Source
- **Options**:
  - A) Backend OpenAPI auto-generation **【Recommended】**
  - B) Backend Protobuf generation
  - C) Hand-written .d.ts
  - D) Shared monorepo type package with backend
- **Strict option**: A or B (eliminates hand-written types)
- **Note**: Determines whether to inject the "forbid hand-written API types" constraint.
- **Maps to**: `{{ api_type_source }}` (TL;DR + §4.3) + `{{ server_state_rules }}` (derivation injection)

---

## G4 — Design System

### Q8. Primary Design/Mockup Source
- **Options**:
  - A) Existing HTML prototype in `temp/` directory
  - B) Existing Figma designs
  - C) Other location (specify path)
  - D) None, starting from scratch
- **Note**: If multiple sources exist, select the primary one. Additional sources will be noted in the output. A/B trigger a "design extraction" step (annotate token sources in output). D triggers a "recommend doing a style direction first" hint.
- **Maps to**: `{{ design_source }}` (document header metadata)

### Q9. Token Naming Layers
- **Options**:
  - A) Three-layer (primitive / semantic / component) **【Recommended】**
  - B) Two-layer (base / semantic)
  - C) Single-layer (semantic only)
- **Strict option**: A
- **Note**: Three layers makes theme switching and brand reuse straightforward.
- **Maps to**: `{{ token_layering }}` (TL;DR) + `{{ token_layering_rules }}` (derivation injection into §1.1)

### Q10. Dark Mode
- **Options**:
  - A) Supported, via CSS variable switching **【Recommended】**
  - B) Supported, via class switching (Tailwind `dark:` prefix)
  - C) Not supported
- **Note**: Choosing A/B auto-injects "tokens must include both light/dark value pairs" rule.
- **Maps to**: `{{ dark_mode }}` (TL;DR) + `{{ dark_mode_rules }}` (derivation injection into §1.3)

---

## G5 — Responsive & Adaptation

### Q11. Adaptation Strategy
- **Options**:
  - A) Mobile-first **【Recommended】**
  - B) Desktop-first
  - C) Desktop only
  - D) Mobile only
- **Note**: Determines media query writing direction and default style conventions.
- **Maps to**: `{{ responsive_strategy }}` (TL;DR) + `{{ breakpoint_rules }}` (derivation injection into §1.4)

### Q12. Breakpoint Scheme
- **Options**:
  - A) Tailwind defaults (sm 640 / md 768 / lg 1024 / xl 1280 / 2xl 1536) **【Recommended】**
  - B) Material Design (xs / sm / md / lg / xl)
  - C) Custom (provide full breakpoint table)
- **Note**: Choosing A with Q4=Tailwind locks the breakpoints.
- **Maps to**: `{{ breakpoint_rules }}` (derivation injection into §1.4)

---

## G6 — i18n & Accessibility

### Q13. Internationalization (i18n)
- **Options**:
  - A) Multi-language with full i18n framework (specify: zh-CN, en-US, ja-JP, etc.)
  - B) Single-language, but text centralized in i18n files for future expansion **【Recommended: early-stage projects】**
  - C) Single-language, hardcoding allowed (no i18n infrastructure)
- **Note**: Choosing A auto-injects i18n key naming rules and forbid hardcoding user-visible text. B centralizes text but does not require multi-language support. C allows hardcoding and requires no i18n infrastructure.
- **Maps to**: `{{ i18n }}` (TL;DR) + `{{ i18n_rules }}` (derivation injection into §5.4)

### Q14. Accessibility Target
- **Options**:
  - A) WCAG 2.1 AA **【Recommended】**
  - B) WCAG 2.1 AAA
  - C) Basic keyboard reachability only
- **Strict option**: B
- **Note**: Affects contrast ratio thresholds and ARIA check strictness.
- **Maps to**: `{{ a11y_level }}` (TL;DR + §5.3) + `{{ a11y_extra_rules }}` (injected into §5.3)

---

## G7 — Testing & Quality

### Q15. Test Coverage Requirements
- **Options**:
  - A) Shared component unit tests + critical path E2E **【Recommended】**
  - B) Unit tests only
  - C) E2E only
  - D) Not required yet
- **Strict option**: A + enforced coverage ≥ 80%
- **Note**: Determines whether Q16/Q17 need to be asked.
- **Maps to**: `{{ test_rules }}` (dynamically assembled by D-TEST-01 into §6.1)

### Q16. Unit Test Framework (only ask if Q15 = A or B)
- **Options**:
  - A) Vitest **【Recommended for Vite/Next projects】**
  - B) Jest
  - C) Node test runner
- **Note**: Match with build tool first.
- **Maps to**: `{{ unit_test_framework }}` (TL;DR) + assembled into `{{ test_rules }}` by D-TEST-01

### Q17. E2E Framework (only ask if Q15 = A or C)
- **Options**:
  - A) Playwright **【Recommended】**
  - B) Cypress
  - C) WebdriverIO
- **Note**: Playwright has the best multi-browser support.
- **Maps to**: `{{ e2e_framework }}` (TL;DR) + assembled into `{{ test_rules }}` by D-TEST-01

---

## G8 — AI Vibecoding Constraints

### Q18. AI Component Index Sync
- **Options**:
  - A) Must sync to `src/components/index.ts` + type exports **【Recommended】**
  - B) Not required
- **Strict option**: A
- **Note**: Determines whether AI will reinvent existing components. Strict is safer.
- **Maps to**: `{{ ai_index_rule }}` (injected into §7.3)

### Q19. AI Permission to Add Dependencies
- **Options**:
  - A) Forbid AI from adding dependencies on its own; human must review `package.json` changes **【Recommended】**
  - B) Allowed, but must declare in PR description with alternative comparison
  - C) Fully allowed
- **Strict option**: A
- **Note**: A is key for supply chain security + bundle size control.
- **Maps to**: `{{ ai_dependency_rule }}` (injected into §7.3)

### Q20. AI Impact Analysis Before Modifying Shared Components
- **Options**:
  - A) Must list all callers and declare in change notes first **【Recommended】**
  - B) Not required
- **Strict option**: A
- **Note**: Prevents "fix one component, break ten pages."
- **Maps to**: `{{ ai_breaking_change_rule }}` (injected into §7.3)

### Q21. AI Permission to Modify Config Files
- **Options**:
  - A) Forbid; config files (tsconfig, vite, eslint, tailwind) must be manually edited **【Recommended】**
  - B) Allowed to modify, but must explain each change
- **Maps to**: `{{ ai_config_rule }}`

### Q22. AI Single File Generation Limit
- **Options**:
  - A) 200 lines
  - B) 300 lines **【Recommended】**
  - C) 500 lines
  - D) No limit
- **Strict option**: A
- **Note**: Exceeding the limit auto-triggers a split hint to prevent god components.
- **Maps to**: `{{ ai_max_lines }}` (appears in TL;DR + §3.3 + §7.3 + §8.2 — AI replaces the value in all locations)

---

## G9 — Performance Baseline

### Q23. First Screen LCP Target
- **Options**:
  - A) < 2.5s **【Recommended: Web Vitals "good" threshold】**
  - B) < 1.5s (extreme performance, requires pre-rendering/edge deployment)
  - C) Not required yet
- **Strict option**: B
- **Note**: Determines whether SSR/RSC, font preloading, and critical CSS inlining rules are required.
- **Maps to**: `{{ lcp_target }}` (TL;DR) + `{{ performance_rules }}` (derivation injection into §5.5)

### Q24. Single Chunk Size Limit
- **Options**:
  - A) < 300KB (< 100KB gzipped) **【Recommended】**
  - B) < 500KB
  - C) No limit
- **Strict option**: A + configure bundle-analyzer for CI enforcement
- **Note**: Determines whether to inject "routes must be lazy-loaded" and "large third-party libs must use dynamic import" rules.
- **Maps to**: `{{ bundle_size }}` (TL;DR) + `{{ performance_rules }}` (derivation injection into §5.5)
