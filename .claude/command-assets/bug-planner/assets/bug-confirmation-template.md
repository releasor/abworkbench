# Bug Confirmation Templates

## Per-Bug Confirmation Template

Present this after extracting and clarifying each bug:

```
┌─ Bug Confirmation: B-NNN ─────────────────────────────
│ Title:       <auto-suggested title>
│ Description: <expected vs actual behavior>
│ Severity:    <auto-classified> | Verification: <type>
│
│ Reproduction: <steps if available, or "not provided">
│ Affected:     <module/feature or "unknown">
│
│ Acceptance Criteria (fix verified when):
│   1. <criterion — specific enough for automated pipeline to verify>
│   2. <criterion>
│
│ Open Questions:
│   - <any unclear points, or "None">
└────────────────────────────────────────────────────────
```

Then ask three confirmation questions:
1. "描述是否准确？是否需要修改？" / "Is the description accurate? Any corrections?"
2. "是否需要补充更多细节？（复现步骤、环境信息、相关代码位置等）" / "Need to add more details? (reproduction steps, environment, related code locations, etc.)"
3. "验证条件是否具体到 pipeline 可以自主判断修复成功？" / "Are the acceptance criteria specific enough that the pipeline can autonomously verify the fix?"

Only finalize the bug entry after user confirms all three points.

## Completeness Review Template

Display during Phase 4 pre-generation review:

```
┌─ Completeness Review ─────────────────────────────────────────────────
│ Bug    │ Description │ Criteria   │ Reproducible │ Notes
│ B-001  │ ✓ Clear     │ ✓ Specific │ ✓ Yes        │ —
│ B-002  │ ⚠ Vague     │ ⚠ Subjective│ ✓ Yes       │ "encoding works" → needs specific test case
│ B-003  │ ✓ Clear     │ ⚠ No metric│ ⚠ No steps  │ needs perf threshold + reproduction steps
└────────────────────────────────────────────────────────────────────────
```
