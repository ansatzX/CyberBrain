# Evaluation of Ansatz Brain Skills After "Agentic AI in Action"

## Source Insight

The meeting summary argues that agentic AI in science is not mainly a stronger coding assistant. It is a shift in research organization: AI can execute, search, code, run tools, and iterate, while the human researcher must own problem definition, tacit-knowledge externalization, verification standards, physical judgment, and final endorsement.

The current Ansatz Brain skills already encode a strong anti-inflation stance: object/proxy/evidence/failure/responsibility must be made explicit. The main gap is that this stance is still mostly phrased as an audit lens. The meeting suggests it should become a stricter research workflow: first externalize tacit constraints, then write a specification, then define tests across verification layers, then execute, then record failures as reusable SOP knowledge.

## Improvement 1: Add A Knowledge Externalization Gate To The Controller

**File:** `plugins/brain/skills/using-ansatz-brain/SKILL.md`  
**Section to change:** `Router Decision`, before task-specific routing.

**Proposed inline text:**

```text
0A. Knowledge externalization gate
   Before routing to execution, calculation, coding, or scientific-claim judgment,
   ask what tacit knowledge must be externalized for AI to act reliably:

   - conventions: signs, units, gauges, coordinate systems, indexing, notation
   - boundary conditions: validity limits, approximations, input domains
   - implementation constraints: memory, matrix-free requirements, runtime limits, APIs
   - scientific constraints: symmetries, conservation laws, limits, known results
   - acceptance cases: examples that should pass, fail, or expose hallucination

   If these are missing, mark them `Unknown` and avoid strong claims.
   If the task asks AI to implement or automate science, produce or request a compact
   specification before execution unless the user explicitly wants exploratory work.
```

**Why this is justified:**  
The meeting repeatedly emphasizes that AI does not automatically possess the expert's tacit context: units, signs, boundary conditions, index conventions, memory constraints, matrix-free limitations, and physical reasonableness must be made explicit. The current controller asks for object, boundary, proxy, evidence, failure path, and responsibility, but it does not explicitly force a "what does the human know that the AI cannot infer?" step. This gate turns knowledge externalization into a first-class routing condition.

## Improvement 2: Add Specification-First Routing Before Coding Or Workflow Execution

**File:** `plugins/brain/skills/using-ansatz-brain/SKILL.md`  
**Section to change:** `Router Decision`, after the knowledge externalization gate and before `think-before-you-calculate`.

**Proposed inline text:**

```text
0B. Specification-first gate for code, workflow, and scientific implementation
   If the task involves implementing an algorithm, modifying scientific code,
   automating a workflow, or asking an agent to act over files/tools:

   Required before implementation:
   - scientific or operational objective
   - inputs and outputs
   - representation and conventions
   - constraints and non-goals
   - acceptance tests
   - verification layers required
   - human endorsement point

   If absent, either:
   - create the minimal specification first, then implement; or
   - label the work exploratory and forbid final correctness claims.
```

**Why this is justified:**  
The meeting's strongest engineering method is "do not let AI write code before defining correctness." The DMRG workflow explicitly separates theory extraction, equation review, LaTeX blueprint, and only then coding. The current brain skills warn against inflated conclusions, but they do not yet say that code/workflow implementation should be blocked or narrowed until a specification exists.

## Improvement 3: Split Verification Into Programming, Numerical, And Scientific Layers

**File:** `.codex/plugins/cache/CyberBrain/brain/0.0.1/skills/think-before-you-calculate/SKILL.md`  
**Section to change:** `Minimal Audit` and `Pre-Calc Procedure`.

**Proposed inline text for `Minimal Audit`:**

```text
Verification Layers:
  Programming Verification:
    [Does it run? Are interfaces, unit tests, schemas, file I/O, and errors checked?]
  Numerical / Computational Verification:
    [Convergence, stability, benchmark, reproducibility, tolerance, seed, precision.]
  Scientific Verification:
    [Physical limits, symmetries, dimensions, conservation laws, known analytic cases,
     experimental/literature comparison, physical picture.]
Layer Owner:
  [Who judges each layer? Use Unknown rather than merging them.]
```

**Proposed inline text for `Pre-Calc Procedure`:**

```text
8. Decide which verification layers are required.
9. State which layer a planned test actually verifies.
10. Do not use programming verification as evidence of numerical or scientific correctness.
11. Then run the tool, calculation, benchmark, or workflow.
```

**Why this is justified:**  
The meeting explicitly distinguishes programming verification, numerical/computational verification, and scientific verification. The existing `think-before-you-calculate` skill has "Evidence Expected" and "Failure Path", but those fields can collapse all verification into one bucket. The added structure prevents the common failure mode where "tests passed" means only the code ran, not that the computation is stable or the physics is correct.

## Improvement 4: Add A "Done Means Verified" Rule

**File:** `.codex/plugins/cache/CyberBrain/brain/0.0.1/skills/whole-object-responsibility/SKILL.md`  
**Section to change:** `Red Flags` and `Verdicts`.

**Proposed inline text for `Red Flags`:**

```text
- The agent says "done", but no artifact, state change, log, test result, or verification layer is attached.
- Completion is reported at the local task level while the global object remains unverified.
- A workflow reaches a terminal flag, but no one checked whether the terminal state means scientific success.
```

**Proposed inline text for `Verdicts`:**

```text
- `Completion theater`: an agent or workflow reports completion, but the claimed done-state
  is not tied to inspectable artifacts, state transitions, verification results, and a
  responsible human or system owner.
```

**Why this is justified:**  
The meeting names a practical agentic failure: "AI confidently says it is done, but it is not done correctly." The existing whole-object skill already handles responsibility evaporation and workflow theater, but "done-state" deserves its own failure label because agentic systems increasingly operate over long-running tasks, schedulers, logs, servers, and files. A completion claim must be converted into evidence-bearing state.

## Improvement 5: Require Human Responsibility As Structured Ownership, Not Rescue

**File:** `.codex/plugins/cache/CyberBrain/brain/0.0.1/skills/whole-object-responsibility/SKILL.md`  
**Section to change:** `Audit Template` and `Trace Failure And Cleanup`.

**Proposed inline text for `Audit Template`:**

```text
Human Responsibility Boundary:
  Problem Definition Owner:
  Tacit Knowledge / Convention Owner:
  Verification Standard Owner:
  Physical / Domain Judgment Owner:
  Final Endorsement Owner:
AI Execution Boundary:
  Search / coding / tool execution / summarization tasks the AI may perform:
  Decisions the AI must not silently make:
```

**Proposed inline text for `Trace Failure And Cleanup`:**

```text
Ask:
- Which judgments are delegated to AI execution, and which remain human-owned?
- Who defines correctness before the agent acts?
- Who decides whether a numerically plausible result is scientifically meaningful?
- Where must human endorsement occur before a result becomes a claim?
```

**Why this is justified:**  
The meeting frames human-in-the-loop not as "human fixes AI mistakes", but as a responsibility structure. AI executes; humans own problem framing, tacit context, verification standards, physical judgment, and final endorsement. The current skills ask for "responsibility owner", but that is too coarse for scientific agent workflows. Splitting ownership prevents responsibility evaporation behind a generic "human-in-the-loop" label.

## Improvement 6: Make Scientific-Claim Audits Require Evidence Standards Before Evidence

**File:** `.codex/plugins/cache/CyberBrain/brain/0.0.1/skills/epistemic-systems-audit/SKILL.md`  
**Section to change:** `Procedure`, especially `1. Recover The Scientific Question`.

**Proposed inline text:**

```text
Before judging evidence, require a predeclared evidence standard:

Evidence Standard must include:
- what observation, derivation, benchmark, or experiment would support the claim
- what result would weaken or falsify it
- which verification layer is required: programming, numerical, scientific, or multiple
- what human/domain judgment is required before endorsement

If the evidence standard is reconstructed only after seeing the result, mark:
`post-hoc standard risk`.
```

**Why this is justified:**  
The meeting's specification-first and test-first methodology applies not only to code but also to scientific claims. If the standard for correctness is invented after the output appears, the AI can rationalize plausible-looking results. The current epistemic audit includes "Evidence Standard", but the procedure does not force it to be predeclared before evaluating evidence.

## Improvement 7: Add Skill/SOP Preservation As A First-Class Productive Function

**File:** `plugins/brain/skills/using-ansatz-brain/SKILL.md`  
**Section to change:** `Skill Map` and `Minimal Fallback`.

**Proposed inline text for `Skill Map`:**

```text
| Repeated workflow, lab habit, server process, scientific coding pattern,
  or tacit research convention appears | Externalize into a Skill/SOP candidate |
```

**Proposed inline text for `Minimal Fallback`:**

```text
SOP Candidate:   [Should this one-off instruction become reusable skill/SOP knowledge?]
Reusable Artifact: [spec, test case, command, checklist, log format, failure handler, benchmark]
```

**Why this is justified:**  
The meeting argues that one-off prompts are not durable scientific infrastructure. The real knowledge-preservation move is to turn repeated workflows into skills, SOPs, logs, commands, evaluation metrics, and recovery protocols. The current brain skills treat "productive function" as a way to avoid over-dismissal; this improvement broadens productive function into knowledge preservation and future reusability.

## Improvement 8: Add Legacy-Code Scientific Kernel Extraction

**File:** `.codex/plugins/cache/CyberBrain/brain/0.0.1/skills/epistemic-systems-audit/SKILL.md`  
**Section to change:** `Procedure`, after `2. Separate Object, Representation, And Proxy`.

**Proposed inline text:**

```text
For legacy scientific code or inherited workflows, separate:

Scientific Kernel:
  [the physical model, algorithmic invariant, approximation, or empirical practice worth preserving]
Implementation Shell:
  [language, scripts, file formats, ad hoc glue, scheduler conventions, historical accidents]
Refactor Risk:
  [what scientific behavior could be lost if the shell is rewritten]
Reimplementation Tests:
  [cases proving the new implementation preserves the kernel]
```

**Why this is justified:**  
The meeting contrasts patching legacy code with extracting the "scientific soul" and rebuilding an AI-friendly implementation. The current skills can audit claims, but they do not yet give a pattern for distinguishing scientific content from inherited implementation artifacts. This matters for AI-assisted refactoring, because an agent may preserve file behavior while destroying the scientific invariant, or rewrite cleanly while losing hidden domain conventions.

## Improvement 9: Add Physical Test Case Categories To Scientific Verification

**File:** `.codex/plugins/cache/CyberBrain/brain/0.0.1/skills/think-before-you-calculate/SKILL.md`  
**Section to change:** `Red Flags` or new subsection before `Claim Compiler`.

**Proposed inline text:**

```text
Physical / Scientific Test Case Checklist:
- limit case: zero field, large size, weak coupling, high/low temperature, known asymptote
- symmetry case: rotation, translation, gauge, permutation, conservation law
- dimensional case: units, scaling, nondimensional parameters
- analytic case: exactly solvable or simplified model
- regression case: known literature or trusted legacy result
- negative case: input or regime where the method should fail or refuse a strong claim
- signature case: qualitative physical pattern that must appear if the mechanism is right
```

**Why this is justified:**  
The meeting gives concrete examples: normal-metal limits, far-from-vortex limits, gauge phase/current checks, physical assertion cases, limit cases, and signature tests. The current `think-before-you-calculate` skill asks for failure paths but does not operationalize what kinds of scientific tests should be generated. A checklist makes tacit physics easier to externalize.

## Improvement 10: Add Claim/Constraint/Reasoning/Credence Records

**File:** `.codex/plugins/cache/CyberBrain/brain/0.0.1/skills/epistemic-systems-audit/SKILL.md`  
**Section to change:** `Audit Template`.

**Proposed inline text:**

```text
Claim Record:
  Claim:
  Constraints:
  Reasoning Path:
  Evidence:
  Counterevidence:
  Failure Condition:
  Credence / Confidence:
  Endorsement Status:
```

**Why this is justified:**  
The meeting's formalization thread describes scientific knowledge as claim, constraint, reasoning, evidence, and credence. The current audit template has related fields, but not a compact record format that can be preserved across papers, workflows, and long-running agents. This addition would make the brain skills more compatible with persistent scientific memory and later verification.

## Top 3 Most Impactful Changes

1. **Add explicit verification layering.**  
   This is the highest-impact change because it prevents the most dangerous ambiguity: passing tests can mean programming correctness, numerical stability, or scientific validity, and these are not interchangeable. The current skills already resist proxy collapse; verification layering makes that resistance operational.

2. **Add specification-first and test-first gates before implementation/execution.**  
   This directly addresses the meeting's core method: no serious scientific coding before correctness has been specified. It would make the brain skills less purely diagnostic and more preventive.

3. **Add structured human responsibility boundaries.**  
   "Human-in-the-loop" is too weak as a phrase. The brain skills should name exactly what the human owns: problem definition, tacit knowledge, verification standards, domain judgment, and final endorsement. This aligns strongly with the existing responsibility philosophy while making it more usable in agentic research.

## Tensions Or Contradictions With Current Brain Skill Design

The meeting mostly reinforces the current brain design rather than contradicting it. The existing skills already reject inflated claims, proxy collapse, workflow theater, and responsibility gaps. However, there are several tensions.

First, the current brain skills are optimized for epistemic audit, while the meeting pushes toward executable research organization. Audit fields are necessary but not enough; they should trigger concrete workflow gates such as "write specification", "define tests", "separate verification layers", and "record SOP candidate".

Second, the current skills treat responsibility as a field, but the meeting treats human responsibility as a structured division of labor. The current wording can still allow a vague "human owns it" answer. Scientific agent workflows need more precise ownership boundaries.

Third, the current skills are deliberately general. The meeting suggests that scientific AI work benefits from more domain-shaped checklists: units, signs, gauge conventions, matrix-free constraints, convergence, physical limits, symmetry tests, and literature benchmarks. Too much specificity could make the skills bulky, but too little leaves the most important tacit knowledge unprompted.

Fourth, there is a mild tension between "use `Unknown` rather than inventing" and the meeting's call for AI-friendly specification. The right resolution is not to invent missing tacit knowledge, but to surface it as a required externalization gap and either ask the human, label work exploratory, or design a test that exposes the uncertainty.

Fifth, the current design protects against overclaiming after results exist. The meeting's stronger lesson is earlier: prevent bad generation by refusing to start serious implementation until correctness has been externalized. The proposed gates move the brain arsenal upstream from critique into research workflow architecture.

## Overall Recommendation

Ansatz Brain should keep its current object/proxy/evidence/failure/responsibility spine. That spine is well aligned with the meeting. The main upgrade is to add three operational bridges:

```text
tacit knowledge -> specification
specification -> layered verification
verification result -> human-endorsed claim or reusable SOP update
```

With those bridges, the skills would better reflect the meeting's central claim: agentic AI in science is reliable only when human expertise is externalized into reusable specifications, tests, verification layers, and responsibility structures.
