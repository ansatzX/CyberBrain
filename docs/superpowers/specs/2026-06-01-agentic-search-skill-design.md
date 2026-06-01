# Agentic Search Skill Design

**Date:** 2026-06-01
**Status:** Draft
**Author:** Codex

---

## Overview

Add a dedicated `brain:agentic-search` skill to CyberBrain. The skill defines how
Codex agents should use web search results responsibly, especially when the task
requires current information, source verification, entity disambiguation, or
person/paper/project lookup.

This is an agent behavior layer, not a router or search-backend layer. It should
not change `llm_router`, implement a RAG engine, or add provider-specific search
logic. The router remains responsible for protocol compatibility, such as
translating Codex Responses `web_search` requests into provider-supported search
tools. The skill is responsible for search judgment: what claim is being checked,
which sources count as authority, how conflicts are handled, and when the answer
must be downgraded.

---

## Problem

Codex-hosted or provider-hosted web search can return plausible but wrong
results. The highest-risk cases are entity mismatch and overconfident
interpretation:

1. A query names a person, paper, project, organization, or repository, but search
   results refer to a different entity with a similar name.
2. The model accepts a search snippet or first result as ground truth.
3. Search output conflicts with user-provided first-party knowledge.
4. The agent reports a strong claim without showing which source supports which
   part of the answer.

The `llm_router` DeepSeek web-search bridge design explicitly keeps search policy
out of the router. Therefore, this responsibility belongs in a CyberBrain skill
that governs Codex agent behavior.

---

## Goals

1. **General search discipline:** Make all agent web-search work claim-oriented,
   source-aware, and conflict-aware.
2. **Entity mismatch protection:** Reduce wrong-person, wrong-paper, wrong-project,
   and wrong-organization conclusions.
3. **Evidence boundaries:** Require answers to distinguish confirmed facts,
   likely inferences, unresolved gaps, and source conflicts.
4. **Router boundary preservation:** Keep protocol bridging in `llm_router` and
   search judgment in the agent skill layer.
5. **Lightweight adoption:** Add a skill that works with existing Codex search
   tools and provider search without requiring a new MCP server or backend.

---

## Non-Goals

- Implementing a new search backend.
- Implementing RAG retrieval, vector indexing, source ranking, or crawling.
- Adding domain-specific person lookup, paper lookup, or citation databases.
- Modifying DeepSeek request payloads, Responses state handling, or router
  commit behavior.
- Treating provider domain filters as reliable without live evidence.
- Guaranteeing correctness when authoritative sources are unavailable.

---

## Proposed File Layout

```text
plugins/brain/
├── skills/
│   ├── agentic-search/
│   │   └── SKILL.md
│   ├── codex-compatible/
│   │   └── SKILL.md
│   ├── think-before-you-calculate/
│   │   └── SKILL.md
│   └── using-ansatz-brain/
│       └── SKILL.md
└── .codex-plugin/
    └── plugin.json
```

No plugin manifest change should be required if the existing `skills: "./skills/"`
directory discovery includes subdirectories with `SKILL.md`.

---

## Skill Trigger

`brain:agentic-search` should trigger when a task involves any of the following:

- web search, browsing, looking up current information, or checking latest facts;
- source verification, citations, quotes, or precise attribution;
- entity disambiguation for people, papers, projects, repositories, institutions,
  products, standards, regulations, or datasets;
- disputed search results or user-provided ground truth;
- broad research where the answer depends on external sources.

The trigger should be added to `using-ansatz-brain`:

```text
Task involves web search, current information, source verification, citations,
or entity/person/paper/project disambiguation?
-> brain:agentic-search
```

`codex-compatible` should not absorb search policy. It should only point to the
new skill:

```text
For web-search judgment, source verification, current-information checks, or
entity disambiguation, route to `brain:agentic-search`.
```

`think-before-you-calculate` should retain calculation/search/optimization
coverage, but clarify the boundary:

```text
Information retrieval, source verification, and search-result interpretation
route to `brain:agentic-search`. Parameter search, benchmark search, optimization
search, and computational search remain here.
```

---

## Core Workflow

The skill should require a compact but explicit workflow before trusting search
results.

### 1. Define The Search Object

Identify what is being searched:

- fact;
- current status;
- person;
- paper;
- project or repository;
- organization;
- product or standard;
- broad topic.

The agent must state the object internally before searching. For ambiguous
entities, it must collect disambiguators such as affiliation, field, date range,
title words, coauthors, location, repository owner, or organization.

### 2. Convert The Request Into Checkable Claims

Do not search for a vague topic and report whatever appears. Convert the user
request into one or more checkable claims:

```text
Claim: This person is the same Cunxi Gong associated with the user-provided context.
Claim: This paper title corresponds to the requested method, not a similarly named work.
Claim: This API currently documents feature X as supported.
```

If the claim cannot be made checkable, ask the user for the missing discriminator
or answer with a clearly marked uncertainty boundary.

### 3. Select Source Priority

Prefer sources in this order when available:

1. Official source for the object: project docs, company docs, institution page,
   repository, standards body, government page, author page, conference page.
2. Primary artifact: paper PDF, arXiv/OpenReview page, release notes, changelog,
   source code, dataset card, API reference.
3. Recognized secondary source: established news, academic index, package index,
   reputable documentation mirror.
4. Search snippets and low-authority pages only as leads, not as final evidence.

Search results are not self-authenticating. A first result can identify a path to
evidence, but it cannot by itself settle an identity or factual claim.

### 4. Run Disambiguating Queries

For entity-sensitive tasks, use multiple targeted queries rather than one generic
query. Combine the name or title with discriminators:

```text
"<name>" "<affiliation>"
"<name>" "<field keyword>"
"<paper title>" "<author>"
"<repository>" "<owner or organization>"
```

The agent should actively look for near misses:

- same name, different affiliation;
- same title phrase, different paper;
- same acronym, different project;
- old documentation for a changed API;
- generated SEO pages or mirrors that copy stale content.

### 5. Resolve Conflicts

When sources conflict, downgrade the answer instead of smoothing over the
conflict. Use these statuses:

| Status | Meaning |
|---|---|
| `confirmed` | Authoritative or primary sources directly support the claim. |
| `likely` | Good sources support the claim, but one discriminator or primary source is missing. |
| `unresolved` | Sources are insufficient or ambiguous. |
| `conflicting` | Credible sources disagree or point to different entities. |

User-provided ground truth can be authoritative for identity and first-party
context when the user is the subject or directly owns the fact. In that case,
search is evidence to reconcile, not a higher authority than the user.

### 6. Answer With Evidence Boundaries

The final answer should make clear:

- what was confirmed;
- which source class supports it;
- what remains uncertain;
- what was inferred rather than directly stated;
- whether search results may be stale or ambiguous.

For simple tasks this can be one short sentence. For disputed or entity-sensitive
tasks, use a compact evidence table.

---

## Whole-Object Responsibility Frame

The skill should include a short object-responsibility pass:

```text
Whole Object: The external fact or entity identity being claimed.
State: Search results, source pages, user-provided context, and current date.
Representation: Query strings, snippets, source URLs, page text, citations.
Control Chain: User request -> agent query choice -> search tool/provider -> source inspection -> answer.
Bypass Path: Model accepts a search snippet or first result without source inspection.
Failure Path: Wrong entity, stale source, source conflict, or overconfident synthesis.
Responsibility Owner: The agent owns evidence boundaries; the user owns private or first-party ground truth they explicitly provide.
```

---

## Example Decision Rules

### General Current-Info Search

If the user asks for current information, the agent should search and cite
current sources. It should prefer official or primary sources when the topic has
one. If sources are stale or no source date is visible, the agent should say so.

### Person Lookup

The agent must not assume the first matching name is the requested person. It must
match at least one discriminator such as affiliation, field, coauthor, location,
or user-provided context. If none match, the result is `unresolved` or
`conflicting`, not confirmed.

### Paper Lookup

The agent should prefer DOI, arXiv, OpenReview, publisher, conference, author
page, or repository links. Title similarity is insufficient when authors, venue,
year, or topic do not match.

### API Or Product Capability

The agent should prefer official documentation, changelogs, release notes, or
source code over blog posts and search snippets. If the user asks about OpenAI
products, the agent must follow the existing official-docs requirement and use
official OpenAI sources.

---

## Interaction With `llm_router`

The skill assumes `llm_router` may improve provider-level web-search bridging,
but it does not depend on that implementation. The responsibilities remain
separate:

| Layer | Responsibility |
|---|---|
| `llm_router` | Protocol compatibility, provider payload translation, Responses state correctness. |
| `brain:agentic-search` | Agent search strategy, source authority, entity disambiguation, conflict handling. |
| User | Private ground truth, task acceptance, and domain context only they can know. |

If the router returns better search results, the skill still applies. Better
retrieval does not remove the need for claim-level verification.

---

## Testing And Validation

This is primarily a skill-text change. Validation should include:

1. Repository search confirms `agentic-search/SKILL.md` exists and has valid
   frontmatter.
2. `using-ansatz-brain` routes search/source/entity tasks to `brain:agentic-search`.
3. `codex-compatible` remains scoped to Codex platform mechanics and only
   cross-references the search skill.
4. `think-before-you-calculate` preserves computational search scope while
   redirecting information search to `agentic-search`.
5. Manual review confirms the skill does not instruct agents to implement a
   backend, mutate router state, or rely on provider domain filters.

If a plugin coherence audit exists, extend it to check the new skill metadata and
routing references.

---

## Implementation Plan Outline

1. Add `plugins/brain/skills/agentic-search/SKILL.md`.
2. Update `plugins/brain/skills/using-ansatz-brain/SKILL.md` routing table and
   controller text.
3. Add a short cross-reference to
   `plugins/brain/skills/codex-compatible/SKILL.md`.
4. Add a boundary note to
   `plugins/brain/skills/think-before-you-calculate/SKILL.md`.
5. Update `README.md` included skill list for `brain`.
6. Run local text checks over skill metadata and routing references.

---

## Spec Self-Review

- Placeholder scan: no `TBD` or unresolved TODO placeholders.
- Internal consistency: the skill is an agent behavior layer; router behavior
  remains outside scope throughout the spec.
- Scope check: this is a single skill plus routing update, not a new backend or
  MCP server.
- Ambiguity check: A and B are both covered: general search discipline and
  entity/person/paper/project mismatch protection.
