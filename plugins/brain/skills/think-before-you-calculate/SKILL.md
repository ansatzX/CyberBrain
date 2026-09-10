---
name: think-before-you-calculate
description: "Frame scientific calculations, simulations, experiments and benchmark interpretation so the measured proxy supports the intended claim. Ordinary builds, tests, scripts and agent calls do not trigger this audit by themselves."
---

# Think Before You Calculate

Use this skill when designing a scientific calculation or interpreting an
experimental or benchmark result. Identify what the measurement can establish
before spending compute or making a scientific claim.

## Choose the depth

- **Ordinary engineering execution:** run the requested build, test, script or
  agent task with its normal scope and checks. No scientific audit or template
  is required merely because tools are involved.
- **A specified calculation with a narrow output:** check the supplied inputs,
  units, method and expected result internally, then proceed. Surface only gaps
  that materially affect execution or interpretation.
- **Experiment design or a stronger scientific claim:** state the question,
  measurement and interpretation boundary briefly. Use the checks below; combine
  related points instead of filling a fixed form.

## Before spending compute

1. Identify the phenomenon or system and the question being tested.
2. Connect its representation and measured proxy to that question. For example,
   lower held-out MAE demonstrates predictive performance on that split, not
   automatically the correct physical mechanism.
3. Check the conditions where the comparison holds: units, data splits,
   approximations, baselines, uncertainty and relevant failure conditions.
4. Decide what outcome would support or weaken the hypothesis, which verification
   is needed, and who interprets the result. Use the declared compute budget.

Use existing task context; do not ask the user to repeat known inputs. Missing
information may justify an exploratory run or a narrower conclusion. Pause only
when it prevents a meaningful or authorized next step.

## Interpret the result

Report what was observed, under which conditions, and what it supports. Separate
execution success from numerical validity and scientific interpretation. Mention
unresolved gaps that affect the conclusion; do not append speculative disclaimers
to every result. A useful proxy can justify a narrow engineering contribution
without establishing understanding, discovery or generalization.

For an exploratory run, identify the missing evidence before promoting its result
to a scientific conclusion. Stop when the requested calculation and interpretation
are complete; an open research question does not authorize another experiment.

## When further guidance is needed

- Information retrieval and source verification: `agentic-search`.
- Detailed scientific claim or paper review: `epistemic-systems-audit`.
- System control, bypass and recovery ownership: `whole-object-responsibility`.

Load these only for the relevant part of the task; do not repeat the same audit.
