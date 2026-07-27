# Feature Decomposition Patterns

Use these patterns as starting points when breaking an app into features. Adapt them to the specific project.

For app-level design references (vision templates, tech stack decision matrix), see `app-planner/assets/app-design-guide.md`.

## Pattern A: CRUD-Based App

Examples: CMS, project management tools, inventory systems.

```
F-001: Infrastructure Setup (no deps)
F-002: User Authentication (deps: F-001)
F-003: Core Entity CRUD (deps: F-002)
F-004: Entity Relationships (deps: F-003)
F-005: Search & Filtering (deps: F-003)
F-006: Notifications (deps: F-003)
F-007: Admin Dashboard (deps: F-004, F-005)
F-008: Analytics & Reporting (deps: F-007)
```

## Pattern B: SaaS Platform

Examples: subscription services, multi-tenant tools, B2B products.

```
F-001: Infrastructure + Multi-tenant Setup (no deps)
F-002: User Auth + Organization Management (deps: F-001)
F-003: Core Product Feature (deps: F-002)
F-004: Subscription & Billing (deps: F-002)
F-005: Usage Tracking & Limits (deps: F-003, F-004)
F-006: Admin Portal (deps: F-005)
F-007: API & Integrations (deps: F-003)
F-008: Analytics Dashboard (deps: F-006, F-007)
```

## Pattern C: Social/Community App

Examples: forums, social networks, community platforms.

```
F-001: Infrastructure Setup (no deps)
F-002: User Auth + Profiles (deps: F-001)
F-003: Content Creation (posts/media) (deps: F-002)
F-004: Social Graph (follow/friend) (deps: F-002)
F-005: Feed Algorithm (deps: F-003, F-004)
F-006: Interactions (likes, comments) (deps: F-003)
F-007: Real-time Messaging (deps: F-004)
F-008: Notifications (deps: F-005, F-006, F-007)
F-009: Discovery & Search (deps: F-005)
```

## Pattern D: E-commerce App

Examples: online stores, marketplaces, booking platforms.

```
F-001: Infrastructure Setup (no deps)
F-002: User Auth (deps: F-001)
F-003: Product Catalog (deps: F-001)
F-004: Shopping Cart (deps: F-002, F-003)
F-005: Checkout & Payment (deps: F-004)
F-006: Order Management (deps: F-005)
F-007: Inventory Management (deps: F-003)
F-008: Reviews & Ratings (deps: F-002, F-003)
F-009: Search & Recommendations (deps: F-003, F-008)
F-010: Admin Dashboard (deps: F-006, F-007)
```

## Decomposition Guidelines

- Every app starts with an infrastructure/setup feature (F-001) that has zero dependencies.
- Authentication almost always comes second unless the app is fully public.
- Group related functionality into single features rather than splitting too finely. A feature should represent a coherent unit of user-facing value.
- If a pattern does not match the app being planned, combine elements from multiple patterns or define a custom decomposition from scratch.
