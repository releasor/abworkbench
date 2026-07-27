# Feature Planning Reference Guide

This guide provides structured templates and patterns for writing high-quality feature descriptions, acceptance criteria, complexity estimates, dependency graphs, and session granularity decisions. Use during feature-planner sessions.

For app-level design references (vision templates, tech stack matrix), see `app-planner/assets/app-design-guide.md`. For feature decomposition patterns (CRUD, SaaS, Social, E-commerce), see `${SKILL_DIR}/references/decomposition-patterns.md`.

---

## Feature Description Writing Guide

Feature descriptions are the **primary input** for autonomous pipeline sessions. A thin description forces the AI to guess — producing worse code. Invest in rich descriptions upfront.

### Minimum Word Counts

| Complexity | Hard Minimum (error) | Recommended Minimum (warning below) |
|------------|---------------------|-------------------------------------|
| low        | 15                  | 30+                                 |
| medium     | 15                  | 50+                                 |
| high       | 15                  | 80+                                 |
| critical   | 15                  | 100+                                |

Below 15 words is a validation error. Below the recommended minimum triggers a warning.

**There is NO upper limit** — the more detail the better. Rich descriptions prevent the AI from guessing, producing higher quality code. Always aim to describe the feature as thoroughly as possible: what to build, how it should behave, what data it touches, and what edge cases to handle.

### What to Include

Every description should cover these aspects (adapt per feature type):

1. **What to build** — concrete deliverables (API endpoints, UI pages/components, CLI commands, data models)
2. **Key behaviors** — business rules, validation, state transitions, workflows
3. **Integration points** — which existing modules, services, or APIs it connects to
4. **Data model** — entities, relationships, key fields, storage approach (when applicable)
5. **Error/edge cases** — failure modes, empty states, limits, unauthorized access

### Good vs Bad Examples

**Bad** (17 words — too thin):
```
"Build user authentication with login and registration. Support email/password and social login options."
```

**Good** (78 words — implementation-ready):
```
"Implement user authentication with email/password registration and login. Create a User model with fields: id, email (unique), password_hash, display_name, created_at, last_login. Build POST /api/auth/register (validate email format, enforce 8+ char password, check uniqueness, hash with bcrypt, return JWT), POST /api/auth/login (verify credentials, issue JWT with 7-day expiry), and GET /api/auth/me (return current user from JWT). Add auth middleware that validates JWT on protected routes. Handle errors: duplicate email (409), invalid credentials (401), expired token (401)."
```

**Bad** (12 words):
```
"Create the main dashboard page showing project overview and recent activity."
```

**Good** (65 words):
```
"Build a dashboard page at /dashboard as the post-login landing screen. Display: (1) summary cards showing total projects count, active tasks count, and recent activity count; (2) a recent activity feed listing the last 10 actions across all projects with timestamps; (3) a quick-access project list showing the 5 most recently updated projects. Fetch data via GET /api/dashboard/summary. Show loading skeleton on initial load, empty state when user has no projects."
```

### Headless Execution Requirements

Feature descriptions are consumed by **autonomous AI sessions running in headless mode** — no human is available to clarify ambiguities. This raises the bar for description quality:

**Must include for headless readiness:**
1. **Concrete deliverables** — specific files, endpoints, components, or models to create
2. **Integration points** — which existing APIs to call, which models to import, which modules to extend
3. **Key behaviors** — validation rules, state transitions, error codes, edge cases

**Dependency descriptions:**
When a feature depends on others, explicitly state what it needs from them:
- ✅ "Uses the User model (id, email, display_name) from F-001 to create a foreign key user_id on the Project model"
- ❌ "depends on F-001" — the AI won't know what F-001 built

**Self-test:** Read the description as if you have no other context. Could you implement it without asking a single question? If not, add more detail.

---

## Acceptance Criteria Writing Guide

Acceptance criteria define what "done" means for a feature. They should be specific, testable, and unambiguous.

### Format: Given/When/Then

```
Given [precondition/context]
When [action performed]
Then [expected outcome]
```

### Examples by Feature Type

**Authentication:**

- Given a new user, When they submit a valid registration form, Then an account is created and a confirmation email is sent.
- Given a registered user, When they enter correct credentials, Then they are logged in and redirected to the dashboard.
- Given a logged-in user, When their session expires, Then they are redirected to the login page with a message.

**CRUD Operations:**

- Given an authenticated user, When they create a new [entity] with valid data, Then the entity is saved and appears in the list.
- Given an entity list, When the user applies filters, Then only matching entities are displayed.
- Given an entity owner, When they delete the entity, Then it is removed after confirmation.

**Real-time:**

- Given two users viewing the same board, When one makes a change, Then the other sees it within 2 seconds without a page refresh.
- Given a user is offline, When they reconnect, Then missing updates are synced.

### Writing Principles

1. **One behavior per criterion.** Each criterion tests exactly one thing.
2. **No implementation details.** Criteria describe what, not how. Say "user is redirected" not "React Router navigates to /dashboard."
3. **Include edge cases.** Cover invalid input, unauthorized access, empty states, and error conditions.
4. **Be measurable.** Where performance matters, include specific thresholds (e.g., "within 2 seconds").
5. **Keep the count manageable.** A feature with more than 8 acceptance criteria may need to be split into sub-features.

---

## Complexity Estimation Guide

| Complexity | Characteristics | Typical Scope | Pipeline Tier |
|------------|----------------|---------------|---------------|
| low | Single module, straightforward CRUD, minimal UI | 1-2 API endpoints, 1-2 pages | lite (1 agent) |
| medium | Multiple modules, business logic, moderate UI | 3-5 API endpoints, 2-4 pages | lite (1 agent) |
| high | Cross-cutting concerns, complex state, advanced UI | 5+ API endpoints, complex interactions | standard (3 agents) |
| critical | Architectural changes, 10+ files, multi-module API surface changes | System-wide refactoring, new infrastructure + app logic | full (5 agents + critic) |

### Complexity Red Flags

Consider splitting a feature if it exhibits any of the following:

- More than 8 acceptance criteria.
- Touches more than 3 distinct modules or layers.
- Requires both frontend and backend architectural decisions.
- Involves third-party service integration AND non-trivial business logic.
- Contains both real-time and batch processing requirements.
- Needs new infrastructure (e.g., message queue, search index) AND application logic.

### Estimation Consistency Rules

- If a feature is marked as "low" complexity, it should not have more than 5 acceptance criteria.
- If a feature is marked as "high" complexity, it should have a clear justification (e.g., "involves payment processing with webhook handling and idempotency").
- Use "critical" complexity only for features requiring architectural changes that touch 10+ files, involve cross-module API surface changes, or need multi-critic voting for safety.
- When in doubt, estimate higher -- it is better to over-allocate than to under-allocate.

---

## Dependency Graph Rules

These rules ensure the feature dependency graph is valid and buildable.

1. **F-001 has zero dependencies.** The first feature is always infrastructure or project setup. It must be buildable from scratch with no preconditions.

2. **No circular dependencies.** Dependencies MUST form a directed acyclic graph (DAG). If A depends on B and B depends on A, restructure the features.

3. **Minimal dependency sets.** Each feature should depend only on the features it directly needs. Do not add transitive dependencies explicitly. If F-003 depends on F-002 and F-002 depends on F-001, then F-003 does NOT need to list F-001 as a dependency.

4. **Auth comes early.** Most features depend on authentication. Place auth-related features (registration, login, session management) as early in the graph as possible, typically F-002.

5. **Data model before display.** Features that create or define data entities must precede features that display, search, or manipulate that data.

6. **Infrastructure before everything.** Database setup, project scaffolding, CI/CD configuration, and environment setup belong in F-001.

7. **Independent features can be parallel.** If two features share no dependencies on each other, they can be built in parallel. The dependency graph should reflect this by not artificially linking them.

### Validation Checklist

- [ ] F-001 has an empty dependency list.
- [ ] No feature depends on itself.
- [ ] No circular dependency chains exist.
- [ ] Every feature ID referenced in a dependency list is defined in the plan.
- [ ] The graph can be topologically sorted (i.e., there exists a valid build order).

---

## Session Granularity Decision Rules

Session granularity determines whether a feature is implemented in a single coding session or split across multiple sub-feature sessions.

### Decision Table

| Condition | Granularity | Notes |
|-----------|-------------|-------|
| Acceptance criteria <= 5 | `feature` | Single session can handle it |
| Acceptance criteria 6-8 | `feature` or `auto` | Use judgment based on complexity |
| Acceptance criteria > 8 | `auto` | Define sub_features |
| Touches <= 2 modules | `feature` | Focused enough for one session |
| Touches 3+ modules | `auto` | Split by module boundary |
| Complexity "low" | `feature` | Always single session |
| Complexity "high" + many criteria | `auto` | Always consider splitting |

### Sub-Feature Naming Convention

When using `auto` granularity with sub-features, name each sub-feature with the parent feature ID as a prefix:

```
F-003-A: Backend API for [entity] CRUD
F-003-B: Frontend UI for [entity] management
F-003-C: Integration tests for [entity] workflows
```

### Sub-Feature Design Principles

1. **Independently testable.** Each sub-feature should produce a verifiable result on its own. A backend API sub-feature can be tested via API calls without the frontend.

2. **Single concern.** Each sub-feature focuses on one layer or aspect: backend API, frontend UI, data migration, integration, etc.

3. **Clear boundaries.** The interface between sub-features should be well-defined (e.g., API contracts between backend and frontend sub-features).

4. **Ordered when necessary.** Sub-features within a feature may have internal ordering (e.g., backend before frontend), but this should be captured in the sub-feature dependencies.

### When NOT to Split

- If the feature is inherently atomic (e.g., "add a favicon" or "configure environment variables").
- If splitting would create sub-features that are too small to justify a separate session (fewer than 2 acceptance criteria each).
- If the feature involves tightly coupled frontend and backend logic where splitting would require extensive mocking.
