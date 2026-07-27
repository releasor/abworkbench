# Fixed Rules — Complete Database Fixed Rules

> This file is read by the `database-rules` skill in Phase 1 and injected directly into `database-rules.md`.
> These rules are industry consensus / best practices — **do not ask the user**.
> Every rule includes RATIONALE so the AI understands intent, not just constraints.

---

## F1. Schema Design

### F1.1 Naming Conventions (Mandatory)

- **Table names**: snake_case plural (`users`, `order_items`), not camelCase. Junction tables use alphabetical concatenation (`user_roles`).
- **Column names**: snake_case (`created_at`, `user_id`), not camelCase.
- **Primary keys**: use `id` for single tables, or concatenated names for junction tables (`user_id`, `role_id`).
- **Foreign keys**: `<referenced_table>_id` (`user_id`, `order_id`).
- **Indexes**: prefix `idx_` + table + columns (`idx_users_email`).
- **Unique constraints**: prefix `uq_` + table + columns (`uq_users_email`).
- **Forbidden**: Pinyin names, reserved keywords as table/column names (`order`, `group`, `user`).
- **RATIONALE**: Consistent naming makes ORM mapping accurate, SQL readable, and AI code generation precise when guessing field names.

### F1.2 Required Fields

- **Rule**: Every business table must have:
  - `id` — primary key
  - `created_at` — `NOT NULL DEFAULT NOW()`
  - `updated_at` — `NOT NULL DEFAULT NOW()` with auto-update (or trigger)
- **Rule**: Tables requiring soft delete must add `deleted_at` (NULL = not deleted). Unique indexes must include `deleted_at`.
- **Forbidden**: Using `is_deleted` boolean instead of `deleted_at` — losing the deletion timestamp loses audit information.
- **RATIONALE**: Consistent timestamps are the foundation of all auditing, synchronization, and CDC.

### F1.3 Primary Key Strategy

- **Rule**: Prefer UUID v4/v7 or ULID as the business primary key exposed to APIs.
- **Rule**: Primary key strategy is determined by Q3 (Primary Key Strategy). If UUID/ULID is chosen, UUIDs are used both internally and in the API layer. If auto-increment is chosen, BIGINT may be used internally, but the API layer must expose UUID (via an additional UUID column or ID mapping).
- **Forbidden**: Exposing auto-increment IDs directly to the frontend (enumerable, leaks data volume).
- **Forbidden**: Using business fields as primary keys (e.g., national ID, phone number) — business rules change.
- **RATIONALE**: UUIDs prevent enumeration, support distributed generation, and avoid merge conflicts. Exposing auto-increment IDs is information leakage.

### F1.4 Normalization vs. Denormalization

- **Rule**: Default to 3NF (Third Normal Form) to reduce data redundancy.
- **Denormalization exception**: Only allowed when query performance is a proven bottleneck AND index optimization has been exhausted. Must be documented with rationale in schema comments.
- **Forbidden**: Denormalizing without load testing.
- **RATIONALE**: Denormalization is a double-edged sword — queries get faster but writes and consistency maintenance costs skyrocket.

### F1.5 Enum Values

- **Rule**: Status columns must list all possible values in schema comments.
- **Rule**: Prefer database ENUM types (PostgreSQL use CHECK constraint + string) or enum tables.
- **Forbidden**: Using `status TINYINT` without comments — nobody knows what 2 means.
- **RATIONALE**: Enum values are the easiest thing to rot — every status addition requires a full code scan to confirm compatibility.

---

## F2. Column Types

- **Rule**: Monetary amounts always use `DECIMAL(19,4)` or `NUMERIC`. Forbid `FLOAT`/`DOUBLE`.
- **Rule**: Date/time use `TIMESTAMP WITH TIME ZONE` (PostgreSQL) / `DATETIME` (MySQL). Forbid string-stored dates.
- **Rule**: JSON data use `JSONB` (PostgreSQL) / `JSON` (MySQL 8+). Forbid storing TEXT and parsing in application layer.
- **Rule**: Character set unified to `UTF8MB4` (MySQL) / `UTF8` (PostgreSQL). Collation unified.
- **Rule**: IP addresses use `INET` (PostgreSQL) / `VARBINARY(16)` (MySQL), not VARCHAR.
- **Forbidden**: Using VARCHAR to store arrays (e.g., `"a,b,c"`) — use array types or junction tables.
- **RATIONALE**: The right type lets the database do validation and index optimization for you. Wrong types mean you're throwing away the database's self-protection.

---

## F3. Index Strategy

- **Rule**: Primary keys are auto-indexed. Foreign keys must be manually indexed.
- **Rule**: Columns involved in WHERE/JOIN/ORDER BY/DISTINCT must be evaluated for index need.
- **Rule**: Multi-column queries use composite indexes with the leftmost prefix rule — equality columns first, range columns last.
- **Rule**: Adding indexes to large tables must use `CONCURRENTLY` (PostgreSQL) / `ALGORITHM=INPLACE` (MySQL) to avoid table locks.
- **Rule**: Regularly analyze slow query logs and remove unused indexes.
- **Forbidden**: Indexing low-cardinality columns alone (e.g., `gender`, `status` with < 5 values).
- **Forbidden**: Redundant indexes — `idx(a,b)` already covers `idx(a)` scenarios.
- **RATIONALE**: Indexes are the core lever of database performance, but every additional index slows writes by a bit.

---

## F3b. Transaction Isolation

### F3b.1 Transaction Isolation

- **Rule**: Explicitly set transaction isolation level for each transaction. Do not rely on database defaults.
- **Rule**: Default isolation for OLTP: READ COMMITTED (balances consistency and performance). For financial operations: REPEATABLE READ or SERIALIZABLE.
- **Rule**: Document the chosen isolation level per business operation in code comments.
- **Forbidden**: Using SERIALIZABLE for high-throughput read operations (causes unnecessary contention).
- **RATIONALE**: PostgreSQL defaults to READ COMMITTED, MySQL to REPEATABLE READ. Different defaults cause different behaviors in the same application code.

---

## F4. Migration Management

- **Rule**: All database structure changes must go through versioned migration files. Forbid executing SQL directly against production databases.
- **Rule**: Migration file naming: `V<number>__<description>.sql` (Flyway format) or `<timestamp>_<description>.sql` (custom format).
- **Rule**: Each migration file must include both `up` (forward) and corresponding `down` (rollback).
- **Rule**: Schema changes must avoid table locks (choose the correct method per database):
  - MySQL: `ALGORITHM=INPLACE, LOCK=NONE` (when conditions allow)
  - PostgreSQL: `ALTER TABLE ... ADD COLUMN` without DEFAULT (add column first, then backfill defaults).
- **Forbidden**: Dropping columns in migrations — mark as deprecated first, remove in the next version after confirming zero references.
- **Forbidden**: Changing column types — must follow the pattern: add new column → dual-write transition → migrate data → switch reads → drop old column.
- **RATIONALE**: Migrations are the most dangerous production operations. It's not just "does it run" — it's about online tables, rollback windows, and data consistency.

---

## F5. Query Standards

- **Rule**: All SQL must be parameterized. Forbid string concatenation with user input.
- **Rule**: SELECT must explicitly list column names. Forbid `SELECT *`.
- **Rule**: Queries must have LIMIT (unless the business explicitly requires full results and data volume is controllable).
- **Rule**: Bulk write operations (UPDATE/DELETE) must be batched (≤ 1000 rows per batch) with transaction intervals.
- **Rule**: Transactions must be as short as possible — no external API calls, message sends, or user input waits inside transactions.
- **Rule**: Complex queries must first run `EXPLAIN` / `EXPLAIN ANALYZE` to verify index usage.
- **Forbidden**: Concatenating dynamic SQL strings in application code (use whitelist for dynamic sort fields, query builder for dynamic conditions).
- **RATIONALE**: Query standards aren't about "writing prettier code" — every rule here corresponds to a real production incident.

---

## F6. Security & Permissions

- **Rule**: Application accounts get minimum privileges — separate read and write accounts. Read accounts only get SELECT.
- **Rule**: Forbid using root/superuser accounts for application connections.
- **Rule**: Connections must enforce TLS/SSL.
- **Rule**: Sensitive fields (passwords, tokens, national IDs, phone numbers) must be encrypted at rest.
- **Rule**: Database ports must not be exposed to the public internet. Internal/VPC whitelist access only.
- **RATIONALE**: The database is the attacker's ultimate target. Enough layers of defense is what keeps you safe.

---

## F7. Backup & Recovery

- **Rule**: Automated backup strategy — daily full + continuous incremental/archiving (WAL archiving / binlog).
- **Rule**: Backup files must be stored offsite and encrypted.
- **Rule**: Regular recovery drills are mandatory (at least quarterly) to verify backup usability.
- **Rule**: PITR (Point-in-Time Recovery) must be available — recovering only to the last full backup is not sufficient.
- **RATIONALE**: A database whose backups have never been verified is a database without backups.

---

## F8. Performance

- **Rule**: Connection pool limit ≤ 80% of database `max_connections`, leaving headroom for admin connections.
- **Rule**: Slow query threshold set to 100ms (for OLTP workloads). Alert on exceeding.
- **Rule**: Large tables (>10M rows) must plan a partitioning strategy (range partition by time or business key).
- **Rule**: Historical data must have an archival strategy that doesn't impact online query performance.
- **Forbidden**: Running DDL, bulk data migrations, or creating large indexes during peak hours.
- **RATIONALE**: Database performance issues are "boiling the frog" — unnoticeable at first, then suddenly crashing three times a day once data volume grows.

---

## F8b. Connection Pooling

### F8b.1 Connection Pooling

- **Rule**: Every application service must use connection pooling. Forbid opening a new connection per request.
- **Rule**: Pool size = CPU cores x 2 per service instance (for OLTP). Max pool size <= 80% of database max_connections / number of service instances.
- **Rule**: Connection timeout: acquire <= 30s, idle <= 10min, max lifetime <= 1hour.
- **Rule**: Pool must have health check (validation query on borrow).
- **Forbidden**: Using hardcoded pool sizes without accounting for the number of service instances.
- **RATIONALE**: Connection pooling misconfiguration is the #1 cause of "database is up but application can't connect" incidents.

---

## F9. AI Vibecoding Baseline Constraints (project-agnostic, always active)

### F9.1 Migration Files
- **Rule**: AI generating a new migration must also produce the corresponding rollback migration.
- **Forbidden**: Dropping columns, changing column types, or renaming columns in migrations (unless a complete transition plan exists).
- **Rule**: New migrations must pass `EXPLAIN` review before submission.

### F9.2 SQL Safety
- **Rule**: All AI-written SQL in application code must be parameterized queries.
- **Forbidden**: AI generating string-concatenated SQL code.

### F9.3 Search First
- **Rule**: Before writing SQL/migrations, AI must read existing migration files and schema.
- **Rule**: Before adding a new column, AI must confirm that a column with the same name doesn't already exist in that table.

### F9.4 Context Honesty
- **Rule**: When uncertain about database version, field names, or constraint names, AI must explicitly say "I'm not sure." Forbid inventing.
- **Rule**: AI must understand the target database type before generating SQL (MySQL and PostgreSQL syntax differ).

### F9.5 Irreversible Operations
- **Rule**: AI must not execute any DROP/TRUNCATE statements (unless the user explicitly provides both the target object and the reason).
- **Rule**: AI-proposed DDL must include a migration strategy assessment: online execution or maintenance window? How long is the table locked? What's the rollback plan?

---

## Injection Instructions (for the AI executing this skill)

Each chapter in this file corresponds to a `{{ FIXED_RULES_* }}` placeholder in the template:

| Chapter | Inject Into Placeholder | Template Section |
|---------|------------------------|-------------------|
| F1 Schema Design | `{{ FIXED_RULES_SCHEMA }}` | §1 Schema Design |
| F2 Column Types | `{{ FIXED_RULES_TYPES }}` | §2 Column Types |
| F3 Index Strategy | `{{ FIXED_RULES_INDEX }}` | §3 Index Strategy |
| F3b Transaction Isolation | `{{ FIXED_RULES_TRANSACTION }}` | §3b Transaction Isolation |
| F4 Migration Management | `{{ FIXED_RULES_MIGRATION }}` | §4 Migration Management |
| F5 Query Standards | `{{ FIXED_RULES_QUERY }}` | §5 Query Standards |
| F6 Security & Permissions | `{{ FIXED_RULES_SECURITY }}` | §6 Security & Permissions |
| F7 Backup & Recovery | `{{ FIXED_RULES_BACKUP }}` | §7 Backup & Recovery |
| F8 Performance | `{{ FIXED_RULES_PERFORMANCE }}` | §8 Performance |
| F8b Connection Pooling | `{{ FIXED_RULES_CONNECTION }}` | §8b Connection Pooling |
| F9 AI Constraints | `{{ FIXED_RULES_AI_BASE }}` | §9 AI Behavior Constraints |

**Rendering rules**:
1. Copy each chapter's full body (including RATIONALE) directly into the corresponding placeholder.
2. RATIONALE must be preserved — it lets AI understand intent rather than follow mechanically.
3. Keep the original markdown list structure. Do not rewrite as prose paragraphs.
