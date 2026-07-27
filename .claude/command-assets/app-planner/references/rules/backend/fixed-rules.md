# Fixed Rules — Complete Backend Fixed Rules

> This file is read by the `backend-rules` skill in Phase 1 and injected directly into `backend-rules.md`.
> These rules are industry consensus / best practices — **do not ask the user**.
> Every rule includes RATIONALE so the AI understands intent, not just constraints.

---

## F1. Project Structure

### F1.1 Layered Architecture (Mandatory)

- **Rule**: Must use one of the following layering patterns, and be consistent across the project:
  - Classic three-tier: `controller → service → repository`
  - DDD-style: `handler → usecase → repository` (Go) / `router → service → dao` (Node)
- **Rule**: Upper layers must not bypass lower layers (controller must not call repository directly).
- **Rule**: Each layer does only its own job — controller handles request validation and response formatting, service handles business logic, repository handles data access.
- **RATIONALE**: Mixed layer boundaries are the #1 cause of backend code rot. When AI can't tell which layer does what, business logic scatters into controllers.

### F1.2 Directory Conventions

- **Rule**: The project root structure must clearly reflect the layering.
- **Rule**: Shared utilities (utils) must be isolated from business code.
- **Rule**: Config, constants, and type definitions are centrally managed.
- **Forbidden**: Turning `utils/` into a dumping ground for anything without a clear home.
- **RATIONALE**: The directory structure is the project's first piece of documentation. A new developer (including AI) should know where a function belongs just by reading it.

### F1.3 Module Boundaries

- **Rule**: Organize by business domain, not by technical layer (types/services/models cross-domain).
- **Rule**: Modules communicate through explicit interfaces. Do not access another module's internal implementation directly.
- **Forbidden**: Circular dependencies (module A imports B, B imports A).
- **RATIONALE**: Technical-layer organization scatters code for a single feature across 4–5 directories. Changing one feature requires jumping across directories.
- **Note on layering interaction with F1.1**: Organize by business domain at the top level. Within each domain directory, enforce the layering from F1.1 (e.g., user/controller/, user/service/, user/repository/). Do NOT create top-level controllers/, services/, repositories/ directories that span all domains.

---

## F2. API Design

### F2.1 REST Contract

- **Rule**: URLs use plural nouns (`/users`, `/orders`), never verbs (forbid `/getUser`, `/createOrder`).
- **Rule**: HTTP method semantics must be correct:
  - `GET` — query, must not modify data
  - `POST` — create
  - `PUT` — full update
  - `PATCH` — partial update
  - `DELETE` — remove
- **Rule**: Standard pagination params: `page` (1-based), `pageSize` (default 20, max 100).
- **Rule**: Standard sorting params: `sortBy=field&sortOrder=asc|desc`.
- **RATIONALE**: The API is a contract between frontend and backend. Inconsistent naming and parameter formats cause bugs in consumers.

### F2.2 Status Codes

- **Rule**: Use HTTP status codes strictly by semantics:
  - `200` — query success
  - `201` — create success
  - `204` — delete success (no body)
  - `400` — validation failure
  - `401` — not authenticated
  - `403` — forbidden
  - `404` — resource not found
  - `409` — resource conflict
  - `422` — valid request format but business logic rejection
  - `500` — unknown server error
- **Forbidden**: Returning `200` for all errors with an error code in the body.
- **RATIONALE**: HTTP status codes are standard signals for infrastructure (load balancers, monitoring, gateways). Bypassing them makes all observability useless.

### F2.3 Error Response Format

- **Rule**: All errors return a unified structure:
  ```json
  {
    "error": {
      "code": "USER_NOT_FOUND",
      "message": "User not found",
      "details": [],
      "traceId": "abc-123"
    }
  }
  ```
- **Rule**: `code` uses UPPER_SNAKE_CASE with business semantics (`USER_NOT_FOUND`, not `ERR_001`).
- **Rule**: `traceId` is generated at request entry and propagated through the entire call chain.
- **RATIONALE**: A unified error format lets frontends and gateways write one error handler instead of per-endpoint if/else chains.

### F2.4 API Versioning

- **Rule**: APIs must indicate version in URL or Header (`/api/v1/users` or `Accept: application/vnd.api.v1+json`).
- **Rule**: Breaking changes require a new version. Old versions must be maintained for at least one release cycle.
- **RATIONALE**: Unversioned APIs cause widespread mobile/third-party client crashes on release.

---

## F3. Error Handling

- **Rule**: All exceptions must be caught by a global exception filter and return a unified error response.
- **Rule**: Business exceptions vs. system exceptions are separated — business exceptions return 4xx, system exceptions return 500.
- **Forbidden**: Empty `catch(e) {}` blocks. If ignoring is truly necessary, comment why.
- **Forbidden**: `catch(e) { throw new Error('something went wrong') }` that swallows the original stack trace.
- **Rule**: Error logs must include traceId, user identifier, request method, and path.
- **RATIONALE**: The biggest backend failure isn't "an error occurred" — it's "an error occurred and nobody knows".

---

## F4. Security

### F4.1 Input Validation (Mandatory)

- **Rule**: All external inputs must be validated (body, query params, path params, headers, cookies).
- **Rule**: Use a validation framework (Joi/Zod/Pydantic/validator), not hand-written if/else.
- **Rule**: Validation failures return 400 with field-level error details.
- **Forbidden**: Trusting data from the frontend to be directly stored or executed.
- **RATIONALE**: Input validation is the first line of defense and the root cause mitigation for multiple OWASP Top 10 attacks.

### F4.2 Authentication & Authorization

- **Rule**: AuthN and AuthZ must be separated — middleware handles authentication, business logic handles authorization.
- **Rule**: JWT tokens must have expiration (access token ≤ 15min, refresh token ≤ 7d).
- **Rule**: Sensitive operations (delete, transfer, permission changes) require secondary confirmation.
- **Forbidden**: Hardcoding tokens/secrets in source code.
- **RATIONALE**: Separating AuthN and AuthZ allows independent security audits at each layer.

### F4.3 General Protections

- **Rule**: All external links/callback URLs must be validated against a whitelist to prevent Open Redirect.
- **Rule**: File uploads must validate type (whitelist), size, and content magic bytes.
- **Rule**: Passwords must use bcrypt/argon2 hashing. Forbid plaintext, MD5, or SHA1.
- **Forbidden**: Exposing secrets, tokens, or passwords in error messages or logs.
- **Forbidden**: Returning internal implementation details in responses (stack traces, SQL statements, framework versions).
- **RATIONALE**: These are the most common security vulnerabilities. Not a question of "should we" — it's "you will be breached if you don't."

### F4.4 Rate Limiting

- **Rule**: All public API endpoints must have rate limiting. Forbid unlimited request rates.
- **Rule**: Rate limit tiers: authentication endpoints (5 req/min), general API (100 req/min per user/IP), internal/admin endpoints (higher limits).
- **Rule**: Rate limit headers: include X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset in responses.
- **Rule**: Rate limit exceeded returns 429 Too Many Requests with Retry-After header.
- **RATIONALE**: Without rate limiting, a single misbehaving client or a simple script-kiddie attack can take down your entire API.

---

## F5. Database

**Note**: These rules assume a relational database (PostgreSQL/MySQL). If the project uses MongoDB (selected in Q8), some rules (migration files, SELECT syntax) do not apply. Document-specific rules are in the derived rules section.

- **Rule**: Connection pool must be reasonably sized (default ≤ CPU cores × 2). Connections must have timeouts.
- **Rule**: All migration files must be versioned, reversible, and committed to the repository.
- **Rule**: Queries must use parameterized queries or ORM-provided safe methods. Forbid string-concatenated SQL.
- **Rule**: Bulk operations (>1000 rows) must be batched.
- **Forbidden**: Executing single-row SQL inside loops (use batch insert/update instead).
- **Forbidden**: SELECT without LIMIT.
- **Forbidden**: `SELECT *` (specify columns explicitly).
- **RATIONALE**: The database is the component where a single failure has the largest blast radius in a backend system. One bad query can bring down the entire service.

---

## F6. Observability

- **Rule**: Logs must be structured (JSON format), containing: `timestamp`, `level`, `message`, `traceId`, `userId`, `path`, `method`.
- **Rule**: Expose at least two endpoints: `GET /health` (liveness) and `GET /health/ready` (readiness).
- **Rule**: Key business operations must be instrumented (registration, login, payment, order creation, etc.).
- **Forbidden**: Using `console.log` as a substitute for structured logging.
- **RATIONALE**: A microservice without structured logging is a black box. Troubleshooting goes from minutes to hours.

### F6.2 Distributed Tracing

- **Rule**: Every incoming request must generate or propagate a traceId. traceId is passed in X-Trace-Id header.
- **Rule**: All downstream calls (database, cache, message queue, external APIs) must carry the traceId.
- **Rule**: Use W3C Trace Context standard (traceparent header) for cross-service propagation.
- **Forbidden**: Generating a new traceId mid-request chain (breaks distributed traces).
- **RATIONALE**: traceId is the thread that ties together every log line and span for a single request across microservices. Without it, troubleshooting distributed systems is guesswork.

### F6.3 Health Check Endpoints

- **Rule**: GET /health (liveness) — returns 200 if the process is alive. No dependency checks.
- **Rule**: GET /health/ready (readiness) — returns 200 if all critical dependencies are available (database, cache, message queue). Returns 503 if any critical dependency is unreachable.
- **Rule**: Health checks must be lightweight (< 50ms). Forbid running expensive queries or external API calls.
- **RATIONALE**: Kubernetes and load balancers use these endpoints to decide whether to route traffic or restart the pod. A slow /health creates cascading failures.

---

## F7. Configuration Management

- **Rule**: Configuration has three tiers — code defaults < environment variables < config files (by priority).
- **Forbidden**: Committing any secrets, tokens, or passwords to Git.
- **Rule**: All environment-specific config (database connections, Redis addresses, third-party API keys) injected via environment variables.
- **Rule**: Must have a `.env.example` file listing all required environment variables with descriptions (use placeholders for values).
- **RATIONALE**: Separating config from code is a 12-Factor App principle and a security baseline.

---

## F8. Async & Message Queues

- **Rule**: Message handlers must be idempotent — replaying the same message produces no side effects.
- **Rule**: Async tasks must have timeout handling, retry strategy (exponential backoff), and dead letter queues.
- **Rule**: Message bodies must contain a unique id (for deduplication) and traceId (for tracing).
- **Rule**: Retry count and interval must have upper limits (e.g., max 3 retries, intervals 1s/5s/15s).
- **RATIONALE**: The biggest async system problem isn't "messages got lost" — it's "messages got processed twice and double-charged the customer."

### F8.4 Message Delivery Semantics

- **Rule**: Explicitly document the delivery guarantee for each queue/topic: at-most-once, at-least-once, or exactly-once.
- **Rule**: At-least-once (default for most systems): consumers must be idempotent.
- **Rule**: Dead letter queues (DLQ) must be configured. Failed messages route to DLQ after max retries.
- **Rule**: DLQ messages must have a replay/inspect mechanism. Forbid silently discarding failed messages.
- **RATIONALE**: The difference between at-least-once and exactly-once is the difference between "customer charged once" and "customer charged twice."

### F8.5 Graceful Shutdown

- **Rule**: Application must handle SIGTERM gracefully: stop accepting new requests, finish in-progress requests (with timeout), close database connections, flush logs.
- **Rule**: Shutdown timeout must be configured (default 30s). Kubernetes terminationGracePeriodSeconds must exceed this.
- **Rule**: In-flight async tasks must complete or be re-queued before shutdown.
- **Forbidden**: Hard-exit on SIGTERM (SIGKILL should be the fallback, not the default).
- **RATIONALE**: Deployments and pod restarts should not cause failed requests or lost data. Graceful shutdown is a basic operational requirement.

---

## F9. Testing

- **Rule**: Testing has three tiers — unit tests (service layer), integration tests (API endpoints + database), E2E (critical business flows).
- **Rule**: External dependencies (database, Redis, third-party APIs) must be mocked in unit tests.
- **Rule**: Integration tests use a test database or testcontainers. Test data is cleaned before and after each run.
- **Rule**: Coverage baseline: service layer ≥ 80%, controller layer ≥ 60%.
- **Forbidden**: Tests sharing mutable state (global variables / shared database rows).
- **RATIONALE**: Backend regression risk is far higher than frontend (one data corruption is irreversible). Tests are the only safety net.

---

## F10. AI Vibecoding Baseline Constraints (project-agnostic, always active)

### F10.1 Search First
- **Rule**: Before generating a new module, AI must search existing code to check for similar functionality.
- **Rule**: Before writing SQL/migrations, AI must read existing migration files and schema.

### F10.2 Dependency Control
- **Rule**: AI must not modify `package.json` / `requirements.txt` / `go.mod` / `Cargo.toml` on its own.
- **Rule**: If a new dependency is truly needed, AI must list: package name, version, reason, alternative comparison.

### F10.3 Breaking Changes
- **Rule**: Before modifying a shared module/utility/API contract, AI must list all callers.
- **Rule**: Changing API response field names or types requires assessing frontend impact first.

### F10.4 Config Immutability
- **Rule**: AI must not modify environment variables, database connection config, docker-compose, or CI/CD configuration on its own.
- **Rule**: Adding a new environment variable in code must be accompanied by an update to `.env.example`.

### F10.5 SQL Safety
- **Rule**: All AI-written SQL must be parameterized queries.
- **Forbidden**: AI generating string-concatenated SQL code.

### F10.6 Migration Files
- **Rule**: AI generating a new migration must also produce the corresponding rollback migration.
- **Forbidden**: Dropping columns or changing types in migrations (add-only, unless a rollback plan exists).

### F10.7 Context Honesty
- **Rule**: When uncertain, AI must explicitly say "I'm not sure." Forbid inventing API paths, library versions, or database field names.
- **Rule**: AI must read the latest file contents before modifying. Forbid generating diffs based on guesswork.

---

## Injection Instructions (for the AI executing this skill)

Each chapter in this file corresponds to a `{{ FIXED_RULES_* }}` placeholder in the template:

| Chapter | Inject Into Placeholder | Template Section |
|---------|------------------------|-------------------|
| F1 Project Structure | `{{ FIXED_RULES_STRUCTURE }}` | §1 Project Structure |
| F2 API Design | `{{ FIXED_RULES_API }}` | §2 API Design |
| F3 Error Handling | `{{ FIXED_RULES_ERROR }}` | §3 Error Handling |
| F4 Security | `{{ FIXED_RULES_SECURITY }}` | §4 Security (F4.1-F4.3 only; stop before F4.4) |
| F4.4 Rate Limiting | `{{ FIXED_RULES_RATE_LIMITING }}` | §4 Security (F4.4 only, injected separately) |
| F5 Database | `{{ FIXED_RULES_DATABASE }}` | §5 Database |
| F6 Observability | `{{ FIXED_RULES_OBSERVABILITY }}` | §6 Observability (F6 + F6.3 only; stop before F6.2) |
| F6.2 Distributed Tracing | `{{ FIXED_RULES_TRACING }}` | §6 Observability (F6.2 only, injected separately) |
| F7 Configuration | `{{ FIXED_RULES_CONFIG }}` | §7 Configuration |
| F8 Async & Queues | `{{ FIXED_RULES_ASYNC }}` | §8 Async & Queues |
| F8.4 Message Delivery | `{{ FIXED_RULES_MESSAGE_DELIVERY }}` | §8 Async & Queues |
| F8.5 Graceful Shutdown | `{{ FIXED_RULES_GRACEFUL_SHUTDOWN }}` | §8 Async & Queues |
| F9 Testing | `{{ FIXED_RULES_TEST }}` | §9 Testing |
| F10 AI Constraints | `{{ FIXED_RULES_AI_BASE }}` | §10 AI Behavior Constraints |

**Rendering rules**:
1. Copy each chapter's full body (including RATIONALE) directly into the corresponding placeholder.
2. RATIONALE must be preserved — it lets AI understand intent rather than follow mechanically.
3. Keep the original markdown list structure. Do not rewrite as prose paragraphs.
