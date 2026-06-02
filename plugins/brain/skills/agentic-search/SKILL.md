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
