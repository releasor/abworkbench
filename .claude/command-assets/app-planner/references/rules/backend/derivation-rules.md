# Derivation Rules — Backend Auto-Derivation Rule Mapping

> This file defines the mapping "Phase 2 answers → rule blocks auto-injected into backend-rules.md". The AI reads this file in Phase 3 — **do not ask the user again**.

---

## Phase 2 Answer Direct-Fill Table (copy user answer text directly into placeholders)

| Template Placeholder | Source | Example Fill |
|---------------------|--------|-------------|
| `{{ project_name }}` | Phase 0 auto-read | `robot-svc` |
| `{{ generated_at }}` | Phase 4, AI writes current date | `2026-05-24` |
| `{{ language }}` | Q1 answer | `TypeScript/Node.js` |
| `{{ runtime_version }}` | Q2 answer | `Node.js 22 LTS` |
| `{{ framework }}` | Q3 answer | `FastAPI` |
| `{{ architecture }}` | Q4 answer | `Classic three-tier` |
| `{{ api_style }}` | Q5 answer | `RESTful` |
| `{{ api_docs }}` | Q6 answer | `OpenAPI auto-generated` |
| `{{ orm }}` | Q7 answer | `Prisma` |
| `{{ database }}` | Q8 answer | `PostgreSQL` |
| `{{ auth_scheme }}` | Q9 answer | `JWT` |
| `{{ cache }}` | Q10 answer | `Redis` |
| `{{ mq }}` | Q11 answer | `Kafka` |
| `{{ container }}` | Q12 answer | `Docker + Compose` |
| `{{ test_requirement }}` | Q13 answer | `Unit + Integration` |
| `{{ test_framework }}` | Q14 answer | `pytest` |
| `{{ mock_strategy }}` | Q15 answer | `Mock external, testcontainers for DB` |
| `{{ logging }}` | Q16 answer | `Structured JSON + centralized` |
| `{{ monitoring }}` | Q17 answer | `OpenTelemetry + Prometheus + Grafana` |

---

## Trigger Map

> **Matching rule**: The AI should use **substring match** against the user's selected option text. The trigger text in the left column is a canonical substring present in the corresponding option. For example, "Node.js" matches "TypeScript/Node.js", "Nest.js" matches "Express + Nest.js".

| Trigger (Phase 2 Answer) | Inject Rule Block ID | Inject Into Placeholder |
|--------------------------|---------------------|------------------------|
| Q1 = Node.js | `D-NODE-01`, `D-NODE-02` | `{{ tech_stack_rules }}` |
| Q1 = Python | `D-PYTHON-01`, `D-PYTHON-02` | `{{ tech_stack_rules }}` |
| Q1 = Go | `D-GO-01`, `D-GO-02` | `{{ tech_stack_rules }}` |
| Q1 = Java | `D-JAVA-01` | `{{ tech_stack_rules }}` |
| Q1 = Rust | `D-RUST-01` | `{{ tech_stack_rules }}` |
| Q3 = FastAPI | `D-FASTAPI-01` | `{{ tech_stack_rules }}` |
| Q3 = Nest.js | `D-NEST-01` | `{{ tech_stack_rules }}` |
| Q3 = Gin | `D-GIN-01` | `{{ tech_stack_rules }}` |
| Q3 = Spring Boot | `D-SPRING-01` | `{{ tech_stack_rules }}` |
| Q4 = Domain-Driven Design | `D-DDD-01` | `{{ arch_rules }}` |
| Q4 = Clean Architecture | `D-CLEAN-01` | `{{ arch_rules }}` |
| Q4 = Classic three-tier | `D-CLASSIC-01` | `{{ arch_rules }}` |
| Q4 = Simple MVC | `D-MVC-01` | `{{ arch_rules }}` |
| Q5 = RESTful | `D-REST-01` | `{{ api_rules }}` |
| Q5 = GraphQL | `D-GRAPHQL-01` | `{{ api_rules }}` |
| Q5 = gRPC | `D-GRPC-01` | `{{ api_rules }}` |
| Q5 = REST + gRPC hybrid | `D-HYBRID-01` | `{{ api_rules }}` |
| Q6 = OpenAPI | `D-OPENAPI-BACKEND-01` | `{{ api_rules }}` |
| Q6 = Hand-written | `D-MARKDOWN-DOCS-01` | `{{ api_rules }}` |
| Q7 = Prisma | `D-PRISMA-01` | `{{ data_rules }}` |
| Q7 = SQLAlchemy | `D-SQLALCHEMY-01` | `{{ data_rules }}` |
| Q7 = GORM | `D-GORM-01` | `{{ data_rules }}` |
| Q7 = Raw SQL | `D-RAW-SQL-01` | `{{ data_rules }}` |
| Q7 = sqlc | `D-SQLC-01` | `{{ data_rules }}` |
| Q7 = jOOQ | `D-JOOQ-01` | `{{ data_rules }}` |
| Q7 = sqlx | `D-SQLX-01` | `{{ data_rules }}` |
| Q7 = Django ORM | `D-DJANGO-ORM-01` | `{{ data_rules }}` |
| Q8 = MongoDB | `D-MONGO-01` | `{{ data_rules }}` |
| Q8 = MySQL | `D-MYSQL-01` | `{{ data_rules }}` |
| Q8 = SQLite | `D-SQLITE-01` | `{{ data_rules }}` |
| Q9 = JWT | `D-JWT-01` | `{{ auth_rules }}` |
| Q9 = OAuth2 | `D-OAUTH-01` | `{{ auth_rules }}` |
| Q9 = Session | `D-SESSION-01` | `{{ auth_rules }}` |
| Q9 = API Key | `D-APIKEY-01` | `{{ auth_rules }}` |
| Q10 = Redis | `D-REDIS-01` | `{{ cache_rules }}` |
| Q10 = Memcached | `D-MEMCACHED-01` | `{{ cache_rules }}` |
| Q10 = In-memory cache | `D-MEMORY-CACHE-01` | `{{ cache_rules }}` |
| Q11 = RabbitMQ | `D-RABBITMQ-01` | `{{ mq_rules }}` |
| Q11 = Kafka | `D-KAFKA-01` | `{{ mq_rules }}` |
| Q11 = Redis Stream | `D-BULLMQ-01` | `{{ mq_rules }}` |
| Q12 = Docker | `D-DOCKER-01` | `{{ deploy_rules }}` |
| Q12 = Kubernetes | `D-K8S-01` | `{{ deploy_rules }}` |
| Q13 = Unit tests + Integration tests | `D-TEST-STRATEGY-01` | `{{ test_rules }}` |
| Q13 = Unit tests only | `D-TEST-STRATEGY-02` | `{{ test_rules }}` |
| Q13 = Critical path integration tests only | `D-TEST-STRATEGY-03` | `{{ test_rules }}` |
| Q15 = testcontainers | `D-TEST-MOCK-01` | `{{ test_rules }}` |
| Q15 = including database | `D-TEST-MOCK-02` | `{{ test_rules }}` |
| Q15 = real environments | `D-TEST-MOCK-03` | `{{ test_rules }}` |
| Q16 = Structured JSON logging | `D-OBS-LOG-01` | `{{ observability_rules }}` |
| Q16 = local files | `D-OBS-LOG-02` | `{{ observability_rules }}` |
| Q16 = Simple text | `D-OBS-LOG-03` | `{{ observability_rules }}` |
| Q17 = OpenTelemetry + Prometheus + Grafana | `D-OBS-METRICS-01` | `{{ observability_rules }}` |
| Q18 = Forbid | `D-AI-DEP-STRICT-01` | `{{ ai_dependency_rule }}` |
| Q18 = declare reason in PR | `D-AI-DEP-ANNOUNCE-01` | `{{ ai_dependency_rule }}` |
| Q18 = Fully allowed | `D-AI-DEP-LOOSE-01` | `{{ ai_dependency_rule }}` |
| Q19 = Must list all callers | `D-AI-BREAK-STRICT-01` | `{{ ai_breaking_change_rule }}` |
| Q19 = Not required | `D-AI-BREAK-LOOSE-01` | `{{ ai_breaking_change_rule }}` |
| Q20 = Forbid | `D-AI-CONFIG-STRICT-01` | `{{ ai_config_rule }}` |
| Q20 = Allowed to modify | `D-AI-CONFIG-SYNC-01` | `{{ ai_config_rule }}` |

---

## Rule Block Definitions

### D-NODE-01
**Trigger**: Q1 = Node.js | **Inject into**: `{{ tech_stack_rules }}`

- Language: TypeScript/Node.js, use ES modules.
- Lock runtime version in `package.json` `engines` field.
- Async handling uses `async/await`. Forbid callback hell.
- Uncaught exceptions must register a `process.on('unhandledRejection')` global handler.
- Environment variables read via `process.env`, centralized in one `env.ts` file for validation and export.

### D-NODE-02
**Trigger**: Q1 = Node.js | **Inject into**: `{{ tech_stack_rules }}`

- Package manager locked to `pnpm` (recommended). Commit `pnpm-lock.yaml`.
- `package.json` declares `"type": "module"`.
- CI validates `engines` field matches `.nvmrc`.

### D-PYTHON-01
**Trigger**: Q1 = Python | **Inject into**: `{{ tech_stack_rules }}`

- Use Python 3.11+, `pyproject.toml` manages project metadata and dependencies.
- Virtual environment management: recommend `uv` or `poetry`.
- Async uses `async/await` + `asyncio`.
- Type annotations: all public functions must annotate parameters and return types. CI runs `mypy --strict`.

### D-PYTHON-02
**Trigger**: Q1 = Python | **Inject into**: `{{ tech_stack_rules }}`

- Code formatting unified to `ruff format` + `ruff check`.
- Forbid bare `except:` — must specify exception type.
- Forbid mutable default arguments (`def fn(items=[])`).

### D-GO-01
**Trigger**: Q1 = Go | **Inject into**: `{{ tech_stack_rules }}`

- Use Go 1.22+, `go.mod` manages dependencies.
- Error handling: never ignore errors (`_ = fn()`). Must handle explicitly or comment why.
- Forbid using `panic` as a regular error handling mechanism (initialization phase excepted).
- Context must be propagated between functions. Forbid bare `context.Background()` for business logic.

### D-GO-02
**Trigger**: Q1 = Go | **Inject into**: `{{ tech_stack_rules }}`

- Project layout follows `cmd/` + `internal/` + `pkg/` standard structure.
- `internal/` organized by business domain (`internal/user/`), not by technical layer.
- Exported interfaces in `pkg/`, internal implementations in `internal/`.

### D-JAVA-01
**Trigger**: Q1 = Java | **Inject into**: `{{ tech_stack_rules }}`

- Use Java 21 LTS. Gradle or Maven manages dependencies.
- Lombok used with caution. Prefer hand-written getters/setters/builders.
- All DTOs use `record` type (Java 14+).
- Forbid writing business logic in entities. Entities are data mappings only.

### D-RUST-01
**Trigger**: Q1 = Rust | **Inject into**: `{{ tech_stack_rules }}`

- Use Rust stable channel. `Cargo.toml` locks MSRV.
- Error handling uses `anyhow` (application layer) / `thiserror` (library layer). Forbid bare unwrap (except in tests).
- Forbid holding `MutexGuard` across `.await` in async functions.
- `clippy` must pass with zero warnings in CI.

### D-FASTAPI-01
**Trigger**: Q3 = FastAPI | **Inject into**: `{{ tech_stack_rules }}`

- Use Pydantic v2 for request/response models. All models annotate `model_config = ConfigDict(from_attributes=True)`.
- Dependency injection uses `Depends()`. Keep controller functions concise.
- Exception handling uses FastAPI's `HTTPException` or custom exception handlers.
- Background tasks use `BackgroundTasks` or Celery. No heavy work in request threads.

### D-NEST-01
**Trigger**: Q3 = Nest.js | **Inject into**: `{{ tech_stack_rules }}`

- Modules organized by business domain (UserModule, OrderModule). Forbid giant AppModule.
- DTOs validated with `class-validator` decorators. Response DTOs use `class-transformer` to exclude sensitive fields.
- Exceptions use Nest's built-in `HttpException` series.
- Guards handle authorization. Interceptors handle response wrapping.

### D-GIN-01
**Trigger**: Q3 = Gin | **Inject into**: `{{ tech_stack_rules }}`

- Handlers return a unified format: `{ code, message, data }`.
- Middleware for logging, recovery, auth, rate limiting. Don't repeat these in handlers.
- Parameter binding uses `ShouldBindJSON` / `ShouldBindQuery`. Forbid manual parsing.
- Use `gin.Context` to propagate traceId and user info. Don't create new maps.

### D-SPRING-01
**Trigger**: Q3 = Spring Boot | **Inject into**: `{{ tech_stack_rules }}`

- Controllers only do parameter validation and response formatting. No business logic in controllers.
- Service layer must be interface-based. Use `@Autowired` or constructor injection.
- Global exception handling with `@ControllerAdvice` + `@ExceptionHandler`.
- Configuration uses `@ConfigurationProperties` binding. Forbid `System.getenv` in code.

### D-DDD-01
**Trigger**: Q4 = Domain-Driven Design | **Inject into**: `{{ arch_rules }}`

- Directory organized by aggregate root: `src/<domain>/handler/`, `src/<domain>/usecase/`, `src/<domain>/repository/`.
- Aggregate roots communicate via domain events or service layer. No direct cross-domain calls.
- Value Objects must be immutable.
- Repository interfaces defined in domain layer, implementations in infrastructure layer.

### D-CLEAN-01
**Trigger**: Q4 = Clean Architecture | **Inject into**: `{{ arch_rules }}`

- Layers: Entity → Usecase → Interface Adapter → Framework.
- Dependency rule: inner layers don't depend on outer layers.
- DTOs convert between layers — entities don't return directly to controllers.
- Database, cache, third-party APIs are all outer infrastructure.

### D-CLASSIC-01
**Trigger**: Q4 = Classic three-tier | **Inject into**: `{{ arch_rules }}`

- Three layers with strict separation:
  - Controller: request parsing, validation, response formatting. No business logic.
  - Service: all business logic, transaction management, authorization checks.
  - Repository: data access only. No business logic. Returns domain objects, not DB rows.
- Forbid: controller calling repository directly. Service calling other service's repository.
- Each layer in its own directory: `controller/`, `service/`, `repository/`.

### D-MVC-01
**Trigger**: Q4 = Simple MVC | **Inject into**: `{{ arch_rules }}`

- Simplified structure for small projects. Models contain data + business logic.
- Controllers handle routing and orchestration. Views are API responses (JSON).
- No separate repository layer -- models handle their own persistence.
- Forbid using this pattern for projects with > 5 business domains. Re-evaluate when the team grows beyond 3 developers.

### D-REST-01
**Trigger**: Q5 = REST | **Inject into**: `{{ api_rules }}`

- URLs use plural nouns, no verbs. Resource nesting: `/users/{id}/orders`.
- Query params standardized: `page`, `pageSize`, `sortBy`, `sortOrder`, `filter[]`.
- Response body optionally wrapped: `{ data, meta: { page, pageSize, total }, error }`.
- HATEOAS not required, but at minimum return pagination metadata.

### D-GRAPHQL-01
**Trigger**: Q5 = GraphQL | **Inject into**: `{{ api_rules }}`

- Choose Schema-first or Code-first and be consistent across the project.
- Queries must limit depth and complexity (prevent malicious queries).
- DataLoader must be used for batching N+1 requests (create a new DataLoader instance per request).
- Mutations return the changed object. Don't make a separate follow-up Query.

### D-GRPC-01
**Trigger**: Q5 = gRPC | **Inject into**: `{{ api_rules }}`

- `.proto` files placed in `proto/` directory as the single source of truth.
- Forbid manually modifying generated code.
- All RPCs must have a deadline/timeout. No infinite waits.
- Errors use gRPC status codes + details (not HTTP status code conventions).

### D-HYBRID-01
**Trigger**: Q5 = REST + gRPC hybrid | **Inject into**: `{{ api_rules }}`

- REST for external-facing APIs (browser, mobile clients). gRPC for internal microservice communication.
- REST routes defined in `api/rest/`. gRPC services in `api/grpc/`.
- Shared business logic extracted to service layer -- both REST handlers and gRPC handlers call the same services.
- Forbid: REST handler calling gRPC handler directly or vice versa. All go through service layer.

### D-OPENAPI-BACKEND-01
**Trigger**: Q6 = OpenAPI | **Inject into**: `{{ api_rules }}`

- OpenAPI spec auto-generated from code annotations/decorators. Forbid hand-written YAML/JSON specs.
- API doc endpoints: `GET /docs` (Swagger UI) / `GET /redoc`.
- Request/response models must appear in docs. Schema changes auto-reflect in docs.

### D-MARKDOWN-DOCS-01
**Trigger**: Q6 = Hand-written | **Inject into**: `{{ api_rules }}`

- Hand-written API docs must be updated in the same PR as API changes. Forbid docs that diverge from implementation.
- Document request/response examples for every endpoint. Use realistic example values, not placeholder text.
- Cross-reference by endpoint path. Each endpoint docs section must include: HTTP method, path, request body schema, response body schema, error codes.
- Docs file located at `docs/api.md` or similar centralized location. Forbid scattering API docs across multiple files.

### D-PRISMA-01
**Trigger**: Q7 = Prisma | **Inject into**: `{{ data_rules }}`

- `schema.prisma` is the single source of truth for the database. Manual SQL changes must be reverse-synced to schema.
- Use `prisma migrate dev` to generate migrations. Commit migration files to the repository.
- Queries use `include`/`select` to explicitly specify relations. Avoid `select: {}` for full loading.
- Transactions use `prisma.$transaction` or interactive transaction API.

### D-SQLALCHEMY-01
**Trigger**: Q7 = SQLAlchemy | **Inject into**: `{{ data_rules }}`

- Use SQLAlchemy 2.0+ style (`select(User).where(...)` not `User.query`).
- Separate Model from Schema — ORM models do not return directly to API.
- Session management: one session per request, managed via DI or middleware.
- Relation loading uses `selectinload` to avoid N+1. Forbid default lazy loading.

### D-GORM-01
**Trigger**: Q7 = GORM | **Inject into**: `{{ data_rules }}`

- Models defined in `internal/<domain>/model/`, isolated from handlers.
- Forbid `.Find(&users)` without conditions — must explicitly `Where` + `Limit`.
- Migrations use a standalone migration tool (golang-migrate). Don't use GORM AutoMigrate for production databases.
- Preloading uses `Preload` with explicit field specification. No default full preloading.

### D-RAW-SQL-01
**Trigger**: Q7 = Raw SQL | **Inject into**: `{{ data_rules }}`

- SQL files centralized in `sql/` or `queries/` directory. Forbid scattering in code.
- All SQL must be parameterized queries. CI scans for string-concatenated SQL.
- Each SQL file annotated with: author, purpose, corresponding EXPLAIN output.
- Query results mapped to typed DTOs. Forbid `interface{}`/`map[string]any`.

### D-SQLC-01
**Trigger**: Q7 = sqlc | **Inject into**: `{{ data_rules }}`

- sqlc generates type-safe Go code from SQL. All SQL queries version-controlled in `queries/` directory.
- Forbid hand-written SQL strings in Go code. All queries must be defined in `.sql` files.
- Generated code must not be manually edited. CI validates generated code matches SQL source.
- Migration files managed separately (golang-migrate or atlas). sqlc reads the current schema for type generation.

### D-JOOQ-01
**Trigger**: Q7 = jOOQ | **Inject into**: `{{ data_rules }}`

- jOOQ type-safe SQL DSL for Java. Generated classes via code-gen from database schema.
- Forbid mixing raw JDBC queries with jOOQ. All queries use jOOQ DSL, not string concatenation.
- jOOQ code generation integrated into Gradle/Maven build. Generated classes committed to repository.
- Schema changes require re-running code generation. CI validates code-gen is up to date.

### D-SQLX-01
**Trigger**: Q7 = sqlx | **Inject into**: `{{ data_rules }}`

- sqlx async PostgreSQL/SQLite driver for Rust. Migrations via `sqlx migrate`.
- Forbid `sqlx::query()` with raw string SQL — use compile-time checked `sqlx::query!()` or `sqlx::query_as!()` macros.
- Migration files in `migrations/` directory. CI runs `sqlx migrate run --dry-run` to validate.
- Database pool configured via `sqlx::PgPool` with connection timeout and max connections.

### D-DJANGO-ORM-01
**Trigger**: Q7 = Django ORM | **Inject into**: `{{ data_rules }}`

- Django ORM models defined in `models.py`. Forbid raw SQL in views or services.
- Migrations generated via `python manage.py makemigrations` and committed to repository.
- Query optimization: use `select_related()` for FK joins, `prefetch_related()` for M2M joins. Forbid N+1 queries.
- Queryset filtering uses Django ORM methods. Forbid `.raw()` SQL queries unless performance-critical with documented reason.

### D-MONGO-01
**Trigger**: Q8 = MongoDB | **Inject into**: `{{ data_rules }}`

- MongoDB document model: schema validation via JSON Schema (`$jsonSchema` validator on collections).
- Indexing strategy for query patterns: create indexes for all query filter fields. Use `explain()` to verify index usage.
- Aggregation pipeline standards: stages must be documented with purpose comments. Forbid complex pipelines without EXPLAIN.
- No-SQL injection prevention: validate and sanitize all user input in queries. Use parameterized query operators (`$eq`, `$gt`), forbid `$where` with user input.
- Collection design with embedded vs. reference trade-offs: embed for read-together data, reference for independently-accessed data.
- The relational-database-oriented F5 fixed rules (migration files, SELECT syntax, normalization) do NOT apply. Skip F5.1-F5.3 of the fixed rules content.

### D-MYSQL-01
**Trigger**: Q8 = MySQL | **Inject into**: `{{ data_rules }}`

- MySQL 8.0+ with InnoDB engine default. Use `utf8mb4` charset for all tables.
- Forbid `utf8mb3` (deprecated). Forbid MyISAM engine (no transaction support).
- Index types: BTREE for range queries, HASH for exact-match lookups (memory tables only).
- Connection pool: configure `wait_timeout` and `interactive_timeout` to prevent stale connections.
- Migration files use the same tooling as PostgreSQL (golang-migrate, Flyway, Alembic). Schema differences documented in README.

### D-SQLITE-01
**Trigger**: Q8 = SQLite | **Inject into**: `{{ data_rules }}`

- SQLite for local development and single-instance deployments. WAL mode enabled by default.
- Forbid SQLite for multi-instance production deployments (no concurrent write support).
- Forbid concurrent write access across multiple processes. Use a single writer pattern.
- Migration files still version-controlled. Test with the same SQLite version as production.
- No connection pool needed (single connection). Close connections explicitly after each operation.

### D-JWT-01
**Trigger**: Q9 = JWT | **Inject into**: `{{ auth_rules }}`

- Access token TTL ≤ 15min. Refresh token TTL ≤ 7d.
- Token payload contains no sensitive info (passwords, phone numbers). Only userId + role.
- Secret read from environment variables. Forbid hardcoding.
- Token blacklist (logout/password change invalidation) implemented with Redis.

### D-OAUTH-01
**Trigger**: Q9 = OAuth2 | **Inject into**: `{{ auth_rules }}`

- Don't implement your own OAuth2 Provider (unless it's the project's core business).
- Third-party login (Google/GitHub) uses their official SDK or OpenID Connect.
- `state` parameter must be used and validated to prevent CSRF.
- `redirect_uri` must be whitelist-validated.

### D-SESSION-01
**Trigger**: Q9 = Session | **Inject into**: `{{ auth_rules }}`

- Session storage uses Redis, not memory (loses data on restart, not shared across instances).
- Session ID generated with `crypto.randomUUID()`, not auto-increment IDs.
- Cookie settings: `HttpOnly` + `Secure` (production) + `SameSite=Lax`.
- Session ID must be rotated after successful login (prevent Session Fixation).

### D-APIKEY-01
**Trigger**: Q9 = API Key | **Inject into**: `{{ auth_rules }}`

- API keys for service-to-service communication. Not for end-user auth.
- Keys stored hashed (SHA-256) in database. Plaintext shown once at creation.
- Key format: `sk_<random_32_bytes_base64url>` with prefix for easy identification in logs.
- Key validation: constant-time comparison to prevent timing attacks.
- Keys must have expiration (default 365d). Must be rotatable without downtime.

### D-REDIS-01
**Trigger**: Q10 = Redis | **Inject into**: `{{ cache_rules }}`

- Cache key naming: `<service>:<resource>:<id>` (`user-service:user:123`).
- All cache entries must have TTL. Forbid never-expiring keys.
- Cache update pattern: update DB first → then invalidate cache (Cache-Aside pattern).
- Penetration prevention: cache null values too (short TTL). Avalanche prevention: add random jitter to TTL.

### D-MEMCACHED-01
**Trigger**: Q10 = Memcached | **Inject into**: `{{ cache_rules }}`

- Key naming: `<service>:<resource>:<id>`. Max key length 250 bytes.
- TTL mandatory. Default TTL 300s. Forbid keys without expiration.
- Memcached is a simple KV store -- no complex data structures. For lists/sets, serialize in application.
- No persistence -- data lost on restart. Do not store data that cannot be regenerated.

### D-MEMORY-CACHE-01
**Trigger**: Q10 = In-memory cache | **Inject into**: `{{ cache_rules }}`

- In-memory cache suitable for single-instance deployments only.
- Use LRU eviction with max size limit. Forbid unbounded caches (memory leak risk).
- Cache invalidation via TTL only. No distributed invalidation (single instance).
- Warning: cache lost on restart. Not shared across instances. Upgrade to Redis before multi-instance deployment.

### D-RABBITMQ-01
**Trigger**: Q11 = RabbitMQ | **Inject into**: `{{ mq_rules }}`

- Each message body must contain `messageId` (dedup) + `traceId` (tracing).
- Consumers must be idempotent.
- Failed messages nack'd and routed to dead letter queue for manual handling.
- Connection heartbeat and auto-recovery must be configured.

### D-KAFKA-01
**Trigger**: Q11 = Kafka | **Inject into**: `{{ mq_rules }}`

- Messages must contain key (partition basis) and headers (traceId, messageId).
- Consumer group ID matches service name.
- Idempotency via messageId + database dedup table.
- Producer sets `acks=all` + `idempotence=true` to prevent message loss/duplication.

### D-BULLMQ-01
**Trigger**: Q11 = Redis Stream | **Inject into**: `{{ mq_rules }}`

- Lightweight task queue suitable for delayed tasks, email sending, notifications.
- Jobs must define timeout. On failure, configure retry (exponential backoff, max 3 retries).
- Job progress updated via `job.progress()` for long-running tasks.

### D-DOCKER-01
**Trigger**: Q12 = Docker | **Inject into**: `{{ deploy_rules }}`

- Dockerfile uses multi-stage builds. Final image excludes build tools.
- Base image uses `-slim` or `-alpine` variants.
- Health check: `HEALTHCHECK` points to `/health` endpoint.
- `.dockerignore` excludes node_modules, .git, log files.

### D-K8S-01
**Trigger**: Q12 = Kubernetes | **Inject into**: `{{ deploy_rules }}`

- Must configure liveness and readiness probes (pointing to `/health` and `/health/ready`).
- Resource limits (requests/limits) must be set.
- Sensitive config via Secret, non-sensitive via ConfigMap.
- Pod anti-affinity: same-type pods not scheduled on the same node (high availability).

### D-AI-DEP-STRICT-01
**Trigger**: Q18 = Forbid | **Inject into**: `{{ ai_dependency_rule }}`

- AI must not modify dependency manifest files on its own.
- If a new dependency is truly needed, AI must list in the PR description: package name, version, purpose, alternative comparison.

### D-AI-DEP-ANNOUNCE-01
**Trigger**: Q18 = declare reason in PR | **Inject into**: `{{ ai_dependency_rule }}`

- AI may introduce new dependencies, but must explicitly declare in the PR description: package name, version, reason, bundle size/license impact.

### D-AI-DEP-LOOSE-01
**Trigger**: Q18 = Fully allowed | **Inject into**: `{{ ai_dependency_rule }}`

- AI may add dependencies autonomously, but must run all tests after adding and document new dependencies in PR description.
- CI must validate no dependency conflicts or security vulnerabilities introduced.

### D-AI-BREAK-STRICT-01
**Trigger**: Q19 = Must list all callers | **Inject into**: `{{ ai_breaking_change_rule }}`

- Before modifying a public function/type/utility, AI must Select-String the entire repository and list all references.
- Breaking changes must include a migration guide.

### D-AI-BREAK-LOOSE-01
**Trigger**: Q19 = Not required | **Inject into**: `{{ ai_breaking_change_rule }}`

- No formal caller analysis required before modifying shared modules.
- AI should still exercise caution: read the module before modifying and run related tests after changes.

### D-AI-CONFIG-STRICT-01
**Trigger**: Q20 = Forbid | **Inject into**: `{{ ai_config_rule }}`

- AI must not modify environment variables, Docker config, CI/CD config, or infrastructure config.
- If changes are truly needed, AI must list the change proposal and impact in the response. Human executes.

### D-AI-CONFIG-SYNC-01
**Trigger**: Q20 = Allowed to modify | **Inject into**: `{{ ai_config_rule }}`

- AI may modify config files but must sync `.env.example` and announce changes in PR description.
- New environment variables must be documented with description and default value.

### D-OBS-LOG-01
**Trigger**: Q16 = Structured JSON logging | **Inject into**: `{{ observability_rules }}`

- Log format: JSON with fields `timestamp`, `level`, `message`, `traceId`, `userId`, `service`, `path`, `method`, `duration_ms`.
- Centralized collection via ELK (Elasticsearch + Logstash + Kibana) or Grafana Loki.
- Log levels: ERROR (requires alert), WARN (requires investigation), INFO (key business events), DEBUG (development only).
- Forbid logging sensitive data (passwords, tokens, national IDs). Must mask.

### D-OBS-LOG-02
**Trigger**: Q16 = local files | **Inject into**: `{{ observability_rules }}`

- Log format: JSON with fields `timestamp`, `level`, `message`, `traceId`.
- Log rotation: daily rotation, retain 7 days. Use logrotate or built-in rotation.
- Log levels same as D-OBS-LOG-01.
- Forbid logging sensitive data.

### D-OBS-LOG-03
**Trigger**: Q16 = Simple text | **Inject into**: `{{ observability_rules }}`

- Plain-text logging must include timestamp and level prefix per line. Format: `[YYYY-MM-DD HH:MM:SS] [LEVEL] message`.
- Forbid intermixing structured and unstructured formats. Choose one format and apply consistently.
- Plain-text acceptable for single-instance deployments only. Upgrade to structured JSON before multi-instance or production deployment.
- Log levels: ERROR, WARN, INFO, DEBUG. Forbid logging sensitive data (passwords, tokens, national IDs).

### D-OBS-METRICS-01
**Trigger**: Q17 = OpenTelemetry + Prometheus + Grafana | **Inject into**: `{{ observability_rules }}`

- OpenTelemetry SDK auto-instruments HTTP/gRPC/database calls.
- Custom metrics: request count, request duration (p50/p95/p99), error rate, DB query duration.
- Prometheus scrapes `/metrics` endpoint. Grafana dashboards for: request latency, error rate, DB connection pool, cache hit rate.
- Alerting rules: error rate > 5% for 5min triggers alert, p95 latency > 500ms for 5min triggers warning.

### D-TEST-STRATEGY-01
**Trigger**: Q13 = Unit tests + Integration tests | **Inject into**: `{{ test_rules }}`

- Testing tiers: unit tests (service/repository layers) + integration tests (API endpoints + DB).
- Unit tests: fast (<100ms each), no external deps. Mock all I/O.
- Integration tests: use test database or testcontainers. Test realistic scenarios.
- Coverage targets: service layer >= 80%, controller layer >= 60%.
- CI runs all tests. Integration tests run against a fresh DB instance each time.

### D-TEST-STRATEGY-02
**Trigger**: Q13 = Unit tests only | **Inject into**: `{{ test_rules }}`

- Unit tests only. Coverage target: service layer >= 80%.
- External deps mocked. No database or network access in tests.
- Recommend adding integration tests for critical data-access paths before production.

### D-TEST-STRATEGY-03
**Trigger**: Q13 = Critical path integration tests only | **Inject into**: `{{ test_rules }}`

- Integration tests for critical business paths only (auth, payment, core CRUD).
- Coverage targets not enforced project-wide. Critical paths must have >= 1 test each.
- Non-critical code: tests optional but encouraged.

### D-TEST-MOCK-01
**Trigger**: Q15 = testcontainers | **Inject into**: `{{ test_rules }}`

- External APIs (payment gateways, email services, third-party SDKs): mocked.
- Database: use testcontainers (dockerized Postgres/MySQL/Redis) for integration tests.
- Testcontainers lifecycle: start before test suite, stop after. Use singleton container pattern to share across tests.
- Test data: seeded per test file, cleaned up after each test. Forbid shared mutable test data.

### D-TEST-MOCK-02
**Trigger**: Q15 = including database | **Inject into**: `{{ test_rules }}`

- All external deps including database are mocked.
- Use in-memory doubles or mock libraries for database.
- Forbid tests that depend on a running database instance.
- Warning: mocked DB may miss real DB behavior (constraint violations, type coercion). Add at least a few integration tests before production.

### D-TEST-MOCK-03
**Trigger**: Q15 = real environments | **Inject into**: `{{ test_rules }}`

- Prefer real environments over mocking. Tests run against dedicated test infrastructure.
- Test database is a shared instance (not per-developer).
- Test data isolation: each test creates its own data and cleans up.
- Requires CI access to test infrastructure. Tests may be slower but more realistic.

---

## Template Placeholder Coverage Self-Check

This table verifies every template placeholder has at least one derivation rule or fixed-rule source. The AI should use this in Phase 4 to confirm all `{{ }}` placeholders are resolvable.

| Placeholder | Has Derivation Rules? | Has Fixed Rules? | Source |
|------------|----------------------|-------------------|--------|
| `{{ tech_stack_rules }}` | Yes | No | D-NODE-01/02, D-PYTHON-01/02, D-GO-01/02, D-JAVA-01, D-RUST-01, D-FASTAPI-01, D-NEST-01, D-GIN-01, D-SPRING-01 |
| `{{ arch_rules }}` | Yes | No | D-DDD-01, D-CLEAN-01, D-CLASSIC-01, D-MVC-01 |
| `{{ api_rules }}` | Yes | No | D-REST-01, D-GRAPHQL-01, D-GRPC-01, D-HYBRID-01, D-OPENAPI-BACKEND-01, D-MARKDOWN-DOCS-01 |
| `{{ data_rules }}` | Yes | No | D-PRISMA-01, D-SQLALCHEMY-01, D-GORM-01, D-RAW-SQL-01, D-SQLC-01, D-JOOQ-01, D-SQLX-01, D-DJANGO-ORM-01, D-MONGO-01, D-MYSQL-01, D-SQLITE-01 |
| `{{ auth_rules }}` | Yes | No | D-JWT-01, D-OAUTH-01, D-SESSION-01, D-APIKEY-01 |
| `{{ cache_rules }}` | Yes | No | D-REDIS-01, D-MEMCACHED-01, D-MEMORY-CACHE-01 |
| `{{ mq_rules }}` | Yes | No | D-RABBITMQ-01, D-KAFKA-01, D-BULLMQ-01 |
| `{{ deploy_rules }}` | Yes | No | D-DOCKER-01, D-K8S-01 |
| `{{ observability_rules }}` | Yes | No | D-OBS-LOG-01, D-OBS-LOG-02, D-OBS-LOG-03, D-OBS-METRICS-01 |
| `{{ test_rules }}` | Yes | No | D-TEST-STRATEGY-01/02/03, D-TEST-MOCK-01/02/03 |
| `{{ ai_dependency_rule }}` | Yes | No | D-AI-DEP-STRICT-01, D-AI-DEP-ANNOUNCE-01, D-AI-DEP-LOOSE-01 |
| `{{ ai_breaking_change_rule }}` | Yes | No | D-AI-BREAK-STRICT-01, D-AI-BREAK-LOOSE-01 |
| `{{ ai_config_rule }}` | Yes | No | D-AI-CONFIG-STRICT-01, D-AI-CONFIG-SYNC-01 |
| `{{ FIXED_RULES_* }}` | No | Yes | `references/fixed-rules.md` |
| `{{ deny_list_summary }}` | N/A | N/A | AI auto-generates in Phase 4 |
| `{{ recommended_libs }}` | N/A | N/A | AI auto-generates in Phase 4 |
