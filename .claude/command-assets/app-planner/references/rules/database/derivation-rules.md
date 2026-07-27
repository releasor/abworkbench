# Derivation Rules — Database Auto-Derivation Rule Mapping

> This file defines the mapping "Phase 2 answers → rule blocks auto-injected into database-rules.md". The AI reads this file in Phase 3 — **do not ask the user again**.

---

## Phase 2 Answer Direct-Fill Table

| Template Placeholder | Source | Example Fill |
|---------------------|--------|-------------|
| `{{ project_name }}` | Phase 0 auto-read | `my-project-db` |
| `{{ generated_at }}` | Phase 4, AI writes current date | `2026-05-24` |
| `{{ database }}` | Q1 answer | `PostgreSQL` |
| `{{ cache }}` | Q2 answer | `Redis` |
| `{{ pk_strategy }}` | Q3 answer | `UUID v7 / ULID / Auto-increment BIGINT + UUID mapping / Direct auto-increment` |
| `{{ soft_delete }}` | Q4 answer | `Using deleted_at` |
| `{{ normalization }}` | Q5 answer | `Strict 3NF` |
| `{{ migration_tool }}` | Q6 answer | `ORM built-in` |
| `{{ workload_type }}` | Q7 answer | `OLTP` |
| `{{ data_scale }}` | Q8 answer | `< 1M rows` |
| `{{ data_sensitivity }}` | Q9 answer | `Contains PII` |
| `{{ audit }}` | Q10 answer | `Audit tables needed / CDC needed / Both / None` |
| `{{ deployment }}` | Q11 answer | `RDS` |
| `{{ backup }}` | Q12 answer | `Daily full + continuous incremental` |
| `{{ ha }}` | Q13 answer | `Primary-replica replication` |
| `{{ ai_ddl_permission }}` | Q14 answer | `Migration only / Fully forbid / Free operation` |
| `{{ ai_safety_constraint }}` | Q15 answer | `Forbid destructive ops / No restriction but confirm` |

---

## Trigger Map

| Trigger (Phase 2 Answer) | Inject Rule Block ID | Inject Into Placeholder |
|--------------------------|---------------------|------------------------|
| Q1 = PostgreSQL | `D-PG-01` | `{{ tech_rules }}` |
| Q1 = MySQL | `D-MYSQL-01` | `{{ tech_rules }}` |
| Q1 = MongoDB | `D-MONGO-01` | `{{ tech_rules }}` |
| Q1 = SQLite | `D-SQLITE-01` | `{{ tech_rules }}` |
| Q2 = Redis | `D-REDIS-BACKEND-01` | `{{ cache_rules }}` |
| Q2 = Memcached | `D-MEMCACHED-DB-01` | `{{ cache_rules }}` |
| Q3 = UUID v7 | `D-UUID-01` | `{{ schema_rules }}` |
| Q3 = ULID | `D-ULID-01` | `{{ schema_rules }}` |
| Q3 = Auto-increment + UUID mapping | `D-AUTOINC-01` | `{{ schema_rules }}` |
| Q3 = Direct auto-increment | `D-DIRECT-AUTOINC-01` | `{{ schema_rules }}` |
| Q4 = deleted_at | `D-SOFTDELETE-01` | `{{ schema_rules }}` |
| Q5 = Strict 3NF | `D-3NF-01` | `{{ schema_rules }}` |
| Q5 = Allow partial denormalization | `D-PARTIAL-DENORM-01` | `{{ schema_rules }}` |
| Q6 = ORM built-in | `D-ORM-MIGRATE-01` | `{{ migration_rules }}` |
| Q6 = Standalone tool | `D-FLYWAY-01` | `{{ migration_rules }}` |
| Q6 = Manual SQL files | `D-MANUAL-MIGRATE-01` | `{{ migration_rules }}` |
| Q7 = OLTP | `D-OLTP-01` | `{{ performance_rules }}` |
| Q7 = OLAP | `D-OLAP-01` | `{{ performance_rules }}` |
| Q7 = Mixed | `D-MIXED-01` | `{{ performance_rules }}` |
| Q8 = > 10M rows | `D-PARTITION-01` | `{{ performance_rules }}` |
| Q8 = 1M-10M rows | `D-MEDIUM-SCALE-01` | `{{ performance_rules }}` |
| Q9 = Contains PII | `D-PII-01` | `{{ security_rules }}` |
| Q10 = Audit tables | `D-AUDIT-01` | `{{ audit_rules }}` |
| Q10 = CDC | `D-CDC-01` | `{{ audit_rules }}` |
| Q10 = Both audit tables + CDC | `D-AUDIT-01` + `D-CDC-01` | `{{ audit_rules }}` |
| Q11 = Cloud managed | `D-CLOUD-01` | `{{ ops_rules }}` |
| Q11 = Self-hosted | `D-SELFHOST-01` | `{{ ops_rules }}` |
| Q11 = Development environment Docker Compose | `D-DOCKER-DEV-01` | `{{ ops_rules }}` |
| Q12 = Daily full + continuous incremental | `D-PITR-01` | `{{ ops_rules }}` |
| Q12 = Daily full backup only | `D-FULL-BACKUP-01` | `{{ ops_rules }}` |
| Q12 = No automatic backup needed | `D-NO-BACKUP-01` | `{{ ops_rules }}` |
| Q13 = Primary-replica | `D-REPLICA-01` | `{{ ops_rules }}` |
| Q13 = Single instance is sufficient | `D-SINGLE-01` | `{{ ops_rules }}` |
| Q13 = Multi-master cluster | `D-MULTIMASTER-01` | `{{ ops_rules }}` |
| Q14 = Migration only | `D-AI-DDL-AUDIT-01` | `{{ ai_ddl_rule }}` |
| Q14 = Fully forbid | `D-AI-DDL-FORBID-01` | `{{ ai_ddl_rule }}` |
| Q14 = Free operation | `D-AI-DDL-FREE-01` | `{{ ai_ddl_rule }}` |
| Q15 = Forbid destructive | `D-AI-SAFETY-STRICT-01` | `{{ ai_safety_rule }}` |
| Q15 = No restriction but confirm | `D-AI-SAFETY-LOOSE-01` | `{{ ai_safety_rule }}` |

> **Multi-select note**: Q10 (Audit Requirements) supports multi-select. When user selects both A (Audit tables) and B (CDC), the trigger `Q10 = Both audit tables + CDC` fires, injecting both `D-AUDIT-01` and `D-CDC-01` into `{{ audit_rules }}`.

---

## Rule Block Definitions

### D-PG-01
**Trigger**: Q1 = PostgreSQL | **Inject into**: `{{ tech_rules }}`

- Charset unified to `UTF8`. Collation use `en_US.UTF-8` or `C`.
- Use `TIMESTAMPTZ` for all timestamps. Do not use `TIMESTAMP`.
- JSON use `JSONB`, not `JSON`. Create GIN indexes for JSON field queries.
- Array types use `TEXT[]` / `INT[]`. Not comma-separated strings.
- Network addresses use `INET`. UUIDs use `UUID` type.
- Auto-increment primary keys use `BIGINT GENERATED ALWAYS AS IDENTITY`.

### D-MYSQL-01
**Trigger**: Q1 = MySQL | **Inject into**: `{{ tech_rules }}`

- Charset unified to `utf8mb4`. Collation use `utf8mb4_unicode_ci`.
- Engine defaults to `InnoDB` (supports transactions, row locks, foreign keys).
- Timestamps use `DATETIME(3)` (millisecond precision). Don't use `TIMESTAMP` (2038 problem).
- JSON use `JSON` type (MySQL 8.0+). Don't store JSON as TEXT.
- Auto-increment primary keys use `BIGINT AUTO_INCREMENT`.

### D-MONGO-01
**Trigger**: Q1 = MongoDB | **Inject into**: `{{ tech_rules }}`

- Document design prefers embedding over referencing (Embed over Reference), unless data needs independent querying.
- Every document must contain `_id` (auto-generated by MongoDB) and `createdAt`/`updatedAt`.
- Schema enforced via Mongoose Schema or JSON Schema Validation.
- Forbid full collection scan queries — every query must be index-covered.

### D-SQLITE-01
**Trigger**: Q1 = SQLite | **Inject into**: `{{ tech_rules }}`

- SQLite column type notes: UUIDs stored as TEXT, no JSONB type (use TEXT with JSON functions).
- Enable WAL mode for concurrent reads. File-level write lock limits concurrent writes.
- Schedule periodic VACUUM for reclaiming space from deleted rows.
- Use `sqlite3` CLI or `.dump` for backup.

### D-REDIS-BACKEND-01
**Trigger**: Q2 = Redis | **Inject into**: `{{ cache_rules }}`

- Key naming: `<service>:<resource>:<id>` (`user:session:abc123`).
- All keys must have TTL (`EXPIRE`). Forbid never-expiring keys.
- Batch operations use Pipeline or Lua scripts to avoid N network round trips.
- Forbid `KEYS *` in production. Use `SCAN` cursor traversal.

> **Note**: Key naming aligned with backend-rules D-REDIS-01 convention for cross-document consistency. Database-rules addresses cache-as-a-data-layer (key naming, TTL, batch operations); for cache update/invalidation patterns, refer to backend-rules.md.

### D-MEMCACHED-DB-01
**Trigger**: Q2 = Memcached | **Inject into**: `{{ cache_rules }}`

- Memcached used as simple KV cache. Max value size 1MB. Key max 250 bytes.
- All keys must have TTL (EXPIRE). Default 300s. Forbid no-expiration keys.
- No persistence — data lost on restart. Only cache data that can be regenerated from the database.
- Client sharding across multiple memcached instances via consistent hashing.

### D-UUID-01
**Trigger**: Q3 = UUID v7 | **Inject into**: `{{ schema_rules }}`

- Primary keys use UUID v7 (time-sortable, 128-bit, globally unique, dashed format).
- UUIDs use native database types (PostgreSQL `UUID`, MySQL `CHAR(36)`).
- API layer exposes UUID v7. Internal JOINs use UUID (modern database UUID JOIN performance is close to INT).

### D-ULID-01
**Trigger**: Q3 = ULID | **Inject into**: `{{ schema_rules }}`

- Primary keys use ULID (26-character Crockford base32). URL-safe, lowercase, time-sortable.
- Database column type: CHAR(26). Forbid using ULID as VARCHAR (performance penalty).
- ULID generation: use application-side library (not database function).
- API layer exposes ULID directly.

### D-AUTOINC-01
**Trigger**: Q3 = Auto-increment + UUID mapping | **Inject into**: `{{ schema_rules }}`

- Primary keys use `BIGINT AUTO_INCREMENT`. Do not expose to API.
- API layer uses UUID (ID mapping in service layer or an additional UUID column).
- Strictly forbid exposing auto-increment IDs in URLs or responses.

### D-DIRECT-AUTOINC-01
**Trigger**: Q3 = Direct auto-increment | **Inject into**: `{{ schema_rules }}`

- Direct auto-increment IDs for internal use only.
- Forbid exposing auto-increment IDs in URLs, API responses, or any client-facing layer.
- Use UUIDs or opaque tokens for all external references.
- Auto-increment IDs must be BIGINT (never INT for production tables expected to grow).

### D-SOFTDELETE-01
**Trigger**: Q4 = deleted_at | **Inject into**: `{{ schema_rules }}`

- Every table requiring soft delete adds `deleted_at TIMESTAMPTZ DEFAULT NULL`.
- All queries default to filtering `WHERE deleted_at IS NULL`.
- Unique indexes must include `deleted_at` (otherwise re-inserting the same unique key after deletion fails).
- Periodically archive soft-deleted data older than N days (N based on business agreement).

### D-3NF-01
**Trigger**: Q5 = Strict 3NF | **Inject into**: `{{ schema_rules }}`

- All tables must satisfy 3NF: non-key columns depend directly on the primary key, not on other non-key columns.
- Denormalization must simultaneously satisfy: proven by load testing + documented reason in schema comments + documented consistency maintenance plan.

### D-PARTIAL-DENORM-01
**Trigger**: Q5 = Allow partial denormalization | **Inject into**: `{{ schema_rules }}`

- Partial denormalization is permitted for OLAP, reporting, and performance-critical read paths.
- Each denormalized field must: (a) be documented in the schema comment with 'DENORM:' prefix and the source table/column, (b) have a defined consistency maintenance strategy (application-level update, materialized view, periodic reconciliation), (c) be listed in a project-level denormalization-registry.md file.
- Forbid denormalization on write-heavy OLTP paths.

### D-ORM-MIGRATE-01
**Trigger**: Q6 = ORM built-in | **Inject into**: `{{ migration_rules }}`

- Migrations managed by ORM's built-in tool.
- Always generate via ORM CLI commands; never hand-edit auto-generated migration files.
- Version-control all migration files.
- Test migrations on a staging database before deployment.

### D-FLYWAY-01
**Trigger**: Q6 = Standalone tool | **Inject into**: `{{ migration_rules }}`

- Use Flyway (Java/Go) or Alembic (Python) as a standalone migration tool.
- Migration file naming follows tool conventions. Each migration accompanied by a rollback file.
- CI validates: migration file numbers are non-duplicate, non-regressing, previously executed migrations are not modified.

### D-MANUAL-MIGRATE-01
**Trigger**: Q6 = Manual SQL files | **Inject into**: `{{ migration_rules }}`

- Migration files follow naming convention: `V{YYYYMMDD}{HHmm}__{description}.sql` (forward) paired with `U{YYYYMMDD}{HHmm}__{description}.sql` (rollback).
- Each migration must have a matching rollback file.
- SQL review checklist: all statements idempotent where possible, no data loss in forward migration, rollback restores exact prior state.

### D-OLTP-01
**Trigger**: Q7 = OLTP | **Inject into**: `{{ performance_rules }}`

- Slow query threshold set to 100ms.
- Every query must be index-covered (EXPLAIN output shows no full table scan / full index scan).
- Long transaction monitoring: transactions exceeding 5s trigger alerts.
- Connection pool config: `pool_size = CPU cores × 2`. Max wait time ≤ 30s.

### D-OLAP-01
**Trigger**: Q7 = OLAP | **Inject into**: `{{ performance_rules }}`

- Slow query threshold relaxed to 500ms.
- Pre-aggregation tables / materialized views used for accelerating large queries.
- Batch ETL executed during low-traffic hours (2–6 AM).
- Forbid running DDL during OLAP query execution.

### D-MIXED-01
**Trigger**: Q7 = Mixed | **Inject into**: `{{ performance_rules }}`

- Dual slow query thresholds: OLTP queries <= 100ms, OLAP queries <= 500ms.
- OLAP queries must use read replicas. Forbid running OLAP queries against the primary instance.
- Pre-aggregation via materialized views for common reporting queries. Refresh during low-traffic hours (2-6 AM).
- Forbid running DDL during OLAP query execution windows.

### D-PARTITION-01
**Trigger**: Q8 = > 10M rows | **Inject into**: `{{ performance_rules }}`

- Large tables partitioned by time range (monthly or quarterly). Indexes per partition.
- New data written to the latest partition. Queries should include the partition key when possible.
- Expired partitions are auto-detached + archived without affecting online service.

### D-MEDIUM-SCALE-01
**Trigger**: Q8 = 1M-10M rows | **Inject into**: `{{ performance_rules }}`

- Plan partitioning strategy now even if not immediately needed. Reserve partition key columns.
- Monitor table growth monthly. Trigger partition implementation at 5M rows.
- Index maintenance: monthly reindex for fragmented indexes. Monitor index hit rates.
- Archival strategy: identify cold data (> 90 days untouched) and plan archival path.

### D-PII-01
**Trigger**: Q9 = Contains PII | **Inject into**: `{{ security_rules }}`

- Sensitive fields (password hashes, national IDs, bank card numbers, phone numbers, email) must be encrypted at rest.
- Passwords use bcrypt/argon2 hashing. Irreversible info uses AES-256-GCM encryption.
- Database logs / slow query logs are auto-desensitized.
- Database backup files must be encrypted at rest.
- GDPR "right to be forgotten": user data deletion must be true deletion (or irreversible anonymization), not soft delete.

### D-AUDIT-01
**Trigger**: Q10 = Audit tables | **Inject into**: `{{ audit_rules }}`

- Every audited table gets a corresponding `<table>_audit` table recording all INSERT/UPDATE/DELETE.
- Audit table fields: `audit_id`, `operation` (I/U/D), `changed_by`, `changed_at`, `old_values`(JSONB), `new_values`(JSONB).
- Audit tables populated via triggers. Application code does not write directly to audit tables.
- Audit tables are partitioned and periodically archived.

### D-CDC-01
**Trigger**: Q10 = CDC | **Inject into**: `{{ audit_rules }}`

- Use Debezium / Maxwell / PostgreSQL logical replication for CDC.
- CDC events pushed to Kafka/message queue. Downstream consumers handle (sync to ES, data warehouse, cache invalidation).
- CDC connectors must have dead letter queues configured. Failure must not obstruct primary database operation.

### D-CLOUD-01
**Trigger**: Q11 = Cloud managed | **Inject into**: `{{ ops_rules }}`

- Automated backup enabled (default: retain 7+ days). Multi-AZ deployment.
- Security group: only whitelisted IPs can access the database port.
- Connections enforce SSL/TLS.
- Upgrade windows set during low-traffic periods.

### D-SELFHOST-01
**Trigger**: Q11 = Self-hosted | **Inject into**: `{{ ops_rules }}`

- Database port not exposed to the public internet.
- Monitoring must be set up: connections, slow queries, disk usage, replication lag.
- Backup scripts run independently of application servers.
- Regular recovery drills (at least quarterly).

### D-DOCKER-DEV-01
**Trigger**: Q11 = Development environment Docker Compose | **Inject into**: `{{ ops_rules }}`

- Docker Compose for local development only. Production deployment handled separately.
- Database data persisted via Docker volumes. Forbid losing data on container restart.
- docker-compose.yml committed to repository. Includes database service + cache service definitions.
- Health checks configured for all services. Startup order managed via depends_on + healthcheck conditions.

### D-PITR-01
**Trigger**: Q12 = Daily full + continuous incremental | **Inject into**: `{{ ops_rules }}`

- PostgreSQL: enable WAL archiving + `pgBackRest` / `WAL-G`.
- MySQL: enable binlog + `XtraBackup` / `mysqlbackup`.
- PITR Recovery Time Objective (RTO) ≤ 1 hour. Recovery Point Objective (RPO) ≤ 5 minutes.
- Backups retained for 30 days, stored offsite.

### D-FULL-BACKUP-01
**Trigger**: Q12 = Daily full backup only | **Inject into**: `{{ ops_rules }}`

- Daily full backup via pg_dump/mysqldump/mongodump.
- Backups retained for 7 days locally + 30 days offsite.
- Warning: without continuous incremental/WAL archiving, PITR is not available. RPO = up to 24 hours.
- Recovery drill: monthly restore test from latest backup.

### D-NO-BACKUP-01
**Trigger**: Q12 = No automatic backup needed | **Inject into**: `{{ ops_rules }}`

- No automatic backup configured. Suitable for development environments only.
- Warning: production data without backups will be permanently lost on failure.
- Recommend configuring at minimum daily backups before any production deployment.

### D-REPLICA-01
**Trigger**: Q13 = Primary-replica | **Inject into**: `{{ ops_rules }}`

- Read-write split: writes go to primary, reads go to replicas. Application code must explicitly distinguish read/write data sources.
- Replication lag monitoring: alert when exceeding 5s.
- Failover drills at least quarterly.
- Connection pool config: primary pool small (fewer writes), replica pool large (more reads).

### D-SINGLE-01
**Trigger**: Q13 = Single instance is sufficient | **Inject into**: `{{ ops_rules }}`

- Single database instance. No replication or failover.
- Acceptable downtime window: defined by business (default: off-hours maintenance).
- Warning: single point of failure. Instance failure = full service outage until restored from backup.
- Connection pool sized for one instance. No read/write split needed.

### D-MULTIMASTER-01
**Trigger**: Q13 = Multi-master cluster | **Inject into**: `{{ ops_rules }}`

- Multi-master replication. All nodes accept writes. Conflict resolution strategy must be explicitly chosen (last-write-wins / application-level merge / CRDT).
- Auto-increment IDs must use offset-step allocation to avoid collisions across masters.
- Application must handle replication lag (eventual consistency). Read-after-write may not see latest data.
- Connection pool: separate pool per master. Load-balanced writes across all masters.

### D-AI-DDL-AUDIT-01
**Trigger**: Q14 = Migration only | **Inject into**: `{{ ai_ddl_rule }}`

- AI may generate migration files but must not execute them.
- Each AI-generated migration must include: forward SQL + rollback SQL + EXPLAIN output + lock table analysis.
- Migration files must be human-reviewed before execution.

### D-AI-DDL-FORBID-01
**Trigger**: Q14 = Fully forbid | **Inject into**: `{{ ai_ddl_rule }}`

- AI must not generate any DDL statements.
- AI may only provide structural optimization suggestions (no concrete SQL generated).
- All database structure changes are fully human-managed.

### D-AI-DDL-FREE-01
**Trigger**: Q14 = Free operation | **Inject into**: `{{ ai_ddl_rule }}`

- AI may freely generate and execute DDL in development environments.
- All DDL changes must still be version-controlled in migration files.
- Warning: free DDL operation is suitable for development only. Restrict before production deployment.

### D-AI-SAFETY-STRICT-01
**Trigger**: Q15 = Forbid destructive | **Inject into**: `{{ ai_safety_rule }}`

- AI must not generate DROP TABLE, DROP COLUMN, TRUNCATE, or ALTER COLUMN TYPE statements.
- AI-proposed DDL must first assess: lock table duration? Impact on online service? Rollback plan?
- Any operation modifying existing structure must first pass human review.

### D-AI-SAFETY-LOOSE-01
**Trigger**: Q15 = No restriction but confirm | **Inject into**: `{{ ai_safety_rule }}`

- AI may propose DDL changes (CREATE, ALTER, DROP) but must present the exact SQL and ask for explicit user confirmation before execution.
- No automatic DDL execution.
