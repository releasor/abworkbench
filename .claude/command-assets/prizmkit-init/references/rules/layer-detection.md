# Layer Detection — Signal Reference Table

> Load this file in Phase 4.5 to determine which development layers exist in the project.
> A "layer" means a distinct code domain that may benefit from custom dev rules.

## Detection Signals

> **This table is a reference guide, not an exhaustive checklist.** The signals below cover common frameworks and patterns, but the list cannot be complete — new frameworks emerge, projects use unconventional setups, and context matters more than any single string match. In addition to matching against these signals, **apply your own judgment**: if you see files, directories, or dependencies that clearly indicate a development layer (even if not listed below), include it. If a signal matches but context suggests it's misleading (e.g., a dependency present but not actually used as the primary tech), downgrade or ignore it. The goal is to accurately reflect what the project contains, not to mechanically match strings.

| Layer | Signal Source | Detection Rule |
|-------|--------------|----------------|
| **frontend** | `package.json` dependencies | Contains `react`, `vue`, `angular`, `next`, `nuxt`, `svelte`, `solid-js`, `preact`, `remix`, `astro`, `qwik` |
| **frontend** | `package.json` devDependencies | Contains `vite`, `webpack`, `parcel`, `turbo` |
| **frontend** | Directory | `src/components/`, `pages/`, `app/` with `.tsx`/`.jsx`/`.vue` files |
| **backend** | `package.json` dependencies | Contains `express`, `fastify`, `koa`, `hono`, `nest`, `next` (API routes) |
| **backend** | `requirements.txt` / `pyproject.toml` | Contains `fastapi`, `django`, `flask`, `sanic`, `litestar` |
| **backend** | `go.mod` | Contains `gin-gonic`, `echo`, `fiber`, `chi` |
| **backend** | `pom.xml` / `build.gradle` | Contains `spring-boot`, `quarkus`, `micronaut`, `ktor` |
| **backend** | Directory | `routes/`, `controllers/`, `handlers/`, `api/`, `internal/` with server code |
| **database** | `package.json` dependencies | Contains `prisma`, `typeorm`, `sequelize`, `mongoose`, `knex`, `drizzle-orm`, `kysely` |
| **database** | `requirements.txt` / `pyproject.toml` | Contains `sqlalchemy`, `django` (ORM), `pony`, `peewee`, `tortoise-orm` |
| **database** | `go.mod` | Contains `gorm`, `sqlx`, `sqlc`, `ent`, `bun` |
| **database** | Directory | `migrations/`, `prisma/`, `alembic/`, `db/`, `schema/` |
| **database** | Environment | `.env*` contains `DATABASE_URL`, `DB_HOST`, `DB_NAME`, `MONGO_URI` |
| **mobile** | File | `pubspec.yaml` exists (Flutter) |
| **mobile** | `package.json` dependencies | Contains `react-native`, `expo` |
| **mobile** | Directory | Both `ios/*.xcodeproj` + `android/build.gradle` exist simultaneously |

## Mobile Confirmation

When mobile signals are detected but ambiguous (e.g., a monorepo with web + mobile), use `AskUserQuestion`:

> "Mobile platform signals detected (ios/ + android/ directories). Is this project
> a mobile app, or are these directories for another purpose?"
> Options: "Yes, this is a mobile app" / "No, these are for another purpose"

## Output

After detection (signals + your own judgment), assemble `detected_layers` array (e.g., `["frontend", "backend", "database"]`).
Store in memory for Phase 6 config.json writing.
If no layers detected (library/CLI project), array is empty.
