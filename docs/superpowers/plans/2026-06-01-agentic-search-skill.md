# Agentic Search Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated `brain:agentic-search` skill that teaches Codex agents general search discipline and entity/person/paper/project disambiguation without moving search policy into `llm_router` or `codex-compatible`.

**Architecture:** This is a skill-text and routing change inside the existing `brain` plugin. `agentic-search` owns source judgment and entity disambiguation; `using-ansatz-brain` routes search-like tasks to it; `codex-compatible` and `think-before-you-calculate` only document the boundary.

**Tech Stack:** CyberBrain Codex/Claude plugin layout, Markdown `SKILL.md` files, repository text checks with `rg`, optional existing plugin coherence audit.

---

## File Structure Mapping

| Purpose | File | Action |
|---|---|---|
| New search discipline skill | `plugins/brain/skills/agentic-search/SKILL.md` | Create |
| Brain controller routing | `plugins/brain/skills/using-ansatz-brain/SKILL.md` | Modify |
| Codex platform boundary note | `plugins/brain/skills/codex-compatible/SKILL.md` | Modify |
| Calculation/search boundary note | `plugins/brain/skills/think-before-you-calculate/SKILL.md` | Modify |
| Public plugin documentation | `README.md` | Modify |
| State evidence | `.state-machine/codex-main.md` | Optional modify if execution policy requires state tracking |

---

## Task 1: Create `brain:agentic-search`

**Files:**
- Create: `plugins/brain/skills/agentic-search/SKILL.md`

- [ ] **Step 1: Create the skill directory**

Run:

```bash
mkdir -p plugins/brain/skills/agentic-search
```

Expected: command exits 0 and `plugins/brain/skills/agentic-search/` exists.

- [ ] **Step 2: Create `SKILL.md` with complete skill content**

Create `plugins/brain/skills/agentic-search/SKILL.md` with this exact content:

```markdown
---
name: agentic-search
description: "Use when a task involves web search, current information, source verification, citations, or entity/person/paper/project disambiguation."
---

# Agentic Search

Use this skill when search results can become evidence for an answer. It governs
agent behavior around web search, source authority, current information, and
entity disambiguation. It does not implement a search backend, RAG system, or
provider-specific router behavior.

## Core Principle

Search results are leads, not conclusions. Convert the user's request into
checkable claims, inspect source authority, disambiguate entities, and downgrade
the answer when evidence is weak or conflicting.

## Trigger

Use this skill when the task involves any of these:

- web search, browsing, looking up, checking latest information, or verifying a
  current fact;
- citations, source attribution, quotes, or direct source comparison;
- identifying a person, paper, project, repository, organization, product,
  standard, regulation, or dataset;
- disputed search output or user-provided ground truth;
- broad research where external sources determine the answer.

If the task is computational search, parameter search, benchmark search, or
optimization search, use `brain:think-before-you-calculate` instead. If both
external source judgment and computation are involved, use both skills and keep
their boundaries separate.

## Workflow

### 1. Define The Search Object

Identify what is being searched before running or interpreting search:

```text
Object Type: fact | current status | person | paper | project | repository | organization | product | standard | broad topic
Target Object:
Known Discriminators:
Missing Discriminators:
```

For ambiguous entities, collect discriminators such as affiliation, field, date
range, title words, coauthors, location, repository owner, organization,
publication venue, or user-provided context.

### 2. Compile Checkable Claims

Do not search a vague topic and report whatever appears. Convert the request into
one or more claims:

```text
Claim:
Evidence Needed:
Source Class Needed:
Failure Mode:
```

Examples:

```text
Claim: This search result refers to the same person as the user-provided context.
Evidence Needed: Matching affiliation, field, or first-party page.
Source Class Needed: official page, institutional page, author profile, repository, or primary publication.
Failure Mode: Same-name person from another institution or field.
```

```text
Claim: This paper is the requested work, not a similarly titled paper.
Evidence Needed: Matching title, authors, venue or arXiv/DOI, and method context.
Source Class Needed: paper page, PDF, arXiv/OpenReview/publisher page, author page, or repository.
Failure Mode: Similar title phrase with different authors or topic.
```

### 3. Prioritize Sources

Prefer sources in this order:

1. Official source for the object: project docs, company docs, institution page,
   repository, standards body, government page, author page, conference page.
2. Primary artifact: paper PDF, arXiv/OpenReview page, release notes, changelog,
   source code, dataset card, API reference.
3. Recognized secondary source: established news outlet, academic index, package
   index, reputable documentation mirror.
4. Search snippets, SEO pages, generated summaries, mirrors, and low-authority
   pages only as leads.

Do not treat search rank, snippets, or model summaries as authority by
themselves.

### 4. Run Disambiguating Queries

For entity-sensitive tasks, use targeted query variants rather than one generic
query:

```text
"<name>" "<affiliation>"
"<name>" "<field keyword>"
"<name>" "<coauthor or collaborator>"
"<paper title>" "<author>"
"<paper title>" "<venue or year>"
"<repository>" "<owner or organization>"
"<project acronym>" "<domain keyword>"
```

Actively look for near misses:

- same name, different affiliation;
- same title phrase, different paper;
- same acronym, different project;
- old documentation for a changed API;
- generated SEO pages or mirrors that copy stale content;
- source pages with no date for time-sensitive claims.

### 5. Resolve Evidence Status

Use one of these statuses before answering:

| Status | Meaning |
|---|---|
| `confirmed` | Authoritative or primary sources directly support the claim. |
| `likely` | Good sources support the claim, but one discriminator or primary source is missing. |
| `unresolved` | Sources are insufficient or ambiguous. |
| `conflicting` | Credible sources disagree or point to different entities. |

When the user is the subject or directly owns the private fact, user-provided
ground truth is authoritative for that identity or first-party context. Search
evidence must be reconciled with it, not placed above it.

### 6. Answer With Boundaries

The final answer should state:

- what is confirmed;
- which class of source supports it;
- what remains uncertain;
- what was inferred rather than directly stated;
- whether the evidence is current, stale, ambiguous, or conflicting.

Use concise language for simple searches. Use a compact evidence table for
entity-sensitive, disputed, or multi-source answers.

## Whole-Object Frame

Apply this frame internally when search output affects a claim:

```text
Whole Object: The external fact or entity identity being claimed.
State: Search results, source pages, user-provided context, and current date.
Representation: Query strings, snippets, source URLs, page text, citations.
Control Chain: User request -> agent query choice -> search tool/provider -> source inspection -> answer.
Bypass Path: Accepting a search snippet or first result without source inspection.
Failure Path: Wrong entity, stale source, source conflict, or overconfident synthesis.
Responsibility Owner: The agent owns evidence boundaries; the user owns private or first-party ground truth they explicitly provide.
```

## Decision Rules

### Current Information

Search and cite current sources. Prefer official or primary sources. If the
source date is missing or stale, say so.

### Person Lookup

Do not assume the first matching name is the requested person. Match at least one
strong discriminator such as affiliation, field, coauthor, location, official
profile, or user-provided context. If none match, answer `unresolved` or
`conflicting`.

### Paper Lookup

Prefer DOI, arXiv, OpenReview, publisher, conference, author page, PDF, or
repository links. Title similarity is insufficient when authors, venue, year, or
topic do not match.

### API Or Product Capability

Prefer official documentation, changelogs, release notes, or source code over
blog posts and snippets. If the user asks about OpenAI products, follow the
official OpenAI documentation requirement.

## Interaction With `llm_router`

This skill does not change `llm_router`. Keep responsibilities separate:

| Layer | Responsibility |
|---|---|
| `llm_router` | Protocol compatibility, provider payload translation, Responses state correctness. |
| `brain:agentic-search` | Agent search strategy, source authority, entity disambiguation, conflict handling. |
| User | Private ground truth, task acceptance, and domain context only they can know. |

Better retrieval does not remove the need for claim-level verification.

## Output Pattern

For disputed or entity-sensitive tasks, prefer this compact structure:

```text
Status: confirmed | likely | unresolved | conflicting
Claim:
Evidence:
Disambiguators Checked:
Remaining Gap:
Answer:
```

For ordinary current-info tasks, a short answer with citations and a note about
uncertainty is enough.

## Bottom Line

Search should reduce uncertainty, not launder uncertainty into confidence. Name
the object, verify the claim, disambiguate near misses, and mark the boundary of
what the sources actually support.
```

- [ ] **Step 3: Verify frontmatter and trigger text**

Run:

```bash
sed -n '1,40p' plugins/brain/skills/agentic-search/SKILL.md
```

Expected output includes:

```text
name: agentic-search
description: "Use when a task involves web search, current information, source verification, citations, or entity/person/paper/project disambiguation."
```

- [ ] **Step 4: Commit the new skill**

Run:

```bash
git add plugins/brain/skills/agentic-search/SKILL.md
git commit -m "feat: add agentic search brain skill"
```

Expected: commit succeeds with only `plugins/brain/skills/agentic-search/SKILL.md` staged.

---

## Task 2: Route Search Tasks From `using-ansatz-brain`

**Files:**
- Modify: `plugins/brain/skills/using-ansatz-brain/SKILL.md`

- [ ] **Step 1: Update the architecture skill list**

In `plugins/brain/skills/using-ansatz-brain/SKILL.md`, replace the "Brain domain skills" block inside the architecture diagram with:

```text
    +-- Brain domain skills (built-in):
    |       brain:think-before-you-calculate   -- calc, training, benchmarks
    |       brain:epistemic-systems-audit      -- papers, claims, evidence
    |       brain:agentic-search               -- web search, source verification, entity disambiguation
    |       brain:codex-compatible             -- exec_command, sandbox, prefix_rule
```

- [ ] **Step 2: Update Router Decision**

In the `## Router Decision` code block, replace items 1 through 4 with:

```text
1. Task involves web search, current information, source verification, citations,
   or entity/person/paper/project disambiguation?
   -> brain:agentic-search

2. Task involves running calculations, training, benchmarks, simulations,
   computational searches, workflows, or optimization?
   -> brain:think-before-you-calculate

3. Task involves evaluating a paper, AI4S result, scientific claim, or benchmark evidence?
   -> brain:epistemic-systems-audit

4. Task involves exec_command escalation, sandbox permissions, or prefix_rule usage?
   -> brain:codex-compatible

5. Task needs superpowers workflows (brainstorming, debugging, TDD, planning, etc.)?
   -> superpowers:using-superpowers
```

- [ ] **Step 3: Update the coexistence example**

Replace this sentence:

```markdown
Brain skills and external skills can coexist. A task may activate `brain:whole-object-responsibility` + `brain:state-machine` + `brain:think-before-you-calculate` + `superpowers:using-superpowers` simultaneously. The brain skills provide the epistemic and state lens; the external skills provide the workflow.
```

With:

```markdown
Brain skills and external skills can coexist. A task may activate `brain:whole-object-responsibility` + `brain:state-machine` + `brain:agentic-search` + `superpowers:using-superpowers` simultaneously. Search-heavy computational work may also activate `brain:think-before-you-calculate`. The brain skills provide the epistemic and state lens; the external skills provide the workflow.
```

- [ ] **Step 4: Update Skill Map rows**

In the `## Skill Map` table, replace these rows:

```markdown
| Run benchmark, train model, search, simulate, optimize, execute workflow | `brain:think-before-you-calculate` |
| Read paper, review AI4S, judge benchmark result, repair inflated claim | `brain:epistemic-systems-audit` |
| exec_command escalation, sandbox, prefix_rule | `brain:codex-compatible` |
| Need superpowers workflows (brainstorming, debugging, TDD, planning) | `superpowers:using-superpowers` |
```

With:

```markdown
| Web search, current facts, source verification, citations, entity/person/paper/project disambiguation | `brain:agentic-search` |
| Run benchmark, train model, computational search, simulate, optimize, execute workflow | `brain:think-before-you-calculate` |
| Read paper, review AI4S, judge benchmark result, repair inflated claim | `brain:epistemic-systems-audit` |
| exec_command escalation, sandbox, prefix_rule | `brain:codex-compatible` |
| Need superpowers workflows (brainstorming, debugging, TDD, planning) | `superpowers:using-superpowers` |
```

- [ ] **Step 5: Verify routing references**

Run:

```bash
rg -n "agentic-search|current information|entity/person/paper/project|computational search" plugins/brain/skills/using-ansatz-brain/SKILL.md
```

Expected: output shows `brain:agentic-search` in the architecture diagram, router decision, coexistence example, and skill map.

- [ ] **Step 6: Commit routing update**

Run:

```bash
git add plugins/brain/skills/using-ansatz-brain/SKILL.md
git commit -m "feat: route search tasks to agentic search skill"
```

Expected: commit succeeds with only `plugins/brain/skills/using-ansatz-brain/SKILL.md` staged.

---

## Task 3: Clarify Boundaries In Existing Brain Skills

**Files:**
- Modify: `plugins/brain/skills/codex-compatible/SKILL.md`
- Modify: `plugins/brain/skills/think-before-you-calculate/SKILL.md`

- [ ] **Step 1: Add a search-policy boundary to `codex-compatible`**

In `plugins/brain/skills/codex-compatible/SKILL.md`, after the paragraph that begins `This skill covers Codex platform patterns`, add:

```markdown
For web-search judgment, source verification, current-information checks, or entity disambiguation, route to `brain:agentic-search`. This skill only covers Codex platform mechanics; it must not absorb search strategy or source-ranking policy.
```

- [ ] **Step 2: Verify `codex-compatible` scope**

Run:

```bash
rg -n "agentic-search|search strategy|source-ranking|Codex platform mechanics" plugins/brain/skills/codex-compatible/SKILL.md
```

Expected: output includes the new boundary paragraph and no instruction that makes `codex-compatible` responsible for search judgment.

- [ ] **Step 3: Add a search boundary to `think-before-you-calculate`**

In `plugins/brain/skills/think-before-you-calculate/SKILL.md`, after the `calc` term row in the `## Terms` table, add this paragraph:

```markdown
Information retrieval, source verification, and search-result interpretation route to `brain:agentic-search`. Parameter search, benchmark search, optimization search, candidate search, and other computational searches remain in this skill.
```

- [ ] **Step 4: Update the red flag wording**

In `plugins/brain/skills/think-before-you-calculate/SKILL.md`, replace this red flag:

```markdown
- The task says only "improve MAE," "run benchmark," "train model," "search," "generate candidates," or "automate workflow."
```

With:

```markdown
- The task says only "improve MAE," "run benchmark," "train model," "search candidates," "optimize," "generate candidates," or "automate workflow."
```

- [ ] **Step 5: Update the specific-skill routing list**

In the `## When This Is Not Enough` section, add this bullet before the existing `epistemic-systems-audit` bullet:

```markdown
- Use `agentic-search` for web search, current-information lookup, source verification, citations, and entity/person/paper/project disambiguation.
```

- [ ] **Step 6: Verify boundary references**

Run:

```bash
rg -n "agentic-search|Information retrieval|search candidates|computational searches" plugins/brain/skills/think-before-you-calculate/SKILL.md plugins/brain/skills/codex-compatible/SKILL.md
```

Expected: output shows both skills point search judgment to `agentic-search`, while computational search remains in `think-before-you-calculate`.

- [ ] **Step 7: Commit boundary updates**

Run:

```bash
git add plugins/brain/skills/codex-compatible/SKILL.md plugins/brain/skills/think-before-you-calculate/SKILL.md
git commit -m "docs: clarify search responsibility boundaries"
```

Expected: commit succeeds with only the two boundary skill files staged.

---

## Task 4: Update Public Documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the Brain plugin summary**

In `README.md`, replace:

```markdown
`brain` provides audit-oriented skills for scientific, technical, and workflow reasoning.
```

With:

```markdown
`brain` provides audit-oriented skills for scientific, technical, workflow, and search-evidence reasoning.
```

- [ ] **Step 2: Add the new skill to the included skill list**

In the `### brain` section of `README.md`, replace the included skills list:

```markdown
- `using-ansatz-brain`
- `state-machine`
- `think-before-you-calculate`
- `epistemic-systems-audit`
- `whole-object-responsibility`
```

With:

```markdown
- `using-ansatz-brain`
- `state-machine`
- `agentic-search`
- `think-before-you-calculate`
- `epistemic-systems-audit`
- `whole-object-responsibility`
```

- [ ] **Step 3: Verify README references**

Run:

```bash
rg -n "search-evidence|agentic-search|Included skills" README.md
```

Expected: output includes `search-evidence` and `agentic-search` in the `brain` documentation area.

- [ ] **Step 4: Commit README update**

Run:

```bash
git add README.md
git commit -m "docs: document agentic search skill"
```

Expected: commit succeeds with only `README.md` staged.

---

## Task 5: Validate Plugin Coherence

**Files:**
- Read: `plugins/brain/skills/agentic-search/SKILL.md`
- Read: `plugins/brain/skills/using-ansatz-brain/SKILL.md`
- Read: `plugins/brain/skills/codex-compatible/SKILL.md`
- Read: `plugins/brain/skills/think-before-you-calculate/SKILL.md`
- Read: `README.md`
- Optional modify: `.state-machine/codex-main.md`

- [ ] **Step 1: Verify all Brain skill metadata frontmatter**

Run:

```bash
find plugins/brain/skills -name SKILL.md -maxdepth 3 -print -exec sed -n '1,6p' {} \;
```

Expected: every printed `SKILL.md` begins with YAML frontmatter containing `name:` and `description:`. `agentic-search` appears once.

- [ ] **Step 2: Verify routing coverage**

Run:

```bash
rg -n "agentic-search|web search|source verification|entity/person/paper/project|computational search" plugins/brain/skills README.md
```

Expected: output shows:

```text
plugins/brain/skills/agentic-search/SKILL.md
plugins/brain/skills/using-ansatz-brain/SKILL.md
plugins/brain/skills/codex-compatible/SKILL.md
plugins/brain/skills/think-before-you-calculate/SKILL.md
README.md
```

- [ ] **Step 3: Verify no forbidden scope drift**

Run:

```bash
rg -n "RAG|vector|crawl|crawler|source ranking|provider payload|DeepSeek request|Responses state" plugins/brain/skills/agentic-search plugins/brain/skills/codex-compatible plugins/brain/skills/think-before-you-calculate
```

Expected: no output that instructs the Brain skills to implement a backend, mutate router state, or change provider payloads. Mentions that reject or separate these responsibilities are acceptable.

- [ ] **Step 4: Run the existing plugin coherence audit if present**

Run:

```bash
test -f .scripts/20260511-140614-plugin-coherence-audit.py && UV_CACHE_DIR=./.cache/uv uv run python .scripts/20260511-140614-plugin-coherence-audit.py
```

Expected: if the audit script exists and its current checks still match the repository, it exits 0. If the script fails because it has a hard-coded Brain skill count or skill list, inspect the failure and update the audit in a separate follow-up task rather than weakening the new skill implementation.

- [ ] **Step 5: Inspect git status for intended files only**

Run:

```bash
git status --short
```

Expected: only intentional changes remain. If prior unrelated user changes exist, leave them untouched and mention them in the final handoff.

- [ ] **Step 6: Optionally record execution evidence**

If following `brain:state-machine` for implementation, append an execution entry to `.state-machine/codex-main.md` using this template:

```markdown
## T011 - Implement Agentic Search Skill

Before State: CyberBrain had a design and implementation plan for `brain:agentic-search`, but no installed skill file or routing.
Action: Add `plugins/brain/skills/agentic-search/SKILL.md` and wire routing from `using-ansatz-brain`, boundary notes from `codex-compatible` and `think-before-you-calculate`, and README documentation.
After State: Brain plugin exposes `agentic-search` and documents responsibility boundaries for web search, source verification, and entity disambiguation.
Implicit Claim: Search judgment now lives in the agent skill layer without moving search policy into `llm_router` or `codex-compatible`.
Authority: `docs/superpowers/specs/2026-06-01-agentic-search-skill-design.md` and `docs/superpowers/plans/2026-06-01-agentic-search-skill.md`.
Representation / Proxy: Markdown skill files, README entry, and text-search validation.
Lost Information: Runtime plugin installation is not exercised by these text checks.
Evidence IDs: implementation terminal output and git diff from this task.
Evidence Quality: mixed.
Failure Mode: Future changes may add a backend-oriented search policy to the wrong skill or omit `agentic-search` from installed plugin cache.
Verification: `rg` routing checks passed; plugin coherence audit passed or was explicitly triaged.
Object Drift: none.
Status: verified
```

- [ ] **Step 7: Commit validation/state evidence if changed**

If `.state-machine/codex-main.md` was updated, run:

```bash
git add .state-machine/codex-main.md
git commit -m "chore: record agentic search implementation evidence"
```

Expected: commit succeeds if the state file is tracked or force-added by project policy. If `.state-machine/` is intentionally untracked, do not force-add it without explicit user approval.

---

## Self-Review

**Spec coverage:** The plan covers creating the new skill, routing from `using-ansatz-brain`, boundary notes in `codex-compatible` and `think-before-you-calculate`, README documentation, and validation. It preserves the `llm_router` boundary and does not introduce a search backend.

**Placeholder scan:** The plan contains no implementation placeholders. Every code or markdown change has concrete content, file paths, and verification commands.

**Type and name consistency:** The skill name is consistently `agentic-search`; the routed skill label is consistently `brain:agentic-search`; the file path is consistently `plugins/brain/skills/agentic-search/SKILL.md`.
