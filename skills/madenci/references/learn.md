# /madenci learn

Turn this project's own history into project rules. A report first; rules are written only on
the user's approval. It changes no code.

1. In the project root, run the evidence script from this skill's folder:
   `node <skill base dir>/scripts/learn.js` — or `npx madenci learn` when the script is not
   there. It reads the Claude Code transcripts for this folder and its git log, locally.
2. Read the evidence. An "asked for less" line is the user trimming what an agent wrote, with
   the files edited just before it; "asked for more" is the user finishing what was left out.
   Group lines that say the same thing. Open the named files when needed to name the exact
   helper, dependency or pattern.
3. Draft at most 10 rules. Each one is concrete to this repo and backed by at least two pieces
   of evidence: "Dates: use `src/utils/date.ts`, never add a date library", not "keep code
   simple" — the core rules already say that. Drop anything the core rules already cover.
4. Show the draft, each rule with its evidence count, and the suggested level with the command
   that sets it. Stop and wait.
5. Only on approval, write the rules to `CLAUDE.local.md` in the project root under
   `## madenci (learned YYYY-MM-DD)`, replacing an earlier section with that heading. If
   `CLAUDE.local.md` is not in `.gitignore`, say so in one line. Touch `CLAUDE.md` only when the
   user asks: it is shared with the team. The level changes only when the user types it.

No evidence, or nothing that repeats → say so in one line and stop.
