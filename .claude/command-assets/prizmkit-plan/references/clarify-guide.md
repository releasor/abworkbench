# Clarification Phase — Execution Guide

Invoked automatically during `/prizmkit-plan` Phase 0 (specify) when `[NEEDS CLARIFICATION]` markers exist, or during Phase 1 (design) when data model ambiguities arise.

---

## Question Strategy

**Ask one question at a time.** Batching questions produces lower-quality answers.

For each question:
1. Cite the exact location in spec.md (e.g., "§Goals G-1 says..." or "§Scope says...")
2. State what is ambiguous and why it matters for implementation
3. Provide a **recommended answer** with rationale — gives the user a concrete starting point to accept, modify, or reject

**Prioritize by implementation impact** (highest first):
1. Data model (entities, relationships, field types, constraints, naming) — **hardest to change after code is written**
2. Functional scope boundaries
3. UX flow and error handling
4. Non-functional requirements (performance, security)
5. Edge cases and integration points

## Update Discipline

After **each** user answer:
- Immediately update `spec.md` (do not batch at the end)
- Remove the resolved `[NEEDS CLARIFICATION]` marker
- Re-evaluate for new ambiguities exposed by the answer

## No Limits Policy

**There is no cap on rounds or questions.** Keep asking until:
- All `[NEEDS CLARIFICATION]` markers are removed, AND
- No vague or underspecified areas remain, AND
- You are fully confident about the requirements

If the user's answer raises new questions — ask those too. If a previously-resolved item needs revisiting due to new context — go back.

## Early Termination

If the user says "done", "stop", or "enough" — end immediately and output a summary of:
- What was resolved
- What remains unclear (list any open `[NEEDS CLARIFICATION]` items)

## Example Exchange

**Question:**
> §Goals G-1 says "User can upload files" but doesn't specify file types or size limits.
>
> **Recommended:** Accept JPEG, PNG, PDF up to 10MB — covers common use cases without straining storage.
>
> Do you agree, or different constraints?

**User:** "Also allow SVG, make it 25MB"

**Action:** Update spec.md §Goals G-1 → `File upload: JPEG, PNG, PDF, SVG. Max 25MB per file.` Remove marker.

**Follow-up question triggered by answer:**
> SVGs can contain embedded scripts (XSS risk). Should uploaded SVGs be sanitized (strip `<script>` + event handlers), or restricted to trusted users only?
>
> **Recommended:** Sanitize all SVG uploads — allows all users to upload safely.

## Guidelines

- Stay at WHAT/WHY level — no implementation details (HOW) in spec
- If an answer contradicts an existing requirement, surface the conflict and ask which takes precedence
- If the user seems fatigued: "I have N more questions — continue now or later?" — but never silently stop with unresolved ambiguities
