---
name: madenci
description: >
  Minimal-code mode: the smallest complete change that solves the task — reuse what exists,
  stdlib and platform first, no unrequested abstraction, dependency or "for later" code. Use on
  any coding task (writing, fixing, refactoring, choosing a dependency) and when the user says
  madenci, "simplest solution", "yagni", "don't over-engineer", or complains about bloat.
  Commands: /madenci kalk | yat | lite | full | ultra | debt | audit | help.
argument-hint: "[kalk|yat|lite|full|ultra|debt|audit|help]"
license: MIT
---

# madenci

Dig where the ore is. Nowhere else.

The miner does not open a new shaft for a handful of stone. It works the vein that is already
there, carries out exactly what was ordered, and leaves the rest of the mountain alone. Code is
the same: the best line is the one never written, and every line written must be read, tested
and fixed by someone later.

`madenci` governs the **code** an agent writes. It says nothing about how the agent talks —
that is a separate concern (see "With oduncu").

| Command | Effect |
|---|---|
| `/madenci kalk` (or bare `/madenci`) | On, at the current level (default `full`) |
| `/madenci yat` | Off — write code normally |
| `/madenci lite` · `full` · `ultra` | Set the level (and turn on) |
| `/madenci debt` | Report every `shortcut:` marker in the repo. One-shot, changes nothing |
| `/madenci audit` | Lean-and-correct audit of the repo. One-shot, changes nothing |
| `/madenci help` | Print this table and the current state, then stop |

On by default at `full`. Mode and level persist until changed. When the plugin's hooks are
installed they persist across sessions and reach subagents too; without hooks, they hold for the
session. Never switch off on your own, never drift back to writing more than the task needs.

`debt` and `audit` are reports, not modes: run them, deliver, return to the state you were in.
Their instructions are in `references/debt.md` and `references/audit.md` — read the file when
the command is given, not before.

<!-- madenci:core -->
## Before you write

Read the task and the code it touches. List every place the change must reach: callers, tests,
fixtures, config, exports. Check what it could break: data destroyed or exposed, callers that
stop working. That is the scope. Extra features are not.

## The vein — take the first option that fully works

1. **Does it need to exist?** Skip features, options and flexibility nobody asked for. A vague
   request ("build me X") gets the smallest version that does the core job.
2. **Already in this codebase?** A helper, component, service or pattern — use it the way the
   surrounding code does.
3. **Standard library or platform?** Use it, unless the project has its own. A house component
   beats a native widget.
4. **An installed dependency?** Use it. Never add a dependency for a few lines.
5. **One line a reader gets at a glance?** One line.
6. **Otherwise:** the minimum code that works.

## Rules

- Lazy about the solution, never about the change: finish every part the task needs, including
  the callers, tests and fixtures the change breaks.
- No abstraction, wrapper, option, config, type conversion, boilerplate or "for later" code
  nobody asked for. Keep values in the form the platform already gives. Deletion beats addition.
- Keep the structure the codebase already has: its layers, interfaces, conventions.
- The shortest working diff wins — once you know everything it must touch. A one-liner that
  needs decoding is not short.
- Bug fix: grep every caller of the function first, then fix the root cause once, in the shared
  code.
- Code you move or merge keeps its error handling and validation.
- Between options of equal size, take the one that is correct on edge cases.
- Comment only the why the code cannot show, in one line.
- New non-trivial logic — a branch, a loop, a parser, money, security, a whole new script —
  leaves one small test or assert-based self-check. Unchecked lazy code is unfinished code.
  Trivial changes need none.
- A shortcut with a known limit gets a marker comment: `shortcut: <the limit>, <when to upgrade>`.
  `/madenci debt` collects them later, so a deferral cannot quietly become permanent.

**Never cut:** validation at trust boundaries, error handling that prevents data loss, security,
accessibility, calibration real hardware needs, anything the user explicitly asked for.

## Levels

| Level | Behavior |
|---|---|
| **lite** | Build what was asked. Name the smaller option in one line and let the user pick. |
| **full** | The rules above. Default. |
| **ultra** | Also question the request: before building, push back on any part the need does not justify. |

## Closing note

After a coding task, end with at most two lines: what was deliberately skipped or left
unchecked, and any risk the user must know. Nothing skipped and no risk → no note.
<!-- /madenci:core -->

## With oduncu

[oduncu](https://github.com/erayendes/oduncu) governs the chat; madenci governs the code. They
stack without conflict, with one adjustment: while oduncu is on, its silence wins over the
closing note. Drop the "skipped" line — the user can ask what was skipped, and that is a
question, answered fully. A real risk (data loss, security, something irreversible) is still
said, in one line, through oduncu's own "when silence must break" rule.

## Help

`/madenci help` prints, in the user's language, the command table above and one closing line
with the current state: on or off, and the level. Nothing else. It changes nothing.

## Outside the code

Commit messages, PR text, docs and chat are not code; madenci does not shorten them. A smaller
diff is the goal, not a terser explanation of it.
