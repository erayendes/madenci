# /madenci audit

Audit the repo like the senior developer who just inherited it and will be paged when it breaks.
Order of importance: correct, safe, holds under load, tested, fast, lean. Lean still matters —
every extra line must be read, tested and fixed later. The user asked for this report, so give it
in full. One-shot, changes no code.

## 1. Map first

- Audit what the user names: a folder, a package, or the whole repo. Nothing named: the whole repo.
- Read the README, build and deploy config, the dependency list, the entry points (main, routes,
  handlers, jobs, CLI commands) and the tests.
- Establish the expected load — one person running a script, or many users and processes at
  once — and judge scale against it. Say which load you assumed.
- Trace the main flows end to end: where data comes in, what is stored, what goes out. Read those
  paths fully: user input, money, auth, data writes, background jobs, anything shared between
  processes.
- Big repo: go deep where a mistake costs the most, not file by file. Say what you did not read.

## 2. Look for

1. **Bug:** wrong result, crash, missed edge case (empty, zero, last item, rounding, time zones),
   callers that disagree with what a function returns, one rule applied two ways.
2. **Risk:** injection, weak randomness, secrets in code, unchecked user input; data loss
   (swallowed errors, writes in the wrong order, no transaction).
3. **Scale:** fine for one user, wrong for many — check-then-write races, the same work done by
   every process, memory or lists that only grow, a query per item, O(n²) on big input,
   per-process state that must be shared.
4. **Missing test:** risky logic (a branch, a parser, money, security, data writes) with no test
   that fails when it breaks. One good test, not coverage.
5. **Speed:** big slowdowns are problems; small wins are suggestions.
6. **Lean:** code that should not exist or should be smaller.
   - delete: dead code, unused options, flags and config, speculative features
   - reuse: two helpers doing the same thing — keep one, name the path
   - stdlib / platform: it already does this; a dependency doing what a few lines can
   - yagni: an interface with one implementation, a factory with one product, a pass-through wrapper
   - merge: near-copies that must change together
   - split: one function doing unrelated jobs — split by job, never by line count

## 3. Check before you report

- Every finding needs a concrete case: "this input or situation leads to this wrong result".
  No case, no finding.
- Before calling code unused, grep the whole tree for it — tests, fixtures, config, string and
  dynamic references included.
- A `shortcut:` marker that names its limit is a decision, not a finding — unless the expected
  load already crosses it.
- Propose the smallest fix that works. Prefer fixes that delete code. Never add layers,
  frameworks or config the problem does not need.
- No style taste, no "consider", no vague worries.

## 4. Output

Plain language: short sentences, everyday words, a technical term explained the first time. The
reader may never have seen this code. Write in the user's language.

Start with `What this repo does:` in two or three sentences, plus the load you assumed.

Then findings in three groups, most important first, empty groups skipped:

- **Must fix:** bug, security, data loss, breaks at the expected load.
- **Should fix:** risky code without a test, real slowness, duplication, mixed-job functions,
  code that should not exist.
- **Nice to have:** small speed-ups, shorter forms.

Number findings across all groups so the user can say "fix 2 and 5". At most 20; if smaller ones
were left out, say how many. Each finding has four parts, one or two sentences each:

```
2. Orders land on the wrong day (billing/close_day.py:40-52)
   - What this is: At midnight this job closes the day and bills that day's orders.
   - Problem: "today" comes from the server clock in UTC; an order at 00:30 Berlin time is
     billed on the previous day.
   - Fix: compute the day once in the shop's zone: datetime.now(ZoneInfo("Europe/Berlin")).date()
   - If we skip it: late orders show the wrong date and accounting fixes them by hand.
```

End with:

- `Verdict:` one line — healthy, or what to fix first.
- `Lean: -<N> lines, -<M> dependencies possible.` when lean findings exist.
- `Not checked:` the parts you did not read or could not run.

Nothing found: `What this repo does:`, then `Healthy. Nothing to fix.` and one line on what was
checked.

While oduncu is on, this report is still delivered in full: the user asked for it, so it is an
answer, not narration.
