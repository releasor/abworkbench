# Question Bank — Database Interactive Question Bank

> This file is read on demand by SKILL.md in Phase 2. The AI must strictly follow the group order defined in this file, asking **one group at a time (1–3 questions)**, never dumping all questions at once.
> For every question, show the user: question number, question text, options, **recommended choice (marked "Recommended")**, and a one-line description.
> After each user response, immediately record the choice to internal state `answers[Qx] = ...` and proceed to the next group.

---

## Asking Rules

1. **Group order**: G1 → G2 → G3 → G4 → G5 → G6 → G7. Do not skip.
2. **Shortcut commands** (respond immediately when user types these at any point):
   - `recommended` / `default` → skip current group, adopt all recommended options
   - `all recommended` / `one-click` → skip all remaining groups, adopt all recommended options
   - `strict` / `strictest` → adopt the strictest option for the current group
   - `skip` / `don't need this` → mark current group as N/A
   - `custom: xxx` → record user's custom content
3. **Abbreviation recognition**: `A` / `a` / `1` all mean option A.
4. **Follow-up rule**: If the user gives an answer outside the options, first confirm whether to classify as an "other" branch.
5. **Forbidden behaviors**:
   - Must not make choices for the user before they explicitly answer.
   - Must not fabricate user preferences to complete the answer set.
   - Must not output more than 3 questions in a single message.

---

## Group Overview

| Group | Topic | Questions | Count |
|-------|-------|-----------|-------|
| G1 | Database Selection | Q1–Q2 | 2 |
| G2 | Data Modeling | Q3–Q5 | 3 |
| G3 | Migration | Q6 | 1 |
| G4 | Index & Performance | Q7–Q8 | 2 |
| G5 | Security & Compliance | Q9–Q10 | 2 |
| G6 | High Availability & Ops | Q11–Q13 | 3 |
| G7 | AI Constraints | Q14–Q15 | 2 |

Total: 15 questions.

---

## G1 — Database Selection

### Q1. Primary Database
- **Options**:
  - A) PostgreSQL **【Recommended: most feature-complete】**
  - B) MySQL
  - C) MongoDB
  - D) SQLite (development/small projects)
- **Note**: Determines all subsequent column type, index syntax, and migration tool options.
- **Maps to**: `{{ database }}` + `{{ tech_rules }}`

### Q2. Cache Layer Needed?
- **Options**:
  - A) Redis **【Recommended: when caching is needed】**
  - B) Memcached
  - C) No cache layer needed
- **Note**: Determines cache key naming conventions, TTL requirements, and batch operation rules.
- **Maps to**: `{{ cache }}` + `{{ cache_rules }}`

---

## G2 — Data Modeling

### Q3. Primary Key Strategy
- **Options**:
  - A) UUID v7 (time-sortable, 128-bit with dashes) **【Recommended】**
  - B) ULID (lowercase, URL-safe, 26-char, time-sortable)
  - C) Auto-increment BIGINT + UUID mapping for external use
  - D) Direct auto-increment IDs
- **Note**: Choosing D injects the rule "forbid exposing auto-increment IDs to the frontend."
- **Maps to**: `{{ pk_strategy }}` + `{{ schema_rules }}`

### Q4. Soft Delete
- **Options**:
  - A) Use `deleted_at` field **【Recommended】**
  - B) No soft delete needed (data is irrecoverably deleted)
- **Note**: Determines whether audit fields and unique indexes with `deleted_at` rules are needed.
- **Maps to**: `{{ soft_delete }}` + `{{ schema_rules }}`

### Q5. Normalization Level
- **Options**:
  - A) Strict 3NF; denormalization requires comments explaining why **【Recommended】**
  - B) Allow partial denormalization (OLAP/reporting scenarios)
- **Note**: Determines the threshold for data redundancy.
- **Maps to**: `{{ normalization }}` + `{{ schema_rules }}`

---

## G3 — Migration

### Q6. Migration Tool
- **Options**:
  - A) ORM's built-in migration tool **【Recommended: when consistent with ORM】**
  - B) Flyway / golang-migrate / Alembic (standalone migration tool)
  - C) Manually managed SQL files
- **Note**: Determines migration file format, naming conventions, and rollback requirements.
- **Maps to**: `{{ migration_tool }}` + `{{ migration_rules }}`

---

## G4 — Index & Performance

### Q7. Query Complexity
- **Options**:
  - A) OLTP (high-frequency small queries, ≤ 10ms each) **【Recommended: web apps】**
  - B) OLAP (low-frequency large queries, ≥ 100ms each)
  - C) Mixed (has reporting/analytics needs)
- **Note**: Determines slow query thresholds, index strategy strictness, and partitioning rules.
- **Maps to**: `{{ workload_type }}` + `{{ performance_rules }}`

### Q8. Estimated Data Volume (per table)
- **Options**:
  - A) < 1M rows (small scale, no partitioning needed) **【Recommended: early-stage projects】**
  - B) 1M-10M rows (medium scale, recommend reserving partition expansion space)
  - C) > 10M rows (large scale, partitioning strategy is mandatory)
- **Note**: Determines the urgency of partitioning and archival rules.
- **Maps to**: `{{ data_scale }}` + `{{ performance_rules }}`

---

## G5 — Security & Compliance

### Q9. Data Sensitivity Level
- **Options**:
  - A) Contains PII (Personally Identifiable Information), encryption at rest required **【Recommended: privacy-first, safest default】**
  - B) Business data only, no special encryption needed
- **Note**: Choosing A auto-injects "encrypt sensitive fields", "log desensitization", and other strict rules.
- **Maps to**: `{{ data_sensitivity }}` + `{{ security_rules }}`

### Q10. Audit Requirements
- **Options**:
  - A) Need audit tables + operation logs **【Recommended: enterprise-grade projects】**
  - B) Need CDC (Change Data Capture, for sync/analytics)
  - C) Both audit tables + CDC (for comprehensive compliance + real-time sync)
  - D) No audit needed
- **Note**: **Multi-select allowed** — audit tables (A) and CDC (B) serve different purposes and can be used together. Determines audit table structure and trigger rules.
- **Maps to**: `{{ audit }}` + `{{ audit_rules }}`

---

## G6 — High Availability & Operations

### Q11. Deployment Method
- **Options**:
  - A) Cloud managed service (RDS / Cloud SQL / Supabase) **【Recommended】**
  - B) Self-hosted
  - C) Development environment Docker Compose
- **Note**: Determines backup strategy and high availability rules.
- **Maps to**: `{{ deployment }}` + `{{ ops_rules }}`

### Q12. Backup Strategy
- **Options**:
  - A) Daily full + continuous incremental (PITR available) **【Recommended: production environments】**
  - B) Daily full backup only
  - C) No automatic backup needed (development environment)
- **Note**: Determines backup frequency, retention period, and recovery drill requirements.
- **Maps to**: `{{ backup }}` + `{{ ops_rules }}`

### Q13. High Availability Requirements
- **Options**:
  - A) Primary-replica replication / read-write split **【Recommended: production environments】**
  - B) Single instance is sufficient
  - C) Multi-master cluster
- **Note**: Determines connection pool configuration and failover strategy.
- **Maps to**: `{{ ha }}` + `{{ ops_rules }}`

---

## G7 — AI Constraints

### Q14. AI Permission to Modify Database Structure
- **Options**:
  - A) AI may only generate migration files; human reviews before execution **【Recommended】**
  - B) AI may not generate any DDL (fully human-managed)
  - C) AI may operate freely (development environment)
- **Maps to**: `{{ ai_ddl_rule }}`

### Q15. AI Safety Constraints
- **Options**:
  - A) AI must not execute DROP/TRUNCATE/drop column/change type **【Recommended】**
  - B) No restriction, but explicit confirmation required
- **Maps to**: `{{ ai_safety_rule }}`
