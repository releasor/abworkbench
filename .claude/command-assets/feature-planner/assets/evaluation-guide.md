# feature planner Evaluation Guide

This guide is for maintainers who evaluate and iterate on the `feature-planner` skill quality.

## Evaluation & Quality Gates (Optional but Recommended)

After multiple planning cycles or before committing refined skill logic, run standardized evaluation.

### One-Command Evaluation

Requires npm setup:

```powershell
function Invoke-PrizmPython {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  $python = Get-Command python -ErrorAction SilentlyContinue
  if ($python) {
    & $python.Source -c 'import sys; raise SystemExit(0 if sys.version_info[0] == 3 else 1)' *> $null
    if ($LASTEXITCODE -eq 0) {
      & $python.Source @Arguments
      return
    }
  }
  $py = Get-Command py -ErrorAction SilentlyContinue
  if ($py) {
    & $py.Source -3 -c 'import sys; raise SystemExit(0 if sys.version_info[0] == 3 else 1)' *> $null
    if ($LASTEXITCODE -eq 0) {
      & $py.Source -3 @Arguments
      return
    }
  }
  throw "Python 3 is required. Install Python and ensure python or py is in PATH."
}
npm run skill:review -- `
  --workspace .prizmkit/skill-evals/feature-planner-workspace `
  --iteration iteration-N `
  --skill-name feature-planner `
  --skill-path ${SKILL_DIR} `
  --runs 3 `
  --grader-cmd "Invoke-PrizmPython ${SKILL_DIR}/scripts/validate-and-generate.py grade --workspace {workspace} --iteration {iteration}"
```

Produces:
- `benchmark.json` — quantitative metrics (pass rate, feature quality, time)
- `benchmark.md` — human-readable summary
- `review.html` — interactive evaluation viewer

### Metrics Tracked

| Metric | Computation | Target | Interpretation |
|--------|-------------|--------|-----------------|
| `plan_validity` | % runs with validation pass | >95% | Higher = more robust planning |
| `avg_features_per_run` | avg feature count | ±20% consistency | Should be stable across runs |
| `avg_acceptance_criteria` | AC count per feature | 4-6 | Target sweet spot for test coverage |
| `dependency_complexity` | max DAG depth, cycle count | depth < 5 | Manageable dependency graph |
| `description_quality` | word count, keyword coverage | min 20 words | Sufficient AC detail |
| `latency_sec` | wall-clock execution time | <120s per run | UX acceptable |

### When to Run Evaluation

- After major SKILL.md revisions
- Before releasing new skill updates
- Quarterly quality assurance
- Post-optimization to measure improvement
