# Tech Stack Detection — Field Catalog

Adaptive field list — only include fields that apply to the project being scanned.

- **Language & Runtime**: e.g. TypeScript + Node.js 20, Python 3.11, Go 1.22
- **Frontend framework** (if applicable): React, Vue.js, Angular, Next.js, Svelte, etc.
- **Frontend styling** (if applicable): Tailwind CSS, SCSS, Styled Components, Material UI, etc.
- **Backend framework** (if applicable): Express.js, FastAPI, Django, NestJS, Gin, etc.
- **Database** (if applicable): PostgreSQL, MySQL, MongoDB, Redis, SQLite — detected from deps or `docker-compose.yml`
- **ORM** (if applicable): Prisma, Drizzle, TypeORM, SQLAlchemy, Mongoose, etc.
- **Bundler** (if applicable): Vite, Webpack, esbuild, Rollup, Turborepo
- **Testing**: Vitest, Jest, pytest, Go test, etc.
- **Project type** (inferred): `frontend` | `backend` | `fullstack` | `library` | `cli` | `monorepo`
