# Operation: Rebuild — Detailed Steps

Regenerate docs for a specific module from scratch. Requires a module path argument.

PRECONDITION: .prizmkit/prizm-docs/ exists. Module path is valid.

STEPS:
1. Delete existing L1 and all L2 docs for the specified module.
2. Re-scan the module directory for files, interfaces, dependencies, subdirectories.
3. Generate fresh L1 doc with full module analysis.
4. Generate L2 docs for all sub-modules immediately (unlike init, rebuild generates L2 right away to capture current state).
5. Update MODULE_INDEX (or MODULE_GROUPS) in root.prizm with new file counts and pointers. Re-evaluate grouping: if total module count > 15 and currently using MODULE_INDEX, convert to MODULE_GROUPS. Regenerate keyword tags for rebuilt modules. **Preserve** any `PROJECT_BRIEF:` line in root.prizm.
6. Validate regenerated docs against size limits and format rules.

OUTPUT: Regenerated doc summary with before/after comparison.
