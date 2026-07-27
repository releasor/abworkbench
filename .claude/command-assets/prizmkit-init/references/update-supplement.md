# Update Supplement — Post-Merge Gap-Fill Procedure

Runs after tech stack merge in Update mode:

1. **Module scan**: Re-scan project directories using the same TWO-TIER model from Step 1. Compare discovered modules against existing MODULE_INDEX in root.prizm.
2. **Missing L1 check**: For any discovered module with no corresponding L1 `.prizm` doc → create L1 immediately and add to MODULE_INDEX.
3. **Missing L2 check**: For any module/sub-module that has source files with meaningful logic but no L2 `.prizm` doc → create L2 using the L2 GENERATION TEMPLATE. Judgment call: skip trivial wrapper directories or single-config modules.
4. **Stale L1 check**: For existing L1 docs, verify FILES count and KEY_FILES are still accurate. Update if source directory contents have changed significantly.
5. **Report**: Include in the Update report: modules added, L1 docs created, L2 docs created, stale docs refreshed.
