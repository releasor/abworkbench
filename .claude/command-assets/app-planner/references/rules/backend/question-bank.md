# Question Bank — Backend Interactive Question Bank

> This file is read on demand by SKILL.md in Phase 2. The AI must strictly follow the group order defined in this file, asking **one group at a time (1–3 questions)**, never dumping all questions at once.
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
| G1 | Language & Runtime | Q1–Q2 | 2 |
| G2 | Framework & Architecture | Q3–Q4 | 2 |
| G3 | API Style | Q5–Q6 | 2 |
| G4 | Data Layer | Q7–Q8 | 2 |
| G5 | Auth | Q9 | 1 |
| G6 | Infrastructure | Q10–Q12 | 3 |
| G7 | Testing & Quality | Q13–Q15 | 3 |
| G8 | Observability | Q16–Q17 | 2 |
| G9 | AI Constraints | Q18–Q20 | 3 |

Total: 20 questions.

---

## G1 — Language & Runtime

### Q1. Programming Language
- **Options**:
  - A) TypeScript/Node.js **【Recommended: full-stack consistency】**
  - B) Python
  - C) Go
  - D) Java
  - E) Rust
  - F) Custom
- **Note**: Determines subsequent framework recommendations, ORM choices, and code style rules. If Q1=Custom (option F), Q3 (Framework) and Q7 (ORM) are language-dependent sub-lists with no predefined options. For Custom, ask Q3 and Q7 as open-ended questions (user types framework/ORM name), or skip with user consent. Q14 (Test Framework) should also be asked as an open-ended question.
- **Maps to**: `{{ language }}` + `{{ tech_stack_rules }}`

### Q2. Runtime Version
- **Options**:
  - A) Latest LTS **【Recommended】**
  - B) Latest stable
  - C) Specific version (please specify)
- **Note**: Locks the runtime version to avoid environment divergence issues.
- **Maps to**: `{{ runtime_version }}`

---

## G2 — Framework & Architecture

### Q3. Web Framework
- **Options (varies by Q1)**:
  - For Node.js: A) Express **【Recommended】** — B) Nest.js — C) Fastify — D) Hono — E) Koa
  - For Python: A) FastAPI **【Recommended】** — B) Django + DRF — C) Flask — D) Litestar
  - For Go: A) Gin **【Recommended】** — B) Echo — C) Chi — D) Fiber — E) Standard library net/http
  - For Java: A) Spring Boot **【Recommended】** — B) Quarkus — C) Micronaut
  - For Rust: A) Actix Web — B) Axum **【Recommended】** — C) Rocket
- **Note**: Determines routing registration, middleware mechanism, and DI conventions.
- **Maps to**: `{{ framework }}` + `{{ tech_stack_rules }}`

### Q4. Architecture Pattern
- **Options**:
  - A) Classic three-tier (Controller → Service → Repository) **【Recommended】**
  - B) Domain-Driven Design (Handler → Usecase → Repository)
  - C) Clean Architecture (Ports & Adapters)
  - D) Simple MVC (no over-engineering, small projects)
- **Note**: Determines directory structure and module boundary rules. Small projects don't need DDD.
- **Maps to**: `{{ architecture }}` + `{{ arch_rules }}`

---

## G3 — API Style

### Q5. API Style
- **Options**:
  - A) RESTful **【Recommended】**
  - B) GraphQL
  - C) gRPC (microservice-to-microservice)
  - D) REST + gRPC hybrid
- **Note**: Determines which API design rules are injected.
- **Maps to**: `{{ api_style }}` + `{{ api_rules }}`

### Q6. API Documentation
- **Conditional logic**: If Q5 = GraphQL, auto-select B and skip Q6. If Q5 = gRPC, auto-select C and skip Q6. If Q5 = REST + gRPC hybrid, ask but note that REST endpoints default to A. Only ask Q6 directly when Q5 = RESTful.
- **Options**:
  - A) OpenAPI/Swagger auto-generated **【Recommended for REST projects】**
  - B) GraphQL Schema (self-documenting) — auto-selected when Q5 = GraphQL
  - C) Protobuf (self-documenting) — auto-selected when Q5 = gRPC
  - D) Hand-written Markdown
- **Note**: Choosing A auto-injects "forbid hand-written API docs" rule.
- **Maps to**: `{{ api_docs }}`

---

## G4 — Data Layer

### Q7. ORM / Data Access
- **Options (varies by Q1)**:
  - For Node.js: A) Prisma **【Recommended】** — B) TypeORM — C) Drizzle ORM — D) Knex — E) Raw SQL
  - For Python: A) SQLAlchemy **【Recommended】** — B) Django ORM — C) Prisma Client Python — D) Raw SQL
  - For Go: A) GORM — B) sqlc **【Recommended】** — C) sqlx — D) Raw SQL
  - For Java: A) JPA/Hibernate — B) MyBatis — C) jOOQ **【Recommended】**
  - For Rust: A) Diesel — B) sqlx **【Recommended】** — C) SeaORM
- **Note**: Determines N+1 prevention, query standards, and migration strategy rules.
- **Maps to**: `{{ orm }}` + `{{ data_rules }}`

### Q8. Database
- **Options**:
  - A) PostgreSQL **【Recommended】**
  - B) MySQL
  - C) MongoDB
  - D) SQLite (development/small projects only)
- **Note**: Determines database-specific rules (column types, index syntax, migration tools).
- **Maps to**: `{{ database }}`

---

## G5 — Auth

### Q9. Authentication Scheme
- **Options**:
  - A) JWT (stateless, suitable for APIs/microservices) **【Recommended】**
  - B) OAuth2 + OIDC (third-party login/SSO)
  - C) Session + Cookie (traditional web apps)
  - D) API Key (service-to-service)
- **Note**: Determines middleware selection and token management rules.
- **Maps to**: `{{ auth_scheme }}` + `{{ auth_rules }}`

---

## G6 — Infrastructure

### Q10. Caching
- **Options**:
  - A) Redis **【Recommended】**
  - B) Memcached
  - C) In-memory cache (single instance only)
  - D) No caching needed
- **Note**: Determines cache key conventions, expiry strategy, and penetration/avalanche protection rules.
- **Maps to**: `{{ cache }}` + `{{ cache_rules }}`

### Q11. Message Queue
- **Options**:
  - A) RabbitMQ
  - B) Kafka **【Recommended: high-throughput/event sourcing】**
  - C) Redis Stream/BullMQ (lightweight task queues)
  - D) No message queue needed
- **Note**: Determines async processing, idempotency, and retry strategy rules. B is the default recommendation for most projects. Choose C only for lightweight task needs.
- **Maps to**: `{{ mq }}` + `{{ mq_rules }}`

### Q12. Containerization & Deployment
- **Options**:
  - A) Docker + Docker Compose **【Recommended】**
  - B) Kubernetes
  - C) No containerization (direct deployment)
- **Note**: Determines Dockerfile standards, health check, and environment variable management rules.
- **Maps to**: `{{ container }}` + `{{ deploy_rules }}`

---

## G7 — Testing & Quality

### Q13. Test Coverage Requirements
- **Options**:
  - A) Unit tests + Integration tests **【Recommended】**
  - B) Unit tests only
  - C) Critical path integration tests only
  - D) Not required yet
- **Note**: Determines test tier rules and coverage thresholds.
- **Maps to**: `{{ test_requirement }}` + `{{ test_rules }}`

### Q14. Test Framework (only ask if Q13 ≠ D)
- **Options (varies by Q1)**:
  - For Node.js: A) Vitest — B) Jest **【Recommended】**
  - For Python: A) pytest **【Recommended】** — B) unittest
  - For Go: A) Standard library testing **【Recommended】** — B) testify
  - For Java: A) JUnit 5 + Mockito **【Recommended】** — B) TestNG
  - For Rust: A) Built-in test **【Recommended】** — B) proptest
- **Maps to**: `{{ test_framework }}`

### Q15. Mock Strategy
- **Options**:
  - A) Mock all external deps, use testcontainers or in-memory DB for database **【Recommended】**
  - B) Mock all external deps including database
  - C) Use real environments as much as possible, minimal mocking
- **Note**: Determines test isolation level and CI dependencies.
- **Maps to**: `{{ mock_strategy }}` + `{{ test_rules }}`

---

## G8 — Observability

### Q16. Logging
- **Options**:
  - A) Structured JSON logging + centralized collection (ELK/Loki) **【Recommended】**
  - B) Structured logging + local files
  - C) Simple text logs, good enough
- **Note**: Determines log format and field specifications.
- **Maps to**: `{{ logging }}` + `{{ observability_rules }}`

### Q17. Monitoring & Tracing
- **Options**:
  - A) OpenTelemetry + Prometheus + Grafana **【Recommended】**
  - B) Health check endpoints + system monitoring only
  - C) Not needed yet
- **Note**: Determines instrumentation and alerting rules.
- **Maps to**: `{{ monitoring }}` + `{{ observability_rules }}`

---

## G9 — AI Constraints

### Q18. AI Permission to Add Dependencies
- **Options**:
  - A) Forbid AI from adding dependencies on its own; must undergo human review **【Recommended】**
  - B) Allowed, but must declare reason in PR description
  - C) Fully allowed
- **Maps to**: `{{ ai_dependency_rule }}`

### Q19. AI Modifying Shared Modules
- **Options**:
  - A) Must list all callers and impact analysis first **【Recommended】**
  - B) Not required
- **Maps to**: `{{ ai_breaking_change_rule }}`

### Q20. AI Modifying Configuration & Environment Variables
- **Options**:
  - A) Forbid modification; must be done manually **【Recommended】**
  - B) Allowed to modify, but must sync `.env.example`
- **Maps to**: `{{ ai_config_rule }}`
