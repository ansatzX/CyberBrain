# Reading Code With The Interrogation Chain

## Where To Start

Do not read files in directory order. Start at the boundary where the system touches the outside world, then follow inward.

| Boundary type | Start here |
|---|---|
| CLI tool | `main()`, `argparse` / `click` entry, the command that users actually run |
| Library / API | Public functions, `__init__.py` exports, the functions other code imports |
| Workflow / pipeline | The orchestrator: a shell script, a workflow engine config, a `Makefile`, a scheduler submission script |
| Server / daemon | The startup path: how it binds ports, loads config, initializes state |
| Scientific script | The outermost loop: what data goes in, what computation happens, what file comes out |

A common failure mode is reading helper modules first — utility functions, data classes, configuration parsers. These make sense only after you understand what they serve. Start at the edge and trace inward.

## What The Name Says vs What The Code Does

The single most common error in reading code. Before trusting a function's name, check:

- **Does it mutate state?** A function called `get_config()` that also creates a cache directory is not just a getter.
- **Does it have side effects?** A function called `compute_energy()` that also writes to a global log file and updates a progress bar.
- **Does it handle errors or pass them?** A function called `parse_input()` that returns `None` on failure instead of raising — every caller must now check for `None`, but the name doesn't say so.
- **Does it assume conventions?** A function called `load_trajectory()` that assumes XYZ format, angstrom units, and atom ordering by atomic number. None of this is in the name.

Rule: **read the function body before trusting the function name.** If the body is too long to read, the name is already unreliable — long functions accumulate hidden behavior.

## Where Tacit Knowledge Hides In Code

**Magic numbers and undocumented constants**
```python
timestep = 0.5  # fs — but only if you read the comment three files away
cutoff = 6.0    # angstrom — or is it bohr? depends on the codebase convention
threshold = 1e-6  # convergence — but convergence of what?
```
A number without a unit, a source, or a justification is tacit knowledge the original author had and you don't.

**Implicit conventions**
- Array index order: `[batch, channel, height, width]` vs `[batch, height, width, channel]`. The code works because every module assumes the same convention, but no single file documents it.
- File format assumptions: a parser that reads column 3 as energy because "that's how the Fortran code wrote it in 2004."
- Sign conventions: a force is `-gradient` in the theory but `+gradient` in the code because of a sign flip in the coordinate transform.

**Error handling that masks failure**
```python
try:
    result = run_calculation(input_file)
except Exception:
    result = default_value  # silently use a fallback
```
The code runs. The result is wrong. No one knows because the error was swallowed. This is the code equivalent of a paper with no failure conditions.

**State that is scattered and implicit**
- Global variables mutated across modules: `from config import SETTINGS; SETTINGS['mode'] = 'production'` deep inside a utility function.
- Files as state: a workflow that checks "if output.csv exists, skip this step" — the file system is the state store, and stale files produce wrong results with no error.
- Environment variables that are read but never documented: `os.getenv('MYAPP_MODE', 'default')` — the code behaves differently in different environments, but the difference is invisible when reading the source.

**Dead code and unreachable paths**
```python
if phase == 'gas':
    ...  # 200 lines
else:
    raise NotImplementedError("only gas phase supported")
```
The `gas` branch is 200 lines. The `else` branch exists but was never tested. The code advertises generality that doesn't exist.

## Tracing The Interrogation Chain Through Code

**Object: what does this code actually transform?**
- Start at output: what file, database row, API response, or state change does the code produce?
- Work backward to input: what enters the system to produce that output?
- The object is the transformation from input to output — not the code itself.

**State: where does the code store facts?**
- Files: input files, output files, checkpoint files, log files, lock files.
- Memory: global variables, module-level caches, singleton objects.
- External systems: databases, environment variables, scheduler queues, cloud storage.
- For each: who writes? who reads? what happens on restart?

**Representation: how does the object enter the code?**
- Data formats: CSV, JSON, HDF5, binary, custom text formats.
- In-memory structures: arrays, tensors, graphs, trees. What are the axis conventions?
- Configuration: command-line args, config files, environment variables, hardcoded defaults. Which takes precedence?

**Constraints: what real restrictions exist?**
- Language-level: type system, memory model, GIL.
- Library-level: API contracts, supported versions, deprecated functions.
- Resource-level: memory limits, disk space, wall-clock time, GPU availability.
- Domain-level: the code assumes a specific physical regime, approximation, or model. It will produce numbers outside that regime, but they will be wrong.

**Operations: what actually happens?**
- Trace one execution path from input to output. Do not summarize what the code "is supposed to do" — follow what it actually does.
- For each function call: what goes in? what comes out? what changed in the state?
- A read of a config value that happens inside a hot loop is not "reading config" — it's a performance bug. Operations are what the machine does, not what the name says.

**Failure paths: how does the code break?**
- Explicit: `raise`, `exit(1)`, `abort()`, `sys.exit()`.
- Implicit: division by zero, index out of bounds, `None` dereference, NaN propagation.
- Silent: `try/except pass`, default values on failure, truncated output with no warning.
- For each: is the failure visible to a human (log message, non-zero exit code, alert) or only to the machine (exception traceback in a log file nobody reads)?

**Responsibility owner: who decides if the output is correct?**
- The code that produces the result? (No — code has no judgment.)
- The person who wrote the code? (Maybe — if they're still around and still remember.)
- The person running the code? (Maybe — if they know what correct looks like.)
- No one? (Flag responsibility evaporation.)

**Tacit-unwritten: what did the original author know that isn't in the code?**
- Physical constants and their sources.
- Unit systems and conventions.
- Parameter choices and the failed alternatives.
- Known failure modes and their workarounds.
- "This function only works if called after `init()`" — undocumented ordering requirements.

## Procedure: Walking The Chain On Code

1. Find the entry point. Run `--help` or read the main function to see what the code claims to do.
2. Find the output. What file, state change, or response does a successful run produce?
3. Trace one path from entry to output. Do not read all modules — follow the data.
4. For each function on the path: read the body, check the name, note side effects.
5. Identify state storage: files, globals, databases, env vars. Check for scattered state.
6. Find error handling: try/catch, exit codes, log statements. Check for silent failure.
7. Check for tacit assumptions: magic numbers, implicit conventions, undocumented constraints.
8. Fill the audit template. Mark gaps as Unknown with a reason.
