---
description: "PrizmKit progressive context loading protocol"
---

This project uses PrizmKit's progressive loading protocol:
- ON SESSION START: Read `.prizmkit/prizm-docs/root.prizm` (L0 — project map)
- ON RESUME (feature/bugfix directory has session-summary.md): Read session-summary.md first for prior context, then load only L1/L2 for modules mentioned in it
- ON TASK: Read L1 (`.prizmkit/prizm-docs/<module>.prizm`) for relevant modules. If MODULE_INDEX entries have keyword tags (e.g., `[login, jwt, oauth]`), match user's task description against tags to prioritize which modules' L1 to load first. If root.prizm uses MODULE_GROUPS, identify the relevant domain first, then load L1 only for modules in that domain.
- ON FILE EDIT: Read L2 (`.prizmkit/prizm-docs/<module>/<submodule>.prizm`) before modifying
- NEVER load all .prizm docs at once
- Arrow notation (->) in .prizm files indicates load pointers
- .prizm files do not contain CHANGELOG sections/files, UPDATED/date metadata, feature/bug/refactor/task/session/run/pipeline/workflow IDs, branch names, absolute worktree paths, or `.prizmkit/specs` / `.prizmkit/dev-pipeline` artifact paths
- Update stale durable knowledge in place; git history is the change log
