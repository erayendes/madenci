# /madenci debt

Every deliberate shortcut carries a `shortcut: <limit>, <upgrade trigger>` comment. This command
collects them into one ledger so a deferral cannot quietly become permanent.

## Scan

Grep the repo for the marker in comments, skipping `.git` and everything `.gitignore` ignores:

```sh
git grep --no-index --exclude-standard -nE '(#|//|/[*]|--) ?shortcut:'
```

Add other comment prefixes if the stack uses them. If the user names their own marker word
(`/madenci debt TODO`), grep for that word instead.

Each hit is one row. The comment prefix keeps prose that merely mentions the convention out of
the ledger. Skip hits that are not a deferral (a note about a keyboard shortcut, for example).

## Output

One row per marker, grouped by file:

`<file>:<line> — <what was simplified>. limit: <the limit named>. upgrade: <the trigger>.`

Pull the limit and the trigger straight from the comment. A marker that names no upgrade trigger
gets a `no-trigger` tag — those are the ones that rot silently. Want an owner per row? Add
`git blame -L<line>,<line>`.

End with `<N> markers, <M> with no trigger.` Nothing found: `No shortcut debt.`

## Boundaries

Reads and reports only. To keep the ledger, ask first, then write it to a file
(e.g. `SHORTCUT-DEBT.md`). One-shot: afterwards, return to the mode you were in.
