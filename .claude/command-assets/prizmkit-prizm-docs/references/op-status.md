# Operation: Status — Detailed Steps

Check freshness of all .prizm docs.

PRECONDITION: .prizmkit/prizm-docs/ exists with root.prizm.

STEPS:
1. Get last git modification time of root.prizm via `git log -1 --format="%ai" -- .prizmkit/prizm-docs/root.prizm`.
2. Count commits since that time via `git log --since="<timestamp>" --oneline | wc -l`.
3. For each L1/L2 doc, compare git modification time of the .prizm file (`git log -1 --format="%ai" -- <prizm-file>`) against latest git modification of source files in that module (`git log -1 --format="%ai" -- <module-path>/`).
4. Classify each doc as: FRESH (prizm file updated after latest source change), STALE (source changed more recently than prizm file), MISSING (module exists but no .prizm doc).
5. Flag any docs exceeding size limits.

OUTPUT: Freshness report table with columns: DOC_PATH | LEVEL | STATUS | PRIZM_LAST_MOD | SOURCE_LAST_MOD.
