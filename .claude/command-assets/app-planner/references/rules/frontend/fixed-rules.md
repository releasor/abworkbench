# Fixed Rules — Complete Frontend Fixed Rules

> This file is read by the `frontend-rules` skill in Phase 1 and injected directly into `frontend-rules.md`.
> These rules are industry consensus / best practices — **do not ask the user**.
> Every rule includes RATIONALE so the AI understands intent, not just constraints.

---

## F1. Types & Code Quality

### F1.1 TypeScript Strict Mode
- **Rule**: `tsconfig.json` must enable `"strict": true`.
- **Forbidden**: Using `any`. Use `unknown` and apply type guards before use.
- **Forbidden**: `@ts-ignore`. If ignoring is necessary, use `@ts-expect-error` with a reason comment.
- **RATIONALE**: Types are the safety net for large projects. AI understands context more accurately in strict mode.

### F1.2 Lint & Formatting
- **Rule**: ESLint + Prettier config must be committed to the repository root.
- **Rule**: Git pre-commit hooks (husky + lint-staged) enforce lint and format.
- **Forbidden**: Committing `console.log`, `debugger`, unattributed `TODO` (must include issue number or owner).
- **RATIONALE**: Automated guardrails are always more reliable than manual review.

### F1.3 Naming Conventions
- **Component files**: PascalCase (`UserCard.tsx`)
- **Hook files**: camelCase prefixed with `use` (`useAuth.ts`)
- **Utility functions**: camelCase (`formatDate.ts`)
- **Constants**: SCREAMING_SNAKE_CASE (`MAX_RETRY_COUNT`)
- **Types/Interfaces**: PascalCase. Avoid `I` prefix (`User`, not `IUser`).
- **Forbidden**: Pinyin names, meaningless abbreviations (`a`/`b`/`tmp`), numeric suffixes (`button2`/`utils3`).
- **RATIONALE**: Consistent naming significantly improves AI search/completion hit rates.

---

## F2. Style Deny List (universally applicable)

- **Forbid** `!important` (unless overriding uncontrollable third-party styles, with a comment explaining why).
- **Forbid** hardcoded color values (must use design tokens).
- **Forbid** hardcoded font sizes, line heights, spacing, border radius, shadows, animation durations.
- **Forbid** magic numbers (must use named constants).
- **Forbid** inline `style` attributes (unless for dynamically computed positions/sizes, with a comment).
- **Forbid** raw `z-index` numbers (must use a z-index layer constant).
- **RATIONALE**: Hardcoded values make the design system meaningless. Once AI learns to hardcode, it spreads everywhere.

---

## F3. Component Design

### F3.1 Component Contract
- **Rule**: All Props must have complete TypeScript types. Forbid `Props: any`.
- **Rule**: Components must support `className` forwarding, merged via `clsx`/`cn`.
- **Rule**: Controlled vs. uncontrolled must be explicit. "Semi-controlled" is not allowed.
- **Rule**: Exposed `ref` must use `forwardRef` with typing.
- **RATIONALE**: Unclear component contracts are the main reason AI breaks three things when changing one.

### F3.2 File Size
- **Rule**: Single component file ≤ 300 lines (including comments).
- **Rule**: Beyond this, split by logic/view/types into the same directory.
- **RATIONALE**: Beyond 300 lines, the risk of AI losing context during modification spikes sharply.

### F3.3 Four-State Completeness
- **Rule**: All data-driven views must explicitly handle `loading` / `error` / `empty` / `success` states.
- **Forbid**: Using a truthy conditional render to gloss over the empty state.
- **RATIONALE**: Missing states are the largest source of hidden UX bugs.

---

## F4. Internationalization (i18n) Baseline

- **Forbid**: Hardcoding any user-visible text (buttons, titles, tooltips, error messages, empty states, placeholders).
- **Rule**: All user-visible text must use i18n keys.
- **Rule**: i18n key naming follows `page.section.element` three-segment format (e.g., `login.form.submitBtn`).
- **Exception**: Pure brand names, trademarks, fixed acronyms (like `API`, `URL`) may be hardcoded.
- **RATIONALE**: Even for single-language projects, reserving the i18n channel costs almost nothing. Retrofitting it later costs an enormous amount.

---

## F5. Error Handling

- **Rule**: Route-level ErrorBoundary must exist.
- **Rule**: Async operations must have loading + error UI. "Silent failure" is not allowed.
- **Rule**: API failures must have user notification (toast/inline) + retry entry.
- **Rule**: Caught errors must be reported to monitoring (Sentry / custom).
- **Forbid**: `catch(e) {}` empty catch blocks.
- **RATIONALE**: The worst frontend experience isn't a bug — it's "nothing happened."

---

## F6. Accessibility (a11y Baseline)

- **Rule**: All interactive elements must be keyboard-operable (Tab/Enter/Space/Esc).
- **Rule**: Images must have `alt`. Decorative images use `alt=""`.
- **Rule**: Icon buttons must have `aria-label`.
- **Rule**: Form controls must be associated with `<label>` (`htmlFor` or wrapping).
- **Rule**: Modal open must move focus into the modal. Modal close must return focus to the trigger element.
- **Forbid**: `<div onClick>` as a substitute for `<button>`.
- **Forbid**: Conveying information through color alone (must pair with icon/text).
- **RATIONALE**: a11y is not a moral requirement — it's a legal requirement (GDPR/ADA), and SEO shares the same foundation.

---

## F7. Git Collaboration

### F7.1 Branching & Commits
- **Branch naming**: `feat/xxx`, `fix/xxx`, `refactor/xxx`, `chore/xxx`, `docs/xxx`.
- **Commit messages**: Follow Conventional Commits (`type(scope): subject`).
- **Rule**: Main branch protection. PR + Code Review required to merge.
- **Rule**: Single PR changes ≤ 500 lines (generated code excluded). Beyond this, must split.

### F7.2 PR Self-Check Checklist (must review each item)
- [ ] Local `lint` / `typecheck` / `test` all green
- [ ] New components registered in component index
- [ ] New user-visible text has i18n keys
- [ ] Four states (loading/error/empty/success) covered
- [ ] No hardcoded colors/font sizes/spacing
- [ ] No `console.log` / `debugger` / `any`
- [ ] Key changes have supporting description (screenshots / recordings / design links)

---

## F8. Security Baseline

- **Forbid**: Writing API keys, tokens, or secrets into frontend code.
- **Forbid**: Using `dangerouslySetInnerHTML` / `v-html` to render user input (must sanitize).
- **Rule**: All external links with `target="_blank"` must include `rel="noopener noreferrer"`.
- **Rule**: Form submission requires client-side validation, but **forbid** relying solely on client-side validation.
- **Rule**: Sensitive operations (delete, payment) require secondary confirmation.
- **RATIONALE**: The frontend is an attack surface, not a security boundary.

---

## F9. AI Vibecoding Baseline Constraints (project-agnostic, always active)

### F9.1 Search First
- **Rule**: Before generating a new component, AI must search the `src/components/` index to check if a similar component already exists.
- **Rule**: Before generating a utility function, AI must search `src/utils/` / `src/hooks/`. Forbid reinventing the wheel.

### F9.2 Dependency Control
- **Rule**: AI must not introduce new npm dependencies on its own.
- **Rule**: If a new dependency is truly needed, AI must **explicitly list** in its response: package name, version, reason, alternative comparison. Human reviews the `package.json` change.

### F9.3 Breaking Changes
- **Rule**: Before modifying a shared component / common hook / common type, AI must first list **all callers**.
- **Rule**: If the change would break callers, AI must provide a migration plan or refuse the change.

### F9.4 Context Honesty
- **Rule**: When uncertain, AI must explicitly say "I'm not sure." Forbid inventing API paths, file paths, or field names.
- **Rule**: AI must read the latest file contents before modifying. Forbid generating diffs based on guesswork.

### F9.5 Comment Obligation
- **Rule**: Non-obvious AI-generated code must include a "why" comment (not "what").
- **Forbid**: AI deleting existing comments (unless the corresponding code is also deleted).

---

## F10. Performance Baseline

- **Rule**: List rendering must have `key`, and `key` must not use index (unless the list is purely static).
- **Rule**: Long lists (>100 items) must use virtual scrolling.
- **Rule**: Routes must be code-split (dynamic import).
- **Rule**: Images must be lazy-loaded (`loading="lazy"`) + modern formats (webp/avif) + explicit width/height (prevents CLS).
- **Rule**: Avoid creating new objects/functions in render (unless wrapped with memo).
- **RATIONALE**: These are zero-cost performance optimizations. There is no reason not to do them.

---

## Injection Instructions (for the AI executing this skill)

Each chapter in this file corresponds to a `{{ FIXED_RULES_* }}` placeholder in the template. During Phase 4 rendering, copy each chapter's full body (including RATIONALE) directly into the corresponding placeholder:

| Chapter | Inject Into Placeholder | Template Section |
|---------|------------------------|-------------------|
| F1.1 TypeScript Strict Mode | `{{ FIXED_RULES_TYPESCRIPT }}` | §3.1 Type Safety |
| F1.3 Naming Conventions | `{{ FIXED_RULES_NAMING }}` | §3.2 Naming Conventions |
| F2 Style Deny List | `{{ FIXED_RULES_DENY_LIST }}` | §1.5 Style Deny List |
| F3.1 Component Contract | `{{ FIXED_RULES_COMPONENT_CONTRACT }}` | §2.1 Component Contract |
| F4 i18n Baseline | `{{ FIXED_RULES_I18N_BASELINE }}` | §5.4 Internationalization |
| F5 Error Handling | `{{ FIXED_RULES_ERROR_HANDLING }}` | §5.2 Error Handling Rules |
| F6 a11y Baseline | `{{ FIXED_RULES_A11Y }}` | §5.3 Accessibility |
| F7 Git Collaboration | `{{ FIXED_RULES_GIT }}` | §8.1 Branching & Commits |
| F8 Security Baseline | `{{ FIXED_RULES_SECURITY }}` | §9 Security Baseline |
| F9 AI Baseline Constraints | `{{ FIXED_RULES_AI_BASE }}` | §7.1 Baseline Constraints |
| F10 Performance Baseline | `{{ FIXED_RULES_PERFORMANCE }}` | §5.5 Performance Baseline |

**Rendering rules**:
1. For chapters marked "already present as fixed text in template", AI does not need to re-inject — the template has them hardcoded.
2. Chapters marked "merged into..." should be prepended as baseline rules at the front of the corresponding derivation rule blocks.
3. **RATIONALE fields must be preserved** — they give AI the basis for judgment at boundary cases.
4. Keep the original markdown list structure when injecting. Do not rewrite as prose paragraphs.
